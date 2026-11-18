// Solmar City: a sun-soaked coastal city built from procedural low-poly
// geometry. Streets run on a grid, blocks hold varied buildings, palms line
// the sidewalks, and a beach with ocean closes the south edge.
import * as THREE from 'three';
import { randomRange, randomInt, pickFrom } from './rng.js';

export const CITY_HALF = 165;
export const ROAD_CENTERS = [-120, -60, 0, 60, 120];
export const ROAD_WIDTH = 12;

export function isNearRoad(x, z) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) < ROAD_WIDTH / 2 + 1.5) return true;
    if (Math.abs(z - c) < ROAD_WIDTH / 2 + 1.5) return true;
  }
  return false;
}

export function nearestRoadCenter(value) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) {
    if (Math.abs(value - c) < Math.abs(value - best)) best = c;
  }
  return best;
}

function makeBuildingTexture(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  const lit = ['#ffd98a', '#ffe9b8', '#9fd8ff', '#cfe8ff'];
  const dark = ['#2c3a4a', '#22303e', '#3a2f2a'];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 8 + col * 20;
      const y = 10 + row * 20;
      ctx.fillStyle = rng() < 0.45 ? pickFrom(rng, lit) : pickFrom(rng, dark);
      ctx.fillRect(x, y, 13, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoofTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8a7f72';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#6f655b';
  ctx.fillRect(6, 6, 20, 14);
  ctx.fillRect(36, 30, 18, 18);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const buildings = [];
  const group = new THREE.Group();
  group.name = 'SolmarCity';
  scene.add(group);

  // Sky, sun and haze.
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0xa8d0e8, 180, 520);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
  scene.add(hemi);

  // Ground base.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9aa578 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  ground.receiveShadow = true;
  group.add(ground);

  // Asphalt roads on both axes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const c of ROAD_CENTERS) {
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 360), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(c, 0.02, 0);
    roadNS.receiveShadow = true;
    group.add(roadNS);
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(360, ROAD_WIDTH), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.02, c);
    roadEW.receiveShadow = true;
    group.add(roadEW);
    for (let d = -150; d <= 150; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.04, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.04, c);
      group.add(dash2);
    }
  }

  // Sidewalks.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  for (const c of ROAD_CENTERS) {
    for (const off of [-8.5, 8.5]) {
      const walkNS = new THREE.Mesh(new THREE.PlaneGeometry(5, 360), walkMat);
      walkNS.rotation.x = -Math.PI / 2;
      walkNS.position.set(c + off, 0.03, 0);
      walkNS.receiveShadow = true;
      group.add(walkNS);
      const walkEW = new THREE.Mesh(new THREE.PlaneGeometry(360, 5), walkMat);
      walkEW.rotation.x = -Math.PI / 2;
      walkEW.position.set(0, 0.03, c + off);
      walkEW.receiveShadow = true;
      group.add(walkEW);
    }
  }

  // Buildings: one or two per block, varied heights and sun-bleached colours.
  const palette = [0xe8b48a, 0xf2d5a0, 0xd98a7a, 0x9fc4d8, 0xc9b8d8, 0xf0e6d2, 0x8fb8a0, 0xe8e0c8];
  const windowTex = makeBuildingTexture(rng);
  const roofTex = makeRoofTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < 5; bx++) {
    for (let bz = 0; bz < 5; bz++) {
      // Blocks sit between roads: the clear strip is 48 wide, starting 6
      // past each road centre, so buildings never spill onto the asphalt.
      const blockX = -114 + bx * 60;
      const blockZ = -114 + bz * 60;
      if (blockZ > 120) continue; // beach strip stays open
      const count = randomInt(rng, 1, 2);
      for (let n = 0; n < count; n++) {
        const w = randomRange(rng, 16, 22);
        const d = randomRange(rng, 16, 22);
        const h = randomRange(rng, 9, bz === 2 && bx === 2 ? 46 : 34);
        const x = blockX + (n === 0 ? 12 : 36) + randomRange(rng, -2, 2);
        const z = blockZ + (n === 0 ? 12 : 36) + randomRange(rng, -2, 2);
        // Keep clear of the downtown landmark tower at (-30, -30).
        if (x + w / 2 > -45 && x - w / 2 < -15 && z + d / 2 > -45 && z - d / 2 < -15) continue;
        const color = pickFrom(rng, palette);
        const sideMat = new THREE.MeshLambertMaterial({ color, map: windowTex });
        const topMat = new THREE.MeshLambertMaterial({ color: 0x8a7f72, map: roofTex });
        const mats = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
        const mesh = new THREE.Mesh(boxGeo, mats);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        buildings.push(mesh);
        colliders.push({ x, z, hx: w / 2, hz: d / 2 });
        // Rooftop box on tall towers.
        if (h > 26) {
          const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6f655b }));
          roof.scale.set(6, 3, 6);
          roof.position.set(x + w * 0.2, h + 1.5, z - d * 0.15);
          group.add(roof);
        }
      }
    }
  }

  // Downtown landmark tower at the centre block.
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x5a7fa8, map: windowTex });
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(30, 58, 30);
  tower.position.set(-30, 29, -30);
  tower.castShadow = true;
  group.add(tower);
  colliders.push({ x: -30, z: -30, hx: 15, hz: 15 });
  buildings.push(tower);

  // Palm trees along the sidewalks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const leafGeo = new THREE.ConeGeometry(3.2, 3.4, 7);
  const palms = [];
  for (let i = 0; i < 46; i++) {
    const alongRoad = rng() < 0.5;
    const road = pickFrom(rng, ROAD_CENTERS);
    const along = randomRange(rng, -150, 150);
    const side = rng() < 0.5 ? -8.5 : 8.5;
    const x = alongRoad ? road + side : along;
    const z = alongRoad ? along : road + side;
    if (z > 130) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 8.2, z);
    leaves.castShadow = true;
    group.add(trunk);
    group.add(leaves);
    palms.push(trunk);
  }

  // Street lamps.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (let i = 0; i < 30; i++) {
    const road = pickFrom(rng, ROAD_CENTERS);
    const along = randomRange(rng, -150, 150);
    const side = rng() < 0.5 ? -7 : 7;
    const x = rng() < 0.5 ? road + side : along;
    const z = rng() < 0.5 ? along : road + side;
    if (z > 130) continue;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 3, z);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x, 6.2, z);
    group.add(pole);
    group.add(lamp);
  }

  // Beach and ocean on the south edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 90),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, 195);
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 160),
    new THREE.MeshLambertMaterial({ color: 0x2a7fc4 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, 320);
  group.add(ocean);

  // Distant clouds: flat white blobs for a sunny skyline.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(randomRange(rng, 8, 16), 8, 6), cloudMat);
    cloud.scale.y = 0.35;
    cloud.position.set(randomRange(rng, -260, 260), randomRange(rng, 70, 110), randomRange(rng, -260, 160));
    group.add(cloud);
  }

  return { group, colliders, buildings, palms, sun };
}

export function resolveCircleCollision(pos, radius, colliders) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const px = c.hx + radius - Math.abs(dx);
    const pz = c.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) {
        pos.x = c.x + Math.sign(dx || 1) * (c.hx + radius);
      } else {
        pos.z = c.z + Math.sign(dz || 1) * (c.hz + radius);
      }
      return true;
    }
  }
  return false;
}

export function clampToCity(pos, margin) {
  const m = CITY_HALF - (margin || 0);
  pos.x = Math.max(-m, Math.min(m, pos.x));
  pos.z = Math.max(-m, Math.min(m + 60, pos.z));
}
