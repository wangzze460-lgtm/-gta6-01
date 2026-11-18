// Keyboard and mouse state for the whole game. One shared object so every
// system (player, driving, combat, menus) reads the same input each frame.
export function createInput() {
  return {
    keys: new Set(),
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    mouseDown: false,
    clicked: false,
    dragging: false,
    pointerLocked: false,
    lastPointerX: 0,
    lastPointerY: 0,
  };
}

export function isKeyDown(input, code) {
  return input.keys.has(code);
}

export function attachInputListeners(input, canvas, onPauseKey, onActionKey) {
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      if (onPauseKey) onPauseKey();
      return;
    }
    input.keys.add(event.code);
    if (onActionKey) onActionKey(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousedown', (event) => {
    input.mouseDown = true;
    input.clicked = true;
    input.dragging = true;
    input.lastPointerX = event.clientX;
    input.lastPointerY = event.clientY;
    if (canvas.requestPointerLock && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    input.dragging = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas) {
      input.mouseDeltaX += event.movementX || 0;
      input.mouseDeltaY += event.movementY || 0;
      input.pointerLocked = true;
    } else if (input.dragging) {
      input.mouseDeltaX += event.clientX - input.lastPointerX;
      input.mouseDeltaY += event.clientY - input.lastPointerY;
      input.lastPointerX = event.clientX;
      input.lastPointerY = event.clientY;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
  });
}

export function consumeMouseDelta(input) {
  const dx = input.mouseDeltaX;
  const dy = input.mouseDeltaY;
  input.mouseDeltaX = 0;
  input.mouseDeltaY = 0;
  return { dx, dy };
}

export function consumeClick(input) {
  const was = input.clicked;
  input.clicked = false;
  return was;
}
