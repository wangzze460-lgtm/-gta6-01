// Missions and story: Rex, a rookie wheelman new to Solmar City, takes jobs
// from Vera, a fixer who runs the harbour garage. Four jobs chain in order,
// each with an objective marker, a payout, and a mission-complete screen.
import * as THREE from 'three';

export const MISSION_LIST = [
  {
    id: 'first-job',
    title: '1 — First Job',
    giver: 'Vera',
    text: 'Vera needs a driver she can trust. Get to her garage on Marina Row and check in.',
    reward: 200,
    steps: [
      { type: 'goto', x: 60, z: -60, radius: 7, desc: 'Drive or walk to Vera\'s garage on Marina Row' },
    ],
  },
  {
    id: 'courier-run',
    title: '2 — Courier Run',
    giver: 'Vera',
    text: 'A sealed case is waiting at the docks. Pick it up and deliver it to the hotel on Palm Avenue before the buyer walks.',
    reward: 350,
    steps: [
      { type: 'goto', x: -120, z: 120, radius: 7, desc: 'Pick up the case at the docks (south-west)' },
      { type: 'goto', x: 0, z: -120, radius: 7, desc: 'Deliver the case to the Palm Avenue hotel (north)' },
    ],
  },
  {
    id: 'getaway',
    title: '3 — Getaway Driver',
    giver: 'Vera',
    text: 'Vera\'s crew just hit a pawn shop and the cops are coming. Steal a car and lose the heat — two stars, then vanish.',
    reward: 500,
    steps: [
      { type: 'steal', x: 0, z: 0, radius: 8, desc: 'Steal any car on the street (walk up and press E)' },
      { type: 'escape', x: 0, z: 0, radius: 0, desc: 'Lose the cops — get your wanted level back to zero' },
    ],
  },
  {
    id: 'big-score',
    title: '4 — The Big Score',
    giver: 'Vera',
    text: 'One last job: grab the harbour master\'s cash box at the marina, then lose a three-star chase and bring it home to the garage.',
    reward: 1000,
    steps: [
      { type: 'goto', x: 120, z: 120, radius: 7, desc: 'Grab the cash box at the marina (south-east)' },
      { type: 'escape', x: 60, z: -60, radius: 9, desc: 'Lose the cops, then get back to Vera\'s garage' },
    ],
  },
];

export function createMissionSystem(scene) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc233, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 42, 20, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 5.4, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  return {
    scene,
    beacon,
    ring,
    index: 0,
    step: 0,
    active: false,
    completed: false,
    pulse: 0,
    message: '',
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSION_LIST.length) return null;
  return MISSION_LIST[missions.index];
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.step] || null;
}

export function startMissions(missions, game) {
  missions.index = 0;
  missions.step = 0;
  missions.active = true;
  missions.completed = false;
  showMissionBanner(game, currentMission(missions));
}

export function showMissionBanner(game, mission) {
  if (!mission || !game.hud) return;
  game.hud.showMissionTitle(mission.title, mission.text);
}

export function completeMission(game) {
  const missions = game.missions;
  const mission = currentMission(missions);
  if (!mission) return;
  game.cash += mission.reward;
  if (game.audio && game.audio.playMissionComplete) game.audio.playMissionComplete(game.audio);
  if (game.audio && game.audio.playCashRegister) game.audio.playCashRegister(game.audio);
  missions.index += 1;
  missions.step = 0;
  if (missions.index >= MISSION_LIST.length) {
    missions.active = false;
    missions.completed = true;
    if (game.hud) game.hud.showMissionComplete(mission.title, mission.reward, true);
  } else {
    if (game.hud) game.hud.showMissionComplete(mission.title, mission.reward, false);
    showMissionBanner(game, currentMission(missions));
  }
  if (game.saveGame) game.saveGame();
}

export function advanceMissionStep(game) {
  const missions = game.missions;
  const mission = currentMission(missions);
  if (!mission) return;
  missions.step += 1;
  if (missions.step >= mission.steps.length) {
    completeMission(game);
  } else if (game.hud) {
    game.hud.showToast(`Next: ${mission.steps[missions.step].desc}`);
    if (game.audio && game.audio.playPickupBlip) game.audio.playPickupBlip(game.audio);
  }
}

export function updateMissions(game, dt) {
  const missions = game.missions;
  if (!missions.active) {
    missions.beacon.visible = false;
    missions.ring.visible = false;
    return;
  }
  const mission = currentMission(missions);
  const step = currentStep(missions);
  if (!mission || !step) {
    missions.beacon.visible = false;
    missions.ring.visible = false;
    return;
  }
  missions.pulse += dt;
  const playerPos = game.player.inCar && game.player.car ? game.player.car.pos : game.player.pos;
  if (step.type === 'goto') {
    missions.beacon.visible = true;
    missions.ring.visible = true;
    missions.beacon.position.set(step.x, 21, step.z);
    missions.ring.position.set(step.x, 0.12, step.z);
    const scale = 1 + Math.sin(missions.pulse * 3) * 0.08;
    missions.ring.scale.set(scale, scale, 1);
    const d = Math.hypot(playerPos.x - step.x, playerPos.z - step.z);
    if (d < step.radius) {
      if (mission.id === 'big-score' && missions.step === 0) {
        // Grabbing the cash box brings the heat.
        if (game.police) {
          game.wanted = Math.max(game.wanted, 3);
          if (game.hud) game.hud.showToast('You grabbed the cash box! 3 stars — RUN!');
        }
      }
      advanceMissionStep(game);
    }
  } else if (step.type === 'steal') {
    missions.beacon.visible = false;
    missions.ring.visible = false;
    if (game.player.inCar) advanceMissionStep(game);
  } else if (step.type === 'escape') {
    // No fixed destination for a plain getaway: hide the beacon and just
    // watch the wanted level. The Big Score escape has a real hideout.
    if (mission.id !== 'big-score') {
      missions.beacon.visible = false;
      missions.ring.visible = false;
      if (game.wanted <= 0) advanceMissionStep(game);
      return;
    }
    missions.beacon.visible = true;
    missions.ring.visible = true;
    const dest = { x: 60, z: -60 };
    missions.beacon.position.set(dest.x, 21, dest.z);
    missions.ring.position.set(dest.x, 0.12, dest.z);
    if (game.wanted <= 0) {
      const d = Math.hypot(playerPos.x - dest.x, playerPos.z - dest.z);
      if (d < 9) advanceMissionStep(game);
    }
  }
}

export function missionObjectiveText(missions) {
  const mission = currentMission(missions);
  if (!mission) return 'All jobs done — Solmar City is yours, Rex.';
  const step = currentStep(missions);
  if (!step) return mission.title;
  return `${mission.title}: ${step.desc}`;
}

export function missionMarkerPosition(missions) {
  const step = currentStep(missions);
  if (!step || !missions.active) return null;
  if (step.type === 'goto' || step.type === 'escape') {
    return { x: step.x, z: step.z };
  }
  return null;
}
