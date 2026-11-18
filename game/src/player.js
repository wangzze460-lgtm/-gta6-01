// The player on foot: WASD movement relative to the camera, Shift to run,
// a third-person camera that orbits with the mouse, and a punch attack.
import * as THREE from 'three';
import { isKeyDown, consumeMouseDelta } from './input.js';
import { resolveCircleCollision, clampToCity } from './city.js';

export function createPlayerState(mesh) {
  return {
    mesh,
    pos: new THREE.Vector3(0, 0, 0),
    heading: 0,
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    cameraDistance: 7,
    speed: 0,
    walking: false,
    running: false,
    punchTimer: 0,
    inCar: false,
    car: null,
  };
}

export function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xe85d3d });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a4a7a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  cap.position.y = 1.92;
  group.add(cap);
  for (const side of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), jeans);
    leg.position.set(side, 0.32, 0);
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), jacket);
    arm.position.set(side * 2.1, 1.05, 0);
    group.add(arm);
  }
  group.userData.body = body;
  return group;
}

export function updatePlayerOnFoot(player, input, dt, colliders) {
  const delta = consumeMouseDelta(input);
  player.cameraYaw -= delta.dx * 0.004;
  player.cameraPitch += delta.dy * 0.003;
  player.cameraPitch = Math.max(-0.1, Math.min(1.1, player.cameraPitch));

  const fwd = isKeyDown(input, 'KeyW') || isKeyDown(input, 'ArrowUp');
  const back = isKeyDown(input, 'KeyS') || isKeyDown(input, 'ArrowDown');
  const left = isKeyDown(input, 'KeyA') || isKeyDown(input, 'ArrowLeft');
  const right = isKeyDown(input, 'KeyD') || isKeyDown(input, 'ArrowRight');
  const run = isKeyDown(input, 'ShiftLeft') || isKeyDown(input, 'ShiftRight');
  const moveSpeed = run ? 9.5 : 5.2;

  let mx = 0;
  let mz = 0;
  const sin = Math.sin(player.cameraYaw);
  const cos = Math.cos(player.cameraYaw);
  if (fwd) { mx -= sin; mz -= cos; }
  if (back) { mx += sin; mz += cos; }
  if (left) { mx -= cos; mz += sin; }
  if (right) { mx += cos; mz -= sin; }
  const len = Math.hypot(mx, mz);
  player.walking = len > 0;
  player.running = player.walking && run;
  if (len > 0) {
    mx /= len;
    mz /= len;
    player.pos.x += mx * moveSpeed * dt;
    player.pos.z += mz * moveSpeed * dt;
    player.heading = Math.atan2(mx, mz);
    player.speed = moveSpeed;
  } else {
    player.speed = 0;
  }
  clampToCity(player.pos, 4);
  resolveCircleCollision(player.pos, 0.6, colliders);
  if (player.punchTimer > 0) player.punchTimer -= dt;
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  // Simple walk bob.
  const bob = player.walking ? Math.sin(performance.now() * 0.02) * 0.05 : 0;
  player.mesh.position.y = bob;
  return player.walking;
}

export function updateThirdPersonCamera(player, camera, inCar, carHeading) {
  const yaw = inCar ? carHeading + Math.PI : player.cameraYaw;
  const pitch = inCar ? 0.24 : player.cameraPitch;
  const dist = inCar ? 12 : player.cameraDistance;
  const target = inCar && player.car ? player.car.pos : player.pos;
  const height = inCar ? 3.8 : 2.6;
  const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = height + Math.sin(pitch) * dist;
  camera.position.set(cx, cy, cz);
  camera.lookAt(target.x, target.y + 1.4, target.z);
}

export function punchAttack(player) {
  if (player.punchTimer > 0) return false;
  player.punchTimer = 0.45;
  return true;
}
