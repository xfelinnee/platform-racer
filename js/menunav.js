// Reusable keyboard + controller navigation for the DOM menus.
//
// One system drives every screen instead of per-screen logic: it looks at the
// active screen, collects the visible/enabled focusable elements inside it,
// tracks a focused element, and moves focus geometrically (spatial navigation)
// so it works for vertical button stacks, horizontal segmented rows, tab bars
// and grids alike. Activation clicks the focused element; sliders adjust on
// left/right; Back routes to the screen's existing Back button / overlay
// buttons so no per-screen behaviour is duplicated. Mouse input is untouched.
const MenuNav = (() => {
  // Native controls + the clickable <div>s used around the UI.
  const FOCUS_SEL = [
    'button:not([disabled])',
    'input[type="range"]',
    'input[type="text"]',
    '.profile-row',
    '.mode-btn',
    '.swatch',
    '.cz-item',
    '.nav-scroll',
  ].join(', ');

  let current = null;    // currently focused element
  let navActive = false; // whether the highlight is currently shown
  let lastCtxId = null;

  function isVisible(el) {
    if (!el || el.disabled) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    // display:none ancestors report a null offsetParent
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return true;
  }

  // Topmost interactive screen: a confirm dialog wins over the pause/gameover
  // overlay, which wins over any regular screen. null == in gameplay (no menu).
  function activeContext() {
    const conf = document.getElementById('confirm');
    if (conf && conf.classList.contains('active')) return conf;
    const ov = document.getElementById('overlay');
    if (ov && ov.classList.contains('active')) return ov;
    const screens = document.querySelectorAll('.screen.active');
    for (const s of screens) if (s.id !== 'overlay' && s.id !== 'confirm') return s;
    return null;
  }

  function focusables(ctx) {
    if (!ctx) return [];
    // Tabs (.shop-tab) are intentionally excluded — they're switched only with
    // the shoulder buttons (L1/R1 / LB/RB) or the [ ] keys, never the D-pad.
    return Array.from(ctx.querySelectorAll(FOCUS_SEL))
      .filter((el) => !el.classList.contains('shop-tab') && !el.classList.contains('tab-hint'))
      .filter(isVisible);
  }

  function defaultFor(ctx, list) {
    if (!ctx || !list.length) return list[0] || null;
    if (ctx.id === 'menu') {
      const b = ctx.querySelector('.menu-buttons .btn');
      if (b && list.includes(b)) return b;
    }
    if (ctx.id === 'overlay') {
      const r = ctx.querySelector('[data-action="resume"]');
      if (r && isVisible(r) && list.includes(r)) return r;
    }
    return list[0];
  }

  function setCurrent(el) {
    if (current && current !== el) current.classList.remove('nav-focus');
    current = el || null;
    if (current) {
      current.classList.add('nav-focus');
      navActive = true;
      try { current.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    } else {
      navActive = false;
    }
  }

  // Standard spatial pick: among candidates lying in `dir`, prefer the smallest
  // travel along the axis plus a penalty for perpendicular offset.
  function pickSpatial(from, list, dir) {
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === from) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      let primary, perp;
      if (dir === 'left') { if (dx > -1) continue; primary = -dx; perp = Math.abs(dy); }
      else if (dir === 'right') { if (dx < 1) continue; primary = dx; perp = Math.abs(dy); }
      else if (dir === 'up') { if (dy > -1) continue; primary = -dy; perp = Math.abs(dx); }
      else { if (dy < 1) continue; primary = dy; perp = Math.abs(dx); }
      const score = primary + perp * 2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  // A `.nav-scroll` element (e.g. the What's New detail pane) has no focusable
  // children, so up/down should scroll it while it's the focused element.
  function isScrollable(el) {
    return !!(el && el.classList && el.classList.contains('nav-scroll')
      && el.scrollHeight > el.clientHeight + 1);
  }
  // Returns true if it actually scrolled; false at the top/bottom edge so the
  // caller can fall through to normal spatial navigation and leave the pane.
  function scrollPane(el, dir) {
    const max = el.scrollHeight - el.clientHeight;
    const step = Math.max(48, Math.round(el.clientHeight * 0.4));
    const before = el.scrollTop;
    const v = Math.max(0, Math.min(max, before + (dir === 'down' ? step : -step)));
    if (v === before) return false;
    el.scrollTop = v;
    return true;
  }

  function adjustSlider(el, dir) {
    const step = +el.step || 1;
    const min = el.min !== '' ? +el.min : 0;
    const max = el.max !== '' ? +el.max : 100;
    let v = (+el.value) + (dir === 'right' ? step : -step);
    v = Math.max(min, Math.min(max, v));
    if (v === +el.value) return;
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function move(dir) {
    const ctx = activeContext();
    const list = focusables(ctx);
    if (!list.length) { setCurrent(null); return; }
    if (!current || !list.includes(current)) { setCurrent(defaultFor(ctx, list)); return; }
    // First nav after using the mouse just re-reveals the current selection.
    if (!navActive) { setCurrent(current); return; }
    if (current.tagName === 'INPUT' && current.type === 'range' && (dir === 'left' || dir === 'right')) {
      adjustSlider(current, dir);
      return;
    }
    // Scroll a focused content pane with up/down; only leave it at an edge.
    if ((dir === 'up' || dir === 'down') && isScrollable(current) && scrollPane(current, dir)) {
      return;
    }
    const next = pickSpatial(current, list, dir);
    if (next) setCurrent(next);
  }

  function confirm() {
    const ctx = activeContext();
    if (!ctx) return;
    const list = focusables(ctx);
    if (!current || !list.includes(current)) { setCurrent(defaultFor(ctx, list)); return; }
    if (current.tagName === 'INPUT') {
      if (current.type === 'text') { current.focus(); }
      return; // range: adjusted with left/right, not confirm
    }
    const idx = list.indexOf(current);
    current.click();
    // Re-rendering screens (shop/customize) replace the focused node; keep the
    // selection roughly in place afterwards.
    setTimeout(() => {
      const l = focusables(activeContext());
      if (l.length && (!current || !l.includes(current))) setCurrent(l[Math.min(idx, l.length - 1)]);
    }, 0);
  }

  function back() {
    const conf = document.getElementById('confirm');
    if (conf && conf.classList.contains('active')) {
      const b = conf.querySelector('[data-action="confirm-no"]');
      if (b) b.click();
      return;
    }
    const ov = document.getElementById('overlay');
    if (ov && ov.classList.contains('active')) {
      const resume = ov.querySelector('[data-action="resume"]');
      if (resume && isVisible(resume)) resume.click();
      else { const m = ov.querySelector('[data-action="menu"]'); if (m) m.click(); }
      return;
    }
    const ctx = activeContext();
    if (ctx) {
      const bb = ctx.querySelector('.back-btn');
      if (bb) { bb.click(); return; }
      return; // top-level screen (login / main menu): Back does nothing
    }
    // In gameplay: Back acts as Pause.
    const hud = document.getElementById('hud');
    if (hud && hud.classList.contains('active')) {
      const pb = document.getElementById('pauseBtn');
      if (pb) pb.click();
    }
  }

  // Pause/resume toggle (KeyP + controller Start) — only affects gameplay and
  // the pause overlay, never regular menu panels.
  function pauseToggle() {
    const ov = document.getElementById('overlay');
    if (ov && ov.classList.contains('active')) {
      const r = ov.querySelector('[data-action="resume"]');
      if (r && isVisible(r)) r.click();
      return;
    }
    if (activeContext()) return; // in a menu panel: ignore
    const pb = document.getElementById('pauseBtn');
    if (pb) pb.click();
  }

  function switchTab(dir) {
    const ctx = activeContext();
    if (!ctx) return;
    const bar = ctx.querySelector('.shop-tabs');
    if (!bar) return;
    const tabs = Array.from(bar.querySelectorAll('.shop-tab')).filter(isVisible);
    if (!tabs.length) return;
    let idx = tabs.findIndex((t) => t.classList.contains('on'));
    if (idx < 0) idx = 0;
    idx = (idx + (dir === 'next' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[idx].click();
    setTimeout(() => { const l = focusables(activeContext()); setCurrent(l[0] || null); }, 0);
  }

  // ---- On-screen button prompts (keyboard labels vs controller glyphs) ----
  const padOf = () => (typeof Input !== 'undefined' && Input.padType) ? Input.padType() : 'xbox';
  const modeOf = () => (typeof Input !== 'undefined' && Input.inputMode) ? Input.inputMode() : 'keyboard';

  function padGlyph(kind) {
    const ps = padOf() === 'playstation';
    switch (kind) {
      case 'confirm': return ps ? '<span class="gbtn gbtn-cross">\u2715</span>' : '<span class="gbtn gbtn-a">A</span>';
      case 'back': return ps ? '<span class="gbtn gbtn-circle">\u25CB</span>' : '<span class="gbtn gbtn-b">B</span>';
      case 'tabPrev': return '<span class="gpill">' + (ps ? 'L1' : 'LB') + '</span>';
      case 'tabNext': return '<span class="gpill">' + (ps ? 'R1' : 'RB') + '</span>';
    }
    return '';
  }
  function keyGlyph(kind) {
    switch (kind) {
      case 'confirm': return '<span class="gkey">Enter</span>';
      case 'back': return '<span class="gkey">Esc</span>';
      case 'tabPrev': return '<span class="gkey">[</span>';
      case 'tabNext': return '<span class="gkey">]</span>';
    }
    return '';
  }
  const glyph = (kind) => (modeOf() === 'controller' ? padGlyph(kind) : keyGlyph(kind));

  let hintsEl = null;
  function ensureHintBar() {
    if (hintsEl) return hintsEl;
    const app = document.getElementById('app');
    if (!app) return null;
    hintsEl = document.createElement('div');
    hintsEl.className = 'nav-hints';
    app.appendChild(hintsEl);
    return hintsEl;
  }

  function updateHints() {
    const bar = ensureHintBar();
    if (!bar) return;
    const ctx = activeContext();
    // hidden in gameplay, and on the main menu / login (they carry their own footer)
    if (!ctx || ctx.id === 'menu' || ctx.id === 'login') { bar.style.display = 'none'; return; }
    const hasTabs = !!ctx.querySelector('.shop-tabs');
    const hasBack = !!ctx.querySelector('.back-btn') || ctx.id === 'overlay' || ctx.id === 'confirm';
    let html = `<span class="nav-hint">${glyph('confirm')}<span class="nh-label">Select</span></span>`;
    if (hasTabs) html += `<span class="nav-hint">${glyph('tabPrev')}${glyph('tabNext')}<span class="nh-label">Switch Tabs</span></span>`;
    if (hasBack) html += `<span class="nav-hint">${glyph('back')}<span class="nh-label">Back</span></span>`;
    bar.innerHTML = html;
    bar.style.display = '';
  }

  // L1/R1 (LB/RB) badges flanking every tab bar; visible only in controller mode
  // (toggled by the body.im-controller class in CSS).
  function buildTabHints() {
    document.querySelectorAll('.shop-tabs').forEach((bar) => {
      if (bar.querySelector('.tab-hint')) return;
      const prev = document.createElement('button');
      prev.className = 'tab-hint tab-hint-prev';
      prev.tabIndex = -1;
      prev.addEventListener('click', () => switchTab('prev'));
      const next = document.createElement('button');
      next.className = 'tab-hint tab-hint-next';
      next.tabIndex = -1;
      next.addEventListener('click', () => switchTab('next'));
      bar.insertBefore(prev, bar.firstChild);
      bar.appendChild(next);
    });
    refreshTabHintGlyphs();
  }
  function refreshTabHintGlyphs() {
    document.querySelectorAll('.tab-hint-prev').forEach((e) => { e.innerHTML = padGlyph('tabPrev'); });
    document.querySelectorAll('.tab-hint-next').forEach((e) => { e.innerHTML = padGlyph('tabNext'); });
  }

  // Reset focus to a sensible default whenever the active screen changes.
  function onContextMaybeChanged() {
    const ctx = activeContext();
    const id = ctx ? ctx.id : null;
    if (id !== lastCtxId) {
      lastCtxId = id;
      if (ctx) setCurrent(defaultFor(ctx, focusables(ctx)));
      else setCurrent(null);
    }
    updateHints();
  }

  // ---- Keyboard ----
  window.addEventListener('keydown', (e) => {
    // While remapping a key, the capture handler owns the keyboard.
    if (document.querySelector('.key-btn.capturing')) return;
    const ae = document.activeElement;
    const typing = ae && ((ae.tagName === 'INPUT' && ae.type === 'text') || ae.tagName === 'TEXTAREA');

    if (e.code === 'Escape') {
      if (typing) { ae.blur(); return; }
      e.preventDefault();
      back();
      return;
    }
    if (e.code === 'KeyP') {
      if (typing) return;
      e.preventDefault();
      pauseToggle();
      return;
    }
    if (typing) return;
    if (!activeContext()) return; // gameplay: leave movement keys to the game

    switch (e.code) {
      case 'ArrowUp': case 'KeyW': e.preventDefault(); move('up'); break;
      case 'ArrowDown': case 'KeyS': e.preventDefault(); move('down'); break;
      case 'ArrowLeft': case 'KeyA': e.preventDefault(); move('left'); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); move('right'); break;
      case 'Enter': case 'Space': e.preventDefault(); confirm(); break;
      case 'BracketLeft': e.preventDefault(); switchTab('prev'); break;
      case 'BracketRight': e.preventDefault(); switchTab('next'); break;
    }
  });

  // Keep the nav cursor in sync with mouse clicks, but let the mouse hide the
  // highlight so the two input styles don't fight visually.
  document.addEventListener('pointerdown', (e) => {
    const f = e.target.closest(FOCUS_SEL);
    const ctx = activeContext();
    if (f && ctx && ctx.contains(f)) {
      if (current && current !== f) current.classList.remove('nav-focus');
      current = f;
    }
    navActive = false;
  }, true);
  window.addEventListener('mousemove', () => {
    if (navActive && current) current.classList.remove('nav-focus');
    navActive = false;
  }, { passive: true });

  // ---- Controller ----
  if (typeof Input !== 'undefined' && Input.onMenuNav) {
    Input.onMenuNav((action) => {
      switch (action) {
        case 'up': case 'down': case 'left': case 'right':
          if (activeContext()) move(action);
          break;
        case 'confirm':
          if (activeContext()) confirm();
          break;
        case 'back':
          if (activeContext()) back(); // in gameplay B stays a game action
          break;
        case 'start':
          pauseToggle();
          break;
        case 'tabPrev': switchTab('prev'); break;
        case 'tabNext': switchTab('next'); break;
      }
    });
  }

  // Swap prompts between keyboard labels and controller glyphs on device change.
  if (typeof Input !== 'undefined' && Input.onInputModeChange) {
    Input.onInputModeChange(() => { refreshTabHintGlyphs(); updateHints(); });
  }

  // Detect screen changes without touching Screens.show()/overlay callers.
  const mo = new MutationObserver(onContextMaybeChanged);
  document.querySelectorAll('.screen').forEach((s) =>
    mo.observe(s, { attributes: true, attributeFilter: ['class'] }));
  buildTabHints();
  onContextMaybeChanged();

  return { back, refresh: onContextMaybeChanged };
})();
