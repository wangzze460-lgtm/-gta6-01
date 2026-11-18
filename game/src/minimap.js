// Live minimap: a 2D canvas in the HUD corner that draws the street grid,
// buildings, the player arrow, traffic, police and the mission marker.
import { ROAD_CENTERS, CITY_HALF } from './city.js';
import { missionMarkerPosition } from './missions.js';

export function createMinimap() {
  const canvas = document.getElementById('minimap');
  if (!canvas) return null;
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    size: canvas.width,
    flash: 0,
  };
}

export function drawMinimap(minimap, game, dt) {
  if (!minimap) return;
  const { ctx, size } = minimap;
  const half = CITY_HALF + 60;
  const toMap = (x, z) => [
    ((x + half) / (half * 2)) * size,
    ((z + half) / (half * 2)) * size,
  ];
  minimap.flash += dt;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(12, 24, 34, 0.92)';
  ctx.fillRect(0, 0, size, size);
  // City blocks.
  ctx.fillStyle = 'rgba(120, 140, 110, 0.5)';
  for (const b of game.city.buildings) {
    const [bx, by] = toMap(b.position.x, b.position.z);
    const w = Math.max(2, (b.scale.x / (half * 2)) * size);
    const h = Math.max(2, (b.scale.z / (half * 2)) * size);
    ctx.fillRect(bx - w / 2, by - h / 2, w, h);
  }
  // Streets.
  ctx.strokeStyle = 'rgba(220, 220, 210, 0.85)';
  ctx.lineWidth = 2;
  for (const c of ROAD_CENTERS) {
    const [x1] = toMap(c, -half);
    const [, y1] = toMap(-half, c);
    const [x2] = toMap(c, half);
    const [, y2] = toMap(half, c);
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x2, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(size, y2);
    ctx.stroke();
  }
  // Ocean strip at the bottom.
  const [, oceanY] = toMap(0, 150);
  ctx.fillStyle = 'rgba(42, 127, 196, 0.8)';
  ctx.fillRect(0, oceanY, size, size - oceanY);
  // Mission marker: pulsing gold diamond.
  const marker = game.missions ? missionMarkerPosition(game.missions) : null;
  if (marker) {
    const [mx, my] = toMap(marker.x, marker.z);
    const pulse = 5 + Math.sin(minimap.flash * 5) * 2;
    ctx.fillStyle = '#ffc233';
    ctx.beginPath();
    ctx.moveTo(mx, my - pulse);
    ctx.lineTo(mx + pulse, my);
    ctx.lineTo(mx, my + pulse);
    ctx.lineTo(mx - pulse, my);
    ctx.closePath();
    ctx.fill();
  }
  // Traffic cars: yellow dots.
  ctx.fillStyle = '#f5d76e';
  for (const car of game.traffic.cars) {
    const [cx, cy] = toMap(car.pos.x, car.pos.z);
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  }
  // Police: flashing blue/red dots.
  const policeOn = Math.floor(minimap.flash * 3) % 2 === 0;
  ctx.fillStyle = policeOn ? '#3a6ff0' : '#f04040';
  for (const car of game.police.cars) {
    const [cx, cy] = toMap(car.pos.x, car.pos.z);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: white arrow showing facing.
  const playerPos = game.player.inCar && game.player.car ? game.player.car.pos : game.player.pos;
  const heading = game.player.inCar && game.player.car ? game.player.car.heading : game.player.heading;
  const [px, py] = toMap(playerPos.x, playerPos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * -1 + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}
