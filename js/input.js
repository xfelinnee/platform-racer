// Keyboard input manager
const Input = (() => {
  const keys = {};
  const pressed = {};

  const map = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run',
    Escape: 'pause', KeyP: 'pause',
  };

  window.addEventListener('keydown', (e) => {
    const action = map[e.code];
    if (action) {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!keys[action]) pressed[action] = true;
      keys[action] = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    const action = map[e.code];
    if (action) keys[action] = false;
  });

  return {
    held: (a) => !!keys[a],
    // true once per press
    justPressed: (a) => {
      if (pressed[a]) { pressed[a] = false; return true; }
      return false;
    },
    clear: () => { for (const k in keys) keys[k] = false; for (const k in pressed) pressed[k] = false; },
  };
})();
