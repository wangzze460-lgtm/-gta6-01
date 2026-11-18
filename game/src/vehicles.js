// Cars: mesh factory plus arcade driving physics shared by the player's car,
// traffic cars and police cars. No real physics engine, just speed, steering
// and simple circle collisions against buildings and other cars.
import * as THREE from 'three';
import { resolveCircleCollision, clampToCity } from './city.js';

export const CAR_COLORS = [0xd84040, 0x3a6fd8, 0xe8c33a, 0x3aa855, 0xe8e8e8, 0x8a4fd0, 0x222222, 0xe07a2a];

export function createCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf0f0f0 : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), darkMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPositions = [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]];
  const wheels = [];
  for (const [wx, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const side of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(side, 0.6, 2.22);
    group.add(light);
  }
  if (isPolice) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barBase.position.set(0, 1.48, -0.2);
    group.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.45), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.35, 1.6, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.45), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.35, 1.6, -0.2);
    group.add(blue);
    group.userData.redLight = red;
    group.userData.blueLight = blue;
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.0), doorMat);
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  return group;
}

export function createCarState(mesh, x, z, heading, isPolice) {
  return {
    mesh,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    isPolice: !!isPolice,
    health: 100,
    radius: 1.7,
    damaged: 0,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * 0.5;
  for (const wheel of car.mesh.userData.wheels || []) {
    wheel.rotation.x += spin * 0.016;
  }
}

export function forwardVector(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

// Arcade driving for the player's car: accelerate, brake, reverse, steer
// harder at low speed, handbrake slides the rear out.
export function updatePlayerCar(car, input, dt, colliders, otherCars) {
  const forward = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const back = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  const handbrake = input.keys.has('Space');
  const topSpeed = 42;
  const accel = 22;
  if (forward) car.speed += accel * dt;
  if (back) car.speed -= (car.speed > 0.5 ? 30 : 12) * dt;
  if (!forward && !back) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  }
  car.speed = Math.max(-14, Math.min(topSpeed, car.speed));
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = handbrake ? 1.9 : 1.0;
  car.heading += car.steer * grip * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed || 1);
  const fwd = forwardVector(car.heading);
  car.pos.x += fwd.x * car.speed * dt;
  car.pos.z += fwd.z * car.speed * dt;
  clampToCity(car.pos, 6);
  const hitWall = resolveCircleCollision(car.pos, car.radius, colliders);
  if (hitWall) {
    if (Math.abs(car.speed) > 12) car.damaged += 1;
    car.speed *= 0.45;
  }
  for (const other of otherCars) {
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const dist = Math.hypot(dx, dz);
    const minDist = car.radius + other.radius;
    if (dist > 0.01 && dist < minDist) {
      const push = (minDist - dist) / 2;
      const nx = dx / dist;
      const nz = dz / dist;
      car.pos.x += nx * push;
      car.pos.z += nz * push;
      other.pos.x -= nx * push;
      other.pos.z -= nz * push;
      if (Math.abs(car.speed) > 10) car.damaged += 1;
      car.speed *= 0.7;
      other.speed *= 0.7;
    }
  }
  syncCarMesh(car);
  return hitWall;
}

export function findNearestCar(pos, cars, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}
