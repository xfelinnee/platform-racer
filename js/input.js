// Keyboard + gamepad input manager
const Input = (() => {
  const keys = {};       // real (physical) held state, keyed by action
  const pressed = {};    // edge: true once per press until consumed
  const virt = {};       // virtual held state from the gamepad

  const DEFAULT_BINDINGS = {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['KeyW', 'ArrowUp'],
    duck: ['KeyS', 'ArrowDown'],
    run: ['ShiftLeft', 'ShiftRight'],
    pause: ['Escape', 'KeyP'],
  };

  let bindings = clone(DEFAULT_BINDINGS);
  let codeMap = {}; // e.code -> action
  let sprintMode = 'hold'; // hold | toggle
  let sprintToggle = false; // latched sprint state when in toggle mode
  let controllerEnabled = true;
  let capturing = false; // while remapping we swallow the next key

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function rebuild() {
    codeMap = {};
    for (const action in bindings) {
      for (const code of bindings[action]) if (code) codeMap[code] = action;
    }
  }
  rebuild();

  function setHeld(action, down) {
    if (action === 'run' && sprintMode === 'toggle') {
      if (down && !keys.run && !virt.run) sprintToggle = !sprintToggle;
      // in toggle mode the physical key state is only used to flip the latch
    }
    if (down) { if (!keys[action] && !virt[action]) pressed[action] = true; }
  }

  window.addEventListener('keydown', (e) => {
    if (capturing) return; // remap UI handles the key itself
    const action = codeMap[e.code];
    if (!action) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!keys[action]) setHeld(action, true);
    keys[action] = true;
  });

  window.addEventListener('keyup', (e) => {
    const action = codeMap[e.code];
    if (action) keys[action] = false;
  });

  // ---- Gamepad (Xbox / PS5 / Steam Deck — all expose the standard mapping) ----
  const gpPrev = {};
  let gpName = '';
  const GP_BUTTONS = { 0: 'jump', 1: 'duck', 2: 'run', 5: 'run', 9: 'pause', 13: 'duck', 14: 'left', 15: 'right' };

  function pollGamepad() {
    if (!controllerEnabled || !navigator.getGamepads) { requestAnimationFrame(pollGamepad); return; }
    const pads = navigator.getGamepads();
    let pad = null;
    for (const p of pads) { if (p && p.connected) { pad = p; break; } }
    const nextVirt = {};
    if (pad) {
      gpName = pad.id;
      const ax = pad.axes[0] || 0;
      if (ax < -0.4) nextVirt.left = true;
      if (ax > 0.4) nextVirt.right = true;
      pad.buttons.forEach((b, i) => {
        if (b.pressed && GP_BUTTONS[i]) nextVirt[GP_BUTTONS[i]] = true;
      });
    } else {
      gpName = '';
    }
    // diff against previous frame for edge (justPressed) + toggle-sprint handling
    for (const action of ['left', 'right', 'jump', 'duck', 'run', 'pause']) {
      const down = !!nextVirt[action];
      if (down && !gpPrev[action]) {
        if (action === 'run' && sprintMode === 'toggle') { if (!keys.run) sprintToggle = !sprintToggle; }
        if (!keys[action] && !virt[action]) pressed[action] = true;
      }
      virt[action] = down;
      gpPrev[action] = down;
    }
    requestAnimationFrame(pollGamepad);
  }
  requestAnimationFrame(pollGamepad);

  function rawHeld(a) { return !!keys[a] || !!virt[a]; }

  return {
    held: (a) => {
      if (a === 'run' && sprintMode === 'toggle') return sprintToggle;
      return rawHeld(a);
    },
    // true once per press
    justPressed: (a) => {
      if (pressed[a]) { pressed[a] = false; return true; }
      return false;
    },
    clear: () => {
      for (const k in keys) keys[k] = false;
      for (const k in pressed) pressed[k] = false;
      for (const k in virt) virt[k] = false;
      sprintToggle = false;
    },

    // ---- configuration API (used by the Settings UI) ----
    DEFAULT_BINDINGS: clone(DEFAULT_BINDINGS),
    getBindings: () => clone(bindings),
    setBindings: (b) => {
      bindings = Object.assign(clone(DEFAULT_BINDINGS), b || {});
      // keep bindings WYSIWYG with the 2-slot Settings UI (no hidden extra keys)
      for (const a in bindings) bindings[a] = (bindings[a] || []).slice(0, 2);
      rebuild();
    },
    setBinding: (action, codes) => {
      if (!(action in bindings)) return;
      bindings[action] = codes.slice(0, 2);
      rebuild();
    },
    resetBindings: () => { bindings = clone(DEFAULT_BINDINGS); rebuild(); return clone(bindings); },
    setSprintMode: (m) => { sprintMode = (m === 'toggle') ? 'toggle' : 'hold'; sprintToggle = false; },
    setControllerEnabled: (on) => { controllerEnabled = !!on; },
    gamepadName: () => gpName,
    // while true, keydown is ignored so a remap dialog can capture the raw key
    setCapturing: (on) => { capturing = !!on; },
  };
})();
