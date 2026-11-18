// Solmar City — a sun-soaked open-world crime game.
// You are Rex, a rookie wheelman new to town. Vera, a fixer at the harbour
// garage, has four jobs for you. Steal cars, outrun the Solmar PD, finish the
// story and own the city. Built with three.js, all original: own city, own
// characters, own story, synthesized sound, no outside assets.
import * as THREE from 'three';
import { createSeededRandom } from './rng.js';
import { createInput, attachInputListeners, isKeyDown, consumeClick } from './input.js';
import {
  createAudio, ensureAudioContext, setMuted, updateEngineSound, updateSirenSound,
  playGunshot, playPunch, playPickupBlip, playCrash,
} from './audio.js';
import { buildCity } from './city.js';
import { createCarMesh, createCarState, syncCarMesh, findNearestCar, updatePlayerCar } from './vehicles.js';
import { createPlayerState, createPlayerMesh, updatePlayerOnFoot, updateThirdPersonCamera, punchAttack } from './player.js';
import { createTrafficSystem, updateTraffic, placeTrafficForShot } from './traffic.js';
import { createPedestrianSystem, updatePedestrians, placePedestriansForShot, knockDownPedestrian, scarePedestrians } from './pedestrians.js';
import { createPoliceSystem, updatePolice, addWanted, placePoliceForShot, spawnPoliceCar } from './police.js';
import { createCombatSystem, firePistol, updateCombat } from './combat.js';
import { createMissionSystem, startMissions, updateMissions, missionObjectiveText, currentMission, showMissionBanner } from './missions.js';
import { createHud, bindHudHelpers, updateHud, updateObjective } from './hud.js';
import { createMinimap, drawMinimap } from './minimap.js';
import { saveGameState, loadGameState, hasSaveGame, applySaveGame } from './save.js';

// Any uncaught error is written into #errors so headless checks can see it.
window.addEventListener('error', (event) => {
  const box = document.getElementById('errors');
  if (box) box.textContent += `ERROR: ${event.message} @ ${event.filename}:${event.lineno}\n`;
});

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const SHOT_MODE = ['chase', 'street', 'mission', 'start'].includes(SHOT);

function buildGame() {
  const rng = createSeededRandom(SEED);
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 30, 60);

  const city = buildCity(scene, rng);
  const input = createInput();
  const audio = createAudio();
  const hud = bindHudHelpers(createHud());
  const minimap = createMinimap();

  const playerMesh = createPlayerMesh();
  scene.add(playerMesh);
  const player = createPlayerState(playerMesh);
  player.pos.set(3, 0, 30);
  player.mesh.position.copy(player.pos);

  const traffic = createTrafficSystem(scene, rng, 11);
  const pedestrians = createPedestrianSystem(scene, rng, 14);
  const police = createPoliceSystem(scene);
  const combat = createCombatSystem(scene);
  const missions = createMissionSystem(scene);

  const game = {
    rng, scene, camera, renderer, input, audio, hud, minimap,
    city, player, traffic, pedestrians, police, combat, missions,
    wanted: 0,
    cash: 150,
    health: 100,
    hurtCooldown: 0,
    clockMinutes: 624,
    state: SHOT_MODE ? 'playing' : 'menu',
    fixedCamera: false,
    ownedCar: null,
    parkedCars: [],
    saveTimer: 0,
    gameOverShown: false,
  };
  game.damagePlayer = (amount) => damagePlayer(game, amount);
  game.saveGame = () => saveGameState(game);

  attachInputListeners(input, canvas,
    () => togglePause(game),
    (code) => handleActionKey(game, code));
  document.getElementById('new-game-btn').addEventListener('click', () => startNewGame(game));
  document.getElementById('continue-btn').addEventListener('click', () => continueGame(game));
  document.getElementById('resume-btn').addEventListener('click', () => togglePause(game));
  document.getElementById('restart-btn').addEventListener('click', () => startNewGame(game));
  document.getElementById('respawn-btn').addEventListener('click', () => respawnPlayer(game));
  document.getElementById('mute-btn').addEventListener('click', () => {
    setMuted(audio, !audio.muted);
    document.getElementById('mute-btn').textContent = audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('pointerdown', () => ensureAudioContext(audio), { once: true });
  window.addEventListener('keydown', () => ensureAudioContext(audio), { once: true });

  if (SHOT_MODE) {
    setupShotMode(game);
    // Screenshot scenes start clean: no intro banner or toast covering the view.
    game.hud.missionBanner.classList.remove('show');
    game.hud.bannerTimer = 0;
    game.hud.toastEl.classList.remove('show');
    game.hud.toastTimer = 0;
  } else {
    document.getElementById('continue-btn').style.display = hasSaveGame() ? 'inline-block' : 'none';
  }
  return game;
}

function handleActionKey(game, code) {
  if (game.state !== 'playing') return;
  ensureAudioContext(game.audio);
  if (code === 'KeyE') {
    if (game.player.inCar) exitCar(game);
    else enterNearestCar(game);
  } else if (code === 'KeyF') {
    if (!game.player.inCar && punchAttack(game.player)) {
      playPunch(game.audio);
      punchNearbyPedestrian(game);
    }
  } else if (code === 'KeyM') {
    setMuted(game.audio, !game.audio.muted);
  }
}

function enterNearestCar(game) {
  const player = game.player;
  const parked = findNearestCar(player.pos, game.parkedCars, 5);
  if (parked) {
    player.car = parked;
    player.inCar = true;
    player.mesh.visible = false;
    game.ownedCar = parked;
    game.hud.showToast('Back behind the wheel.');
    return;
  }
  const target = findNearestCar(player.pos, game.traffic.cars, 5);
  if (!target) {
    game.hud.showToast('No car close enough — walk up to one and press E.');
    return;
  }
  const i = game.traffic.cars.indexOf(target);
  if (i >= 0) game.traffic.cars.splice(i, 1);
  game.parkedCars.push(target);
  game.ownedCar = target;
  player.car = target;
  player.inCar = true;
  player.mesh.visible = false;
  addWanted(game, 2);
  game.hud.showToast('You stole the car! The cops saw that — 2 stars.');
  playCrash(game.audio);
}

function exitCar(game) {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  player.pos.set(car.pos.x + side.x * 2.4, 0, car.pos.z + side.z * 2.4);
  player.mesh.position.copy(player.pos);
  player.mesh.visible = true;
  player.cameraYaw = car.heading + Math.PI;
  player.inCar = false;
  player.car = null;
  car.speed = 0;
  syncCarMesh(car);
}

function punchNearbyPedestrian(game) {
  const player = game.player;
  for (const ped of game.pedestrians.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
    if (d < 2.4) {
      knockDownPedestrian(ped);
      addWanted(game, 1);
      scarePedestrians(game.pedestrians.peds, player.pos, 25);
      game.hud.showToast('You decked a pedestrian! The cops are coming.');
      return;
    }
  }
}

function damagePlayer(game, amount) {
  if (game.state !== 'playing' || game.health <= 0) return;
  if (game.hurtCooldown > 0) return;
  game.hurtCooldown = 0.8;
  game.health -= amount;
  if (game.health <= 0) {
    game.health = 0;
    game.state = 'gameover';
    game.hud.showGameOver(true);
    game.hud.showStart(false);
  }
}

function respawnPlayer(game) {
  game.health = 100;
  game.wanted = 0;
  game.cash = Math.max(0, game.cash - 100);
  while (game.police.cars.length > 0) {
    game.scene.remove(game.police.cars[0].mesh);
    game.police.cars.shift();
  }
  if (game.player.inCar) exitCar(game);
  game.player.pos.set(0, 0, -108);
  game.player.mesh.position.copy(game.player.pos);
  game.hud.showGameOver(false);
  game.state = 'playing';
  game.hud.showToast('St. Marina Hospital patched you up. That cost $100.');
  game.saveGame();
}

function startNewGame(game) {
  game.cash = 150;
  game.health = 100;
  game.wanted = 0;
  game.clockMinutes = 624;
  game.player.pos.set(3, 0, 30);
  game.player.mesh.position.copy(game.player.pos);
  game.player.inCar = false;
  game.player.car = null;
  game.player.mesh.visible = true;
  game.missions.index = 0;
  game.missions.step = 0;
  game.missions.completed = false;
  startMissions(game.missions, game);
  game.hud.showStart(false);
  game.hud.showGameOver(false);
  game.state = 'playing';
  game.saveGame();
}

function continueGame(game) {
  const data = loadGameState();
  if (data) applySaveGame(game, data);
  game.missions.active = !game.missions.completed;
  const mission = currentMission(game.missions);
  if (mission) showMissionBanner(game, mission);
  game.hud.showStart(false);
  game.state = 'playing';
}

function togglePause(game) {
  if (game.state === 'playing') {
    game.state = 'paused';
    game.hud.showPause(true);
    game.saveGame();
  } else if (game.state === 'paused') {
    game.state = 'playing';
    game.hud.showPause(false);
  }
}

function setupShotMode(game) {
  const hud = game.hud;
  hud.showStart(false);
  game.state = 'playing';
  document.getElementById('hud').classList.remove('hidden');
  startMissions(game.missions, game);
  if (SHOT === 'start') {
    hud.showStart(true);
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('continue-btn').style.display = hasSaveGame() ? 'inline-block' : 'none';
    game.camera.position.set(60, 55, 130);
    game.camera.lookAt(0, 10, -20);
    game.fixedCamera = true;
    game.state = 'menu';
    return;
  }
  if (SHOT === 'chase') {
    stealCarForShot(game, 0, 20, Math.PI);
    game.wanted = 3;
    spawnPoliceCar(game.police, game.rng, game.player.car.pos, 2.6);
    spawnPoliceCar(game.police, game.rng, game.player.car.pos, 3.6);
    spawnPoliceCar(game.police, game.rng, game.player.car.pos, 0.4);
    placePoliceForShot(game.police, [
      { x: -5, z: 2, heading: Math.PI, speed: 20 },
      { x: 7, z: -18, heading: Math.PI, speed: 22 },
      { x: -8, z: -34, heading: Math.PI, speed: 18 },
    ]);
    placeTrafficForShot(game.traffic, [
      { x: -3, z: -30, heading: 0, speed: 10, axis: 'z', dir: 1 },
      { x: 3, z: -55, heading: Math.PI, speed: 11, axis: 'z', dir: -1 },
      { x: -3, z: 60, heading: 0, speed: 9, axis: 'z', dir: 1 },
    ]);
    placePedestriansForShot(game.pedestrians, [
      { x: 9, z: 34, heading: Math.PI / 2 },
      { x: -9, z: -8, heading: -Math.PI / 2 },
    ]);
    game.missions.index = 2;
    game.missions.step = 1;
    updateObjective(hud, '3 — Getaway Driver: Lose the cops — get your wanted level back to zero');
    game.fixedCamera = true;
    updateThirdPersonCamera(game.player, game.camera, true, game.player.car.heading);
    return;
  }
  if (SHOT === 'street') {
    game.player.pos.set(9, 0, 28);
    game.player.mesh.position.copy(game.player.pos);
    game.player.cameraYaw = Math.PI * 0.94;
    game.player.cameraPitch = 0.22;
    game.player.cameraDistance = 9;
    placeTrafficForShot(game.traffic, [
      { x: -3, z: 8, heading: 0, speed: 10, axis: 'z', dir: 1 },
      { x: 3, z: 20, heading: Math.PI, speed: 11, axis: 'z', dir: -1 },
      { x: -24, z: 3, heading: Math.PI / 2, speed: 10, axis: 'x', dir: 1 },
      { x: 30, z: -3, heading: -Math.PI / 2, speed: 10, axis: 'x', dir: -1 },
      { x: -3, z: 44, heading: 0, speed: 9, axis: 'z', dir: 1 },
    ]);
    placePedestriansForShot(game.pedestrians, [
      { x: 8.5, z: 14, heading: Math.PI },
      { x: -8.5, z: 22, heading: 0 },
      { x: 8.5, z: 2, heading: Math.PI },
      { x: -8.5, z: 34, heading: 0 },
      { x: 68.5, z: 20, heading: Math.PI / 2 },
    ]);
    updateObjective(hud, '1 — First Job: Drive or walk to Vera\'s garage on Marina Row');
    game.fixedCamera = true;
    updateThirdPersonCamera(game.player, game.camera, false, 0);
    return;
  }
  if (SHOT === 'mission') {
    stealCarForShot(game, 60, -14, Math.PI);
    game.missions.index = 0;
    game.missions.step = 0;
    updateObjective(hud, '1 — First Job: Drive or walk to Vera\'s garage on Marina Row');
    placeTrafficForShot(game.traffic, [
      { x: 57, z: -34, heading: Math.PI, speed: 10, axis: 'z', dir: -1 },
      { x: 63, z: 8, heading: 0, speed: 9, axis: 'z', dir: 1 },
    ]);
    placePedestriansForShot(game.pedestrians, [
      { x: 68.5, z: -30, heading: Math.PI },
      { x: 51.5, z: 4, heading: 0 },
    ]);
    game.fixedCamera = true;
    updateThirdPersonCamera(game.player, game.camera, true, game.player.car.heading);
  }
}

function stealCarForShot(game, x, z, heading) {
  const mesh = createCarMesh(0xd84040, false);
  game.scene.add(mesh);
  const car = createCarState(mesh, x, z, heading, false);
  car.speed = 14;
  game.parkedCars.push(car);
  game.ownedCar = car;
  game.player.car = car;
  game.player.inCar = true;
  game.player.mesh.visible = false;
  syncCarMesh(car);
}

function gameLoop(game) {
  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (game.hurtCooldown > 0) game.hurtCooldown -= dt;
    if (game.state === 'playing') {
      game.clockMinutes += dt * 0.5;
      if (consumeClick(game.input) && !game.player.inCar) firePistol(game);
      if (game.player.inCar && game.player.car) {
        const hitWall = updatePlayerCar(game.player.car, game.input, dt, game.city.colliders, game.traffic.cars);
        if (hitWall && Math.abs(game.player.car.speed) > 14) playCrash(game.audio);
        // Speeding past police raises the heat.
        if (Math.abs(game.player.car.speed) > 30 && game.wanted < 5 && Math.random() < dt * 0.05) {
          addWanted(game, 1);
        }
      } else {
        updatePlayerOnFoot(game.player, game.input, dt, game.city.colliders);
      }
      const playerPos = game.player.inCar && game.player.car ? game.player.car.pos : game.player.pos;
      const playerSpeed = game.player.inCar && game.player.car ? game.player.car.speed : 0;
      updateTraffic(game.traffic, dt, playerPos, playerSpeed);
      updatePedestrians(game.pedestrians, dt, game.player.inCar ? game.player.car.pos : null, playerSpeed);
      updatePolice(game, dt);
      updateCombat(game.combat, dt);
      updateMissions(game, dt);
      updateObjective(game.hud, missionObjectiveText(game.missions));
      updateEngineSound(game.audio, playerSpeed, game.player.inCar);
      updateSirenSound(game.audio, game.wanted, dt);
      game.saveTimer += dt;
      if (game.saveTimer > 30) {
        game.saveTimer = 0;
        game.saveGame();
      }
      if (!game.fixedCamera) updateThirdPersonCamera(game.player, game.camera, game.player.inCar, game.player.car ? game.player.car.heading : 0);
    } else if (game.state === 'menu' && SHOT === 'start') {
      // Slow cinematic orbit behind the title screen.
      const t = performance.now() * 0.00005;
      game.camera.position.set(Math.sin(t) * 120, 55, Math.cos(t) * 120 + 10);
      game.camera.lookAt(0, 12, -20);
    }
    updateHud(game.hud, game, dt);
    drawMinimap(game.minimap, game, dt);
    game.renderer.render(game.scene, game.camera);
  }
  tick();
}

const game = buildGame();
gameLoop(game);
