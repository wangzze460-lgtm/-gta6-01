// Combat: the player's pistol. Hitscan shots from the camera with a muzzle
// flash, a tracer line, a spark burst, and consequences: hitting people and
// cars raises the wanted level and scares nearby pedestrians.
import * as THREE from 'three';
import { playGunshot } from './audio.js';
import { scarePedestrians, knockDownPedestrian } from './pedestrians.js';
import { addWanted } from './police.js';

export function createCombatSystem(scene) {
  const flashLight = new THREE.PointLight(0xffe08a, 0, 18);
  scene.add(flashLight);
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);
  return {
    scene,
    flashLight,
    tracer,
    flashTimer: 0,
    tracerTimer: 0,
    cooldown: 0,
    ammo: Infinity,
    bursts: [],
  };
}

function spawnSparkBurst(combat, pos) {
  const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
  const burst = [];
  for (let i = 0; i < 8; i++) {
    const spark = new THREE.Mesh(geo, mat);
    spark.position.copy(pos);
    combat.scene.add(spark);
    burst.push({
      mesh: spark,
      vel: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8),
      life: 0.4,
    });
  }
  combat.bursts.push(burst);
}

export function firePistol(game) {
  const combat = game.combat;
  if (combat.cooldown > 0 || game.player.inCar) return false;
  combat.cooldown = 0.28;
  playGunshot(game.audio);
  const camera = game.camera;
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // Muzzle flash at the player's hands.
  combat.flashLight.position.copy(game.player.pos).y = 1.6;
  combat.flashLight.position.set(game.player.pos.x, 1.6, game.player.pos.z);
  combat.flashLight.intensity = 12;
  combat.flashTimer = 0.07;
  // Find the nearest hittable thing along the aim ray.
  const range = 60;
  let bestDist = range;
  let bestHit = null;
  let bestKind = null;
  const end = origin.clone().add(dir.clone().multiplyScalar(range));
  const toTarget = (target) => {
    const to = new THREE.Vector3(target.x - origin.x, 1.2 - origin.y, target.z - origin.z);
    const along = to.dot(dir);
    if (along < 1 || along > range) return;
    const perp = to.clone().add(dir.clone().multiplyScalar(-along));
    if (perp.length() < 2.2 && along < bestDist) {
      bestDist = along;
      bestHit = target;
      bestKind = 'target';
    }
  };
  for (const ped of game.pedestrians.peds) {
    if (!ped.down) toTarget(ped.pos);
    if (bestHit === ped.pos) bestKind = 'ped';
  }
  for (const car of game.traffic.cars) toTarget(car.pos);
  if (bestHit) {
    const hitPos = origin.clone().add(dir.clone().multiplyScalar(bestDist));
    hitPos.y = 1.2;
    spawnSparkBurst(combat, hitPos);
    end.copy(hitPos);
    if (bestKind === 'ped') {
      const ped = game.pedestrians.peds.find((p) => p.pos === bestHit);
      if (ped) knockDownPedestrian(ped);
      addWanted(game, 1);
    } else {
      addWanted(game, 1);
    }
  }
  // Tracer line from the gun to the hit point.
  const start = game.player.pos.clone();
  start.y = 1.5;
  const positions = combat.tracer.geometry.attributes.position;
  positions.setXYZ(0, start.x, start.y, start.z);
  positions.setXYZ(1, end.x, end.y, end.z);
  positions.needsUpdate = true;
  combat.tracer.material.opacity = 0.9;
  combat.tracer.visible = true;
  combat.tracerTimer = 0.09;
  // Everyone nearby runs.
  scarePedestrians(game.pedestrians.peds, game.player.pos, 30);
  return true;
}

export function updateCombat(combat, dt) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.flashTimer > 0) {
    combat.flashTimer -= dt;
    if (combat.flashTimer <= 0) combat.flashLight.intensity = 0;
  }
  if (combat.tracerTimer > 0) {
    combat.tracerTimer -= dt;
    combat.tracer.material.opacity = Math.max(0, combat.tracerTimer / 0.09) * 0.9;
    if (combat.tracerTimer <= 0) combat.tracer.visible = false;
  }
  for (let b = combat.bursts.length - 1; b >= 0; b--) {
    const burst = combat.bursts[b];
    let alive = false;
    for (const spark of burst) {
      spark.life -= dt;
      if (spark.life > 0) {
        alive = true;
        spark.mesh.position.add(spark.vel.clone().multiplyScalar(dt));
        spark.vel.y -= 12 * dt;
      } else {
        spark.mesh.visible = false;
      }
    }
    if (!alive) {
      for (const spark of burst) combat.scene.remove(spark.mesh);
      combat.bursts.splice(b, 1);
    }
  }
}
