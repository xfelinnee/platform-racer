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

  // ---- Menu navigation layer (drives DOM UI, not gameplay) ----
  // Separate from the gameplay mapping above so the same buttons can steer menus
  // when a menu is open and steer the player when it isn't. Consumers register a
  // callback with onMenuNav() and receive discrete events: up/down/left/right,
  // confirm, back, start, tabPrev, tabNext. Directions auto-repeat while held.
  const menuCbs = [];
  let menuPrev = {};
  let repeatDir = null;
  let repeatStart = 0;   // timestamp the current direction was first held
  let repeatCount = 0;   // number of emits already sent for this hold
  // Time-based so it feels the same on 60/120/144Hz displays (the poll runs on
  // requestAnimationFrame, which ticks at the monitor's refresh rate).
  const REPEAT_DELAY_MS = 420; // wait before a held direction starts repeating
  const REPEAT_INT_MS = 150;   // gap between repeats thereafter
  function emitMenu(action) { for (const fn of menuCbs) { try { fn(action); } catch (e) {} } }

  function pollMenu(pad, now) {
    if (!controllerEnabled || !pad || !menuCbs.length) { menuPrev = {}; repeatDir = null; return; }
    const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const state = {
      up: ay < -0.5 || btn(12),
      down: ay > 0.5 || btn(13),
      left: ax < -0.5 || btn(14),
      right: ax > 0.5 || btn(15),
      confirm: btn(0),
      back: btn(1),
      start: btn(9),
      tabPrev: btn(4),
      tabNext: btn(5),
    };
    // any input on the pad means the player is now driving with a controller
    for (const k in state) { if (state[k]) { setInputMode('controller'); break; } }
    for (const a of ['confirm', 'back', 'start', 'tabPrev', 'tabNext']) {
      if (state[a] && !menuPrev[a]) emitMenu(a);
    }
    const dir = state.up ? 'up' : state.down ? 'down' : state.left ? 'left' : state.right ? 'right' : null;
    if (dir) {
      if (dir !== repeatDir) { repeatDir = dir; repeatStart = now; repeatCount = 0; emitMenu(dir); }
      else {
        const elapsed = now - repeatStart;
        if (elapsed >= REPEAT_DELAY_MS) {
          const due = 1 + Math.floor((elapsed - REPEAT_DELAY_MS) / REPEAT_INT_MS);
          if (due > repeatCount) { repeatCount = due; emitMenu(dir); }
        }
      }
    } else { repeatDir = null; }
    menuPrev = state;
  }

  // ---- Input-mode + controller-family detection (for on-screen glyphs) ----
  // 'keyboard' | 'controller', tracked by whichever device was used last so the
  // UI can show the right button prompts. Family is inferred from the pad id.
  let inputMode = 'keyboard';
  let padType = 'generic'; // 'xbox' | 'playstation' | 'generic'
  const modeCbs = [];
  function detectPadType(id) {
    const s = (id || '').toLowerCase();
    if (/dualsense|dualshock|playstation|054c|wireless controller|sony/.test(s)) return 'playstation';
    if (/xbox|xinput|microsoft|045e|steam|valve/.test(s)) return 'xbox';
    return 'xbox'; // standard-mapping default that most pads (incl. Steam Deck) match
  }
  function applyBodyClasses() {
    const b = document.body;
    if (!b) return;
    b.classList.toggle('im-controller', inputMode === 'controller');
    b.classList.toggle('im-keyboard', inputMode !== 'controller');
    b.classList.remove('pad-xbox', 'pad-playstation', 'pad-generic');
    b.classList.add('pad-' + padType);
  }
  function setInputMode(mode) {
    if (mode === inputMode) return;
    inputMode = mode;
    applyBodyClasses();
    for (const fn of modeCbs) { try { fn(inputMode, padType); } catch (e) {} }
  }
  // Keyboard / mouse usage flips back to keyboard prompts.
  window.addEventListener('keydown', () => setInputMode('keyboard'), true);
  window.addEventListener('mousemove', () => setInputMode('keyboard'), { passive: true });
  window.addEventListener('gamepadconnected', (e) => {
    if (e.gamepad) padType = detectPadType(e.gamepad.id);
    setInputMode('controller');
    applyBodyClasses();
  });
  if (typeof document !== 'undefined') {
    if (document.body) applyBodyClasses();
    else document.addEventListener('DOMContentLoaded', applyBodyClasses);
  }

  function pollGamepad(now) {
    if (!controllerEnabled || !navigator.getGamepads) { requestAnimationFrame(pollGamepad); return; }
    const pads = navigator.getGamepads();
    let pad = null;
    for (const p of pads) { if (p && p.connected) { pad = p; break; } }
    const nextVirt = {};
    if (pad) {
      if (pad.id !== gpName) padType = detectPadType(pad.id);
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
    pollMenu(pad, now || (typeof performance !== 'undefined' ? performance.now() : Date.now()));
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
    // register a handler for controller menu-navigation events
    // (up|down|left|right|confirm|back|start|tabPrev|tabNext)
    onMenuNav: (fn) => { if (typeof fn === 'function') menuCbs.push(fn); },
    // 'keyboard' | 'controller' — which device the player used most recently
    inputMode: () => inputMode,
    // 'xbox' | 'playstation' | 'generic'
    padType: () => padType,
    // notified (mode, padType) whenever the active input device changes
    onInputModeChange: (fn) => { if (typeof fn === 'function') modeCbs.push(fn); },
    // while true, keydown is ignored so a remap dialog can capture the raw key
    setCapturing: (on) => { capturing = !!on; },
  };
})();
