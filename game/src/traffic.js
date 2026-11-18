// Traffic: AI cars that cruise the street grid, keep to the right-hand lane,
// slow down for the car ahead and turn at intersections.
import * as THREE from 'three';
import { createCarMesh, createCarState, syncCarMesh, CAR_COLORS } from './vehicles.js';
import { ROAD_CENTERS, ROAD_WIDTH } from './city.js';
import { randomRange, randomInt, pickFrom } from './rng.js';

export function createTrafficSystem(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const color = pickFrom(rng, CAR_COLORS);
    const mesh = createCarMesh(color, false);
    scene.add(mesh);
    const car = createCarState(mesh, 0, 0, 0, false);
    resetTrafficCar(car, rng, true);
    cars.push(car);
    syncCarMesh(car);
  }
  return { cars, rng };
}

function pickRoadLane(rng) {
  const road = pickFrom(rng, ROAD_CENTERS);
  const lane = rng() < 0.5 ? -3 : 3;
  return { road, lane };
}

export function resetTrafficCar(car, rng, randomSpot) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const { road, lane } = pickRoadLane(rng);
  const along = randomSpot ? randomRange(rng, -150, 150) : randomRange(rng, -150, -100);
  const dir = rng() < 0.5 ? 1 : -1;
  if (axis === 'x') {
    car.pos.set(along, 0, road + lane);
    car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.pos.set(road + lane, 0, along);
    car.heading = dir > 0 ? 0 : Math.PI;
  }
  car.axis = axis;
  car.dir = dir;
  car.speed = randomRange(rng, 8, 13);
  car.cruiseSpeed = car.speed;
  car.turnCooldown = randomRange(rng, 2, 6);
}

export function updateTraffic(traffic, dt, playerPos, playerSpeed) {
  for (const car of traffic.cars) {
    car.turnCooldown -= dt;
    // Slow down for the car directly ahead on the same lane.
    let targetSpeed = car.cruiseSpeed;
    for (const other of traffic.cars) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const ahead = car.axis === 'x'
        ? Math.sign(dx) === car.dir && Math.abs(dz) < 3 && Math.abs(dx) < 12
        : Math.sign(dz) === car.dir && Math.abs(dx) < 3 && Math.abs(dz) < 12;
      if (ahead) targetSpeed = Math.min(targetSpeed, 3);
    }
    // Slow down when the player is right in front of the car.
    if (playerPos) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const ahead = car.axis === 'x'
        ? Math.sign(dx) === car.dir && Math.abs(dz) < 3.5 && Math.abs(dx) < 14
        : Math.sign(dz) === car.dir && Math.abs(dx) < 3.5 && Math.abs(dz) < 14;
      if (ahead && dist < 14) targetSpeed = Math.min(targetSpeed, 0);
    }
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    // Turn at an intersection, or respawn at the far edge when out of town.
    const onIntersection = ROAD_CENTERS.some((c) => Math.abs((car.axis === 'x' ? car.pos.z : car.pos.x) - c) < 4);
    const nearCross = ROAD_CENTERS.some((c) => Math.abs((car.axis === 'x' ? car.pos.x : car.pos.z) - c) < 2.5);
    if (car.turnCooldown <= 0 && onIntersection && nearCross && traffic.rng() < 0.6) {
      turnTrafficCar(car, traffic.rng);
      car.turnCooldown = randomRange(traffic.rng, 3, 7);
    }
    if (Math.abs(car.pos.x) > 158 || Math.abs(car.pos.z) > 158) {
      resetTrafficCar(car, traffic.rng, false);
    }
    syncCarMesh(car);
  }
}

function turnTrafficCar(car, rng) {
  // Turn 90 degrees onto the cross street, keeping the right-hand lane.
  const newAxis = car.axis === 'x' ? 'z' : 'x';
  const turnLeft = rng() < 0.5;
  const oldDir = car.dir;
  let newDir;
  if (car.axis === 'x') {
    newDir = turnLeft ? (oldDir > 0 ? -1 : 1) : (oldDir > 0 ? 1 : -1);
    // Snap onto the cross road's lane.
    const cross = nearestCenter(car.pos.x);
    car.pos.x = cross + (newDir > 0 ? -3 : 3);
    car.heading = newDir > 0 ? 0 : Math.PI;
  } else {
    newDir = turnLeft ? (oldDir > 0 ? 1 : -1) : (oldDir > 0 ? -1 : 1);
    const cross = nearestCenter(car.pos.z);
    car.pos.z = cross + (newDir > 0 ? 3 : -3);
    car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  car.axis = newAxis;
  car.dir = newDir;
}

function nearestCenter(value) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) {
    if (Math.abs(value - c) < Math.abs(value - best)) best = c;
  }
  return best;
}

export function placeTrafficForShot(traffic, spots) {
  // Deterministic staging for screenshots: put cars exactly where asked.
  spots.forEach((spot, i) => {
    const car = traffic.cars[i % traffic.cars.length];
    car.pos.set(spot.x, 0, spot.z);
    car.heading = spot.heading || 0;
    car.speed = spot.speed || 0;
    car.cruiseSpeed = 10;
    car.axis = spot.axis || 'z';
    car.dir = spot.dir || 1;
    car.turnCooldown = 99;
    syncCarMesh(car);
  });
}
