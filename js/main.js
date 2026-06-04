// Wire everything together
(function () {
  initSettingsUI();
  Profiles.load();
  Audio2.setVolumes(Settings.data.musicVol, Settings.data.sfxVol);

  // Unlock audio + play a click on any button press (browser autoplay policy)
  document.addEventListener('pointerdown', (e) => {
    Audio2.resume();
    if (e.target.closest('button')) Audio2.sfx.ui();
  });

  const canvas = document.getElementById('game');
  const hud = document.getElementById('hud');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');

  const game = new Game(canvas, Settings.data);
  game.resize();
  window.addEventListener('resize', () => game.resize());

  function startGame() {
    game.settings = Settings.data; // pick up latest settings
    Screens.hideAll();
    hud.classList.add('active');
    Input.clear();
    game.start();
    Audio2.startMusic();
  }

  function toMenu() {
    game.state = 'idle';
    hud.classList.remove('active');
    overlay.classList.remove('active');
    Audio2.stopMusic();
    updateChip();
    Screens.show('menu');
  }

  // ---- PROFILE CHIP / HUD best ----
  function updateChip() {
    const p = Profiles.current();
    if (!p) return;
    document.getElementById('chipName').textContent = p.name;
    document.getElementById('chipCoins').textContent = p.coins;
    document.getElementById('hudBest').textContent = p.best;
    renderLevel();
  }

  // Prestige button on the main menu
  document.getElementById('prestigeBtn').addEventListener('click', () => {
    const pr = Profiles.progress();
    if (!pr || !pr.canPrestige) return;
    if (confirm('Prestige now? This resets you to Level 1 and adds a Prestige star.')) {
      const res = Profiles.prestige();
      if (res.ok) { Audio2.sfx.coin(); renderLevel(); }
    }
  });

  // ---- LOGIN ----
  function openLogin() {
    Audio2.stopMusic();
    renderProfiles(pickProfile);
    document.getElementById('loginError').textContent = '';
    Screens.show('login');
  }
  function pickProfile(name) {
    Profiles.setCurrent(name);
    updateChip();
    toMenu();
  }
  document.querySelector('#login [data-action="create"]').addEventListener('click', () => {
    const input = document.getElementById('newProfileName');
    const name = input.value.trim().slice(0, 16);
    const res = Profiles.create(name);
    const err = document.getElementById('loginError');
    if (!res.ok) { err.textContent = res.error; return; }
    err.textContent = '';
    input.value = '';
    pickProfile(name);
  });
  document.getElementById('newProfileName').addEventListener('keydown', (e) => {
    if (e.code === 'Enter') document.querySelector('#login [data-action="create"]').click();
  });

  // ---- SHOP ----
  let shopTab = 'buffs';
  const shopHandlers = {
    buyUpgrade(id) {
      const res = Profiles.buy(id);
      if (res.ok) Audio2.sfx.coin();
      refreshShop();
    },
    buyCosmetic(type, id) {
      const res = Profiles.buyCosmetic(type, id);
      if (res.ok) { Audio2.sfx.coin(); Profiles.equip(type, id); } // auto-equip on purchase
      refreshShop();
    },
    equip(type, id) {
      Profiles.equip(type, id);
      Audio2.sfx.ui();
      refreshShop();
    },
  };
  function refreshShop() {
    renderShop(shopTab, shopHandlers);
    updateChip();
  }
  function openShop() {
    refreshShop();
    Screens.show('shop');
  }
  document.getElementById('shopTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-tab');
    if (!btn) return;
    shopTab = btn.dataset.tab;
    refreshShop();
  });
  document.querySelector('#shop .back-btn').addEventListener('click', () => Screens.show('menu'));

  const resumeBtn = overlay.querySelector('[data-action="resume"]');
  function showOverlay(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub || '';
    // Resume only makes sense when paused, not on Game Over
    resumeBtn.style.display = (game.state === 'dead') ? 'none' : 'block';
    overlay.classList.add('active');
  }

  game.onDeath = (dist, coins) => {
    const isBest = Profiles.recordRun(dist); // also persists
    // award XP from the run: distance + a bonus per coin
    const xpGain = dist + coins * 2;
    const xpRes = Profiles.addXp(xpGain);
    updateChip();
    let sub = `Distance ${dist}m  ·  +${coins} coins  ·  +${xpGain} XP`;
    if (isBest) {
      document.getElementById('hudBest').textContent = dist;
      sub = `NEW BEST! ${dist}m  ·  +${coins} coins  ·  +${xpGain} XP`;
    }
    if (xpRes && xpRes.leveledUp) sub += `  ·  LEVEL UP → ${xpRes.level}!`;
    setTimeout(() => showOverlay('GAME OVER', sub), 500);
  };

  // ---- MAIN MENU buttons ----
  document.querySelector('#menu .menu-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'play') startGame();
    else if (action === 'shop') openShop();
    else if (action === 'settings') Screens.show('settings');
    else if (action === 'quit') quitGame();
  });

  // ---- SWITCH PROFILE (chip) ----
  document.getElementById('profileChip').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="switch"]')) { Profiles.logout(); openLogin(); }
  });

  // ---- SETTINGS back ----
  document.querySelector('#settings .back-btn').addEventListener('click', () => {
    Screens.show('menu');
  });

  // ---- PAUSE button ----
  document.getElementById('pauseBtn').addEventListener('click', () => {
    if (game.state === 'playing') { game.pause(); Audio2.stopMusic(); showOverlay('PAUSED', ''); }
  });

  // ---- OVERLAY buttons ----
  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'resume') {
      overlay.classList.remove('active');
      if (game.state === 'dead') startGame(); // safety: never freeze on death
      else { game.resume(); Audio2.startMusic(); }
    } else if (action === 'restart') {
      overlay.classList.remove('active');
      startGame();
    } else if (action === 'menu') {
      toMenu();
    }
  });

  // ---- ESC to pause ----
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (game.state === 'playing') { game.pause(); Audio2.stopMusic(); showOverlay('PAUSED', ''); }
      else if (game.state === 'paused') { overlay.classList.remove('active'); game.resume(); Audio2.startMusic(); }
    }
  });

  function quitGame() {
    // In the desktop (Electron) build, window.close() cleanly quits the app.
    if (window.desktop && window.desktop.isDesktop) { window.close(); return; }
    // Browsers block window.close() for non-script-opened tabs; show a friendly screen.
    const closed = window.open('', '_self');
    try { window.close(); } catch (e) {}
    document.body.innerHTML =
      '<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Orbitron,sans-serif;color:#2ee6ff;background:#070b18;text-align:center;gap:18px">' +
      '<h1 style="letter-spacing:6px">THANKS FOR PLAYING</h1>' +
      '<p style="color:#e8f0ff;letter-spacing:2px;font-family:Rajdhani">You can close this tab now.</p>' +
      '<button onclick="location.reload()" style="margin-top:10px;padding:12px 26px;border-radius:10px;border:2px solid #2ee6ff;background:transparent;color:#2ee6ff;font-family:Rajdhani;font-size:18px;font-weight:700;letter-spacing:2px;cursor:pointer">Play Again</button>' +
      '</div>';
  }

  // ---- DESKTOP AUTO-UPDATE TOAST ----
  if (window.desktop && window.desktop.isDesktop) {
    window.desktop.onUpdateReady(() => {
      const toast = document.createElement('div');
      toast.className = 'update-toast';
      toast.innerHTML = '<span>A new version is ready.</span><button id="updateNow">Restart &amp; Update</button>';
      document.body.appendChild(toast);
      document.getElementById('updateNow').addEventListener('click', () => window.desktop.installUpdate());
    });
  }

  // ---- BOOT ----
  openLogin();
})();
