// Wanted system and police: crimes raise the star level, police cars spawn
// and chase the player, and the heat cools off when the player breaks away
// and stays out of sight.
import * as THREE from 'three';
import { createCarMesh, createCarState, syncCarMesh } from './vehicles.js';
import { randomRange, pickFrom } from './rng.js';

export const MAX_WANTED = 5;

export function createPoliceSystem(scene) {
  return {
    scene,
    cars: [],
    loseTimer: 0,
    flashTimer: 0,
    spawnCooldown: 0,
  };
}

export function addWanted(game, stars) {
  game.wanted = Math.max(0, Math.min(MAX_WANTED, game.wanted + stars));
  game.police.loseTimer = 0;
  if (game.wanted > 0 && game.hud) game.hud.showToast(`WANTED LEVEL ${game.wanted} — the Solmar PD is on you!`);
}

export function policeCountForWanted(wanted) {
  return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 5;
}

export function spawnPoliceCar(police, rng, nearPos, angle) {
  const mesh = createCarMesh(0xf0f0f0, true);
  police.scene.add(mesh);
  const a = angle !== undefined ? angle : rng() * Math.PI * 2;
  const dist = randomRange(rng, 45, 70);
  const x = nearPos.x + Math.sin(a) * dist;
  const z = nearPos.z + Math.cos(a) * dist;
  const car = createCarState(mesh, x, z, 0, true);
  car.speed = 10;
  car.cruiseSpeed = 20;
  police.cars.push(car);
  syncCarMesh(car);
  return car;
}

export function removePoliceCar(police, car) {
  police.scene.remove(car.mesh);
  const i = police.cars.indexOf(car);
  if (i >= 0) police.cars.splice(i, 1);
}

export function updatePolice(game, dt) {
  const police = game.police;
  const playerPos = game.player.inCar && game.player.car ? game.player.car.pos : game.player.pos;
  const wantedCount = policeCountForWanted(game.wanted);
  police.spawnCooldown -= dt;
  // Spawn up to the wanted level, remove extras when the heat drops.
  while (police.cars.length < wantedCount && police.spawnCooldown <= 0) {
    spawnPoliceCar(police, game.rng, playerPos);
    police.spawnCooldown = 1.2;
  }
  while (police.cars.length > wantedCount) {
    removePoliceCar(police, police.cars[police.cars.length - 1]);
  }
  // Flash the light bars.
  police.flashTimer += dt;
  const redOn = Math.floor(police.flashTimer * 4) % 2 === 0;
  for (const car of police.cars) {
    if (car.mesh.userData.redLight) car.mesh.userData.redLight.visible = redOn;
    if (car.mesh.userData.blueLight) car.mesh.userData.blueLight.visible = !redOn;
  }
  // Chase: steer toward the player and ram.
  for (const car of police.cars) {
    const dx = playerPos.x - car.pos.x;
    const dz = playerPos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let diff = targetHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const chaseSpeed = 16 + game.wanted * 3.2;
    car.speed += (chaseSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    // Ram: shove the player's car and hurt the player on a hard hit.
    if (dist < 3.4) {
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      if (game.player.inCar && game.player.car) {
        game.player.car.pos.x -= nx * 2.2 * dt * 10;
        game.player.car.pos.z -= nz * 2.2 * dt * 10;
        game.player.car.speed *= 0.86;
      } else {
        game.player.pos.x -= nx * 1.2;
        game.player.pos.z -= nz * 1.2;
      }
      if (game.damagePlayer) game.damagePlayer(2);
      if (game.audio && game.audio.playCrash) game.audio.playCrash(game.audio);
      car.speed *= 0.55;
    }
    // Stuck far away? Teleport back into the chase.
    if (dist > 130) {
      const a = game.rng() * Math.PI * 2;
      car.pos.x = playerPos.x + Math.sin(a) * 55;
      car.pos.z = playerPos.z + Math.cos(a) * 55;
    }
    syncCarMesh(car);
  }
  // Lose the heat: no police close by for a while and the stars fall.
  if (game.wanted > 0) {
    let nearest = Infinity;
    for (const car of police.cars) {
      const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (d < nearest) nearest = d;
    }
    if (nearest > 45) {
      police.loseTimer += dt;
      if (police.loseTimer > 8) {
        game.wanted -= 1;
        police.loseTimer = 0;
        if (game.hud) game.hud.showToast(game.wanted > 0 ? `Heat dropping... ${game.wanted} stars left` : 'You lost the cops. Clean.');
      }
    } else {
      police.loseTimer = 0;
    }
  }
}

export function placePoliceForShot(police, spots) {
  spots.forEach((spot, i) => {
    const car = police.cars[i];
    if (!car) return;
    car.pos.set(spot.x, 0, spot.z);
    car.heading = spot.heading || 0;
    car.speed = spot.speed || 0;
    syncCarMesh(car);
  });
}
