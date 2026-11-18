// Pedestrians: people strolling the sidewalks who run away when shots are
// fired or a car speeds straight at them.
import * as THREE from 'three';
import { ROAD_CENTERS } from './city.js';
import { randomRange, pickFrom } from './rng.js';

const SHIRT_COLORS = [0xe8e8e8, 0x3a6fd8, 0xe8c33a, 0xd84040, 0x3aa855, 0xd06fa8, 0x222222, 0xe07a2a];
const SKIN_COLORS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4028];

export function createPedestrianMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pickFrom(rng, SHIRT_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: pickFrom(rng, [0x2a4a7a, 0x333333, 0x6a5a3a]) });
  const skin = new THREE.MeshLambertMaterial({ color: pickFrom(rng, SKIN_COLORS) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), shirt);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  for (const side of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), pants);
    leg.position.set(side, 0.3, 0);
    group.add(leg);
  }
  return group;
}

export function createPedestrianSystem(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = createPedestrianMesh(rng);
    scene.add(mesh);
    const ped = {
      mesh,
      pos: new THREE.Vector3(0, 0, 0),
      heading: 0,
      speed: randomRange(rng, 1.2, 2.2),
      walkSpeed: 0,
      fleeing: false,
      fleeTimer: 0,
      down: false,
      downTimer: 0,
      axis: 'x',
      dir: 1,
      bobPhase: rng() * Math.PI * 2,
    };
    ped.walkSpeed = ped.speed;
    respawnPedestrian(ped, rng, true);
    peds.push(ped);
  }
  return { peds, rng };
}

export function respawnPedestrian(ped, rng, randomSpot) {
  const road = pickFrom(rng, ROAD_CENTERS);
  const along = randomSpot ? randomRange(rng, -150, 150) : randomRange(rng, -150, -120);
  const side = rng() < 0.5 ? -8.5 : 8.5;
  ped.axis = rng() < 0.5 ? 'x' : 'z';
  ped.dir = rng() < 0.5 ? 1 : -1;
  if (ped.axis === 'x') {
    ped.pos.set(along, 0, road + side);
    ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    ped.pos.set(road + side, 0, along);
    ped.heading = ped.dir > 0 ? 0 : Math.PI;
  }
  ped.down = false;
  ped.downTimer = 0;
  ped.fleeing = false;
  ped.mesh.rotation.set(0, ped.heading, 0);
  ped.mesh.visible = true;
  ped.mesh.position.copy(ped.pos);
}

export function scarePedestrians(peds, threatPos, radius) {
  for (const ped of peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.pos.x - threatPos.x, ped.pos.z - threatPos.z);
    if (d < radius) {
      ped.fleeing = true;
      ped.fleeTimer = 3;
      const dx = ped.pos.x - threatPos.x;
      const dz = ped.pos.z - threatPos.z;
      ped.heading = Math.atan2(dx, dz);
    }
  }
}

export function knockDownPedestrian(ped) {
  ped.down = true;
  ped.downTimer = 6;
  ped.mesh.rotation.z = Math.PI / 2;
  ped.mesh.position.y = 0.3;
}

export function updatePedestrians(system, dt, playerCarPos, playerCarSpeed) {
  for (const ped of system.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) respawnPedestrian(ped, system.rng, true);
      continue;
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.fleeing = false;
    }
    // Flee a fast car bearing down on the sidewalk.
    if (playerCarPos && Math.abs(playerCarSpeed) > 12) {
      const d = Math.hypot(ped.pos.x - playerCarPos.x, ped.pos.z - playerCarPos.z);
      if (d < 12) {
        ped.fleeing = true;
        ped.fleeTimer = 2;
        const dx = ped.pos.x - playerCarPos.x;
        const dz = ped.pos.z - playerCarPos.z;
        ped.heading = Math.atan2(dx, dz);
      }
    }
    const speed = ped.fleeing ? 5.5 : ped.walkSpeed;
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    if (Math.abs(ped.pos.x) > 158 || Math.abs(ped.pos.z) > 158) {
      respawnPedestrian(ped, system.rng, false);
    }
    ped.bobPhase += dt * (ped.fleeing ? 14 : 8);
    ped.mesh.position.set(ped.pos.x, Math.abs(Math.sin(ped.bobPhase)) * 0.06, ped.pos.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

export function placePedestriansForShot(system, spots) {
  spots.forEach((spot, i) => {
    const ped = system.peds[i % system.peds.length];
    ped.pos.set(spot.x, 0, spot.z);
    ped.heading = spot.heading || 0;
    ped.down = false;
    ped.fleeing = false;
    ped.mesh.rotation.set(0, ped.heading, 0);
    ped.mesh.position.copy(ped.pos);
    ped.mesh.visible = true;
  });
}
