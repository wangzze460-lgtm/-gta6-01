// Save and load: cash, mission progress, health and position persist in
// localStorage so a session can continue after closing the tab.
const SAVE_KEY = 'solmar-city-save-v1';

export function saveGameState(game) {
  try {
    const data = {
      cash: game.cash,
      health: game.health,
      wanted: game.wanted,
      missionIndex: game.missions.index,
      missionStep: game.missions.step,
      missionsCompleted: game.missions.completed,
      playerX: game.player.pos.x,
      playerZ: game.player.pos.z,
      clockMinutes: game.clockMinutes,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSaveGame() {
  return loadGameState() !== null;
}

export function clearSaveGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Storage may be unavailable; a missing save just means a fresh start.
  }
}

export function applySaveGame(game, data) {
  game.cash = data.cash;
  game.health = data.health || 100;
  game.wanted = 0;
  game.clockMinutes = data.clockMinutes || 624;
  game.player.pos.set(data.playerX || 0, 0, data.playerZ || 0);
  game.player.mesh.position.copy(game.player.pos);
  game.missions.index = data.missionIndex || 0;
  game.missions.step = data.missionStep || 0;
  game.missions.completed = !!data.missionsCompleted;
  game.missions.active = !game.missions.completed && game.missions.index < 4;
}
