// HUD: health, cash, wanted stars, speed, mission objective, clock, toasts
// and the menu overlays (start, pause, game over, mission complete).
export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    healthFill: el('health-fill'),
    healthText: el('health-text'),
    cashText: el('cash'),
    starsEl: el('stars'),
    speedText: el('speed'),
    objectiveText: el('objective'),
    clockText: el('clock'),
    toastEl: el('toast'),
    missionTitleEl: el('mission-title'),
    missionTextEl: el('mission-text'),
    missionBanner: el('mission-banner'),
    completePanel: el('mission-complete'),
    completeTitle: el('complete-title'),
    completeReward: el('complete-reward'),
    startScreen: el('start-screen'),
    pauseScreen: el('pause-screen'),
    gameOverScreen: el('game-over'),
    toastTimer: 0,
    bannerTimer: 0,
    crosshair: el('crosshair'),
  };
}

export function updateHud(hud, game, dt) {
  if (hud.healthFill) hud.healthFill.style.width = `${Math.max(0, game.health)}%`;
  if (hud.healthText) hud.healthText.textContent = `HP ${Math.max(0, Math.round(game.health))}`;
  if (hud.cashText) hud.cashText.textContent = `$${game.cash.toLocaleString('en-US')}`;
  if (hud.starsEl) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < game.wanted ? '★' : '☆';
    hud.starsEl.textContent = stars;
    hud.starsEl.classList.toggle('hot', game.wanted > 0);
  }
  const speed = game.player.inCar && game.player.car ? Math.abs(game.player.car.speed) * 2.4 : 0;
  if (hud.speedText) hud.speedText.textContent = `${Math.round(speed)} mph`;
  if (hud.crosshair) {
    hud.crosshair.style.display = (!game.player.inCar && game.state === 'playing') ? 'block' : 'none';
  }
  if (hud.clockText) {
    const totalMinutes = game.clockMinutes;
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = Math.floor(totalMinutes % 60);
    hud.clockText.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0 && hud.toastEl) hud.toastEl.classList.remove('show');
  }
  if (hud.bannerTimer > 0) {
    hud.bannerTimer -= dt;
    if (hud.bannerTimer <= 0 && hud.missionBanner) hud.missionBanner.classList.remove('show');
  }
}

export function updateObjective(hud, text) {
  if (hud.objectiveText) hud.objectiveText.textContent = text;
}

function showToast(hud, text) {
  if (!hud.toastEl) return;
  hud.toastEl.textContent = text;
  hud.toastEl.classList.add('show');
  hud.toastTimer = 4;
}

function showMissionTitle(hud, title, text) {
  if (!hud.missionBanner) return;
  if (hud.missionTitleEl) hud.missionTitleEl.textContent = title;
  if (hud.missionTextEl) hud.missionTextEl.textContent = text;
  hud.missionBanner.classList.add('show');
  hud.bannerTimer = 6;
}

function showMissionComplete(hud, title, reward, allDone) {
  if (!hud.completePanel) return;
  if (hud.completeTitle) hud.completeTitle.textContent = allDone ? 'STORY COMPLETE' : 'MISSION COMPLETE';
  if (hud.completeReward) {
    hud.completeReward.textContent = allDone
      ? `${title} — $${reward}. Rex is Vera's top driver now. Solmar City is yours.`
      : `${title} — you earned $${reward}.`;
  }
  hud.completePanel.classList.add('show');
  setTimeout(() => hud.completePanel.classList.remove('show'), 5000);
}

function showScreen(el, show) {
  if (el) el.classList.toggle('hidden', !show);
}

export function bindHudHelpers(hud) {
  hud.showToast = (text) => showToast(hud, text);
  hud.showMissionTitle = (title, text) => showMissionTitle(hud, title, text);
  hud.showMissionComplete = (title, reward, allDone) => showMissionComplete(hud, title, reward, allDone);
  hud.showStart = (show) => showScreen(hud.startScreen, show);
  hud.showPause = (show) => showScreen(hud.pauseScreen, show);
  hud.showGameOver = (show) => showScreen(hud.gameOverScreen, show);
  return hud;
}
