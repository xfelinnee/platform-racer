// Wire everything together
(function () {
  initSettingsUI();
  Profiles.load();

  // Stamp the real app version into the footer. On desktop this comes from
  // package.json via Electron, so the displayed version always matches the
  // installed build and never needs manual editing.
  try {
    const verTag = document.getElementById('verTag');
    if (verTag && window.desktop && window.desktop.appVersion) {
      verTag.textContent = 'v' + window.desktop.appVersion;
    }
  } catch (e) { /* ignore */ }
  // initSettingsUI() already ran Settings.apply(), which pushes every audio/graphics/
  // input setting into the live systems. Nothing more to prime here.

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

  // Fit the fixed 16:9 stage into the window (letterbox/pillarbox when off-aspect).
  // `zoom` (not `transform: scale`) so the DOM UI re-rasterizes at the final
  // size — text and menus stay pixel-crisp at any window size instead of being
  // a downscaled bitmap.
  function fitStage() {
    const app = document.getElementById('app');
    if (!app) return;
    const s = Math.min(window.innerWidth / 2560, window.innerHeight / 1440);
    app.style.zoom = s;
  }
  fitStage();
  window.addEventListener('resize', () => { fitStage(); game.resize(); });

  // ---- WINDOW FOCUS (pause on focus lost / mute when unfocused) ----
  window.addEventListener('blur', () => {
    if (Settings.data.muteWhenUnfocused) Audio2.setMuted(true);
    if (Settings.data.pauseOnFocusLost && game.state === 'playing') {
      game.pause();
      Audio2.stopMusic();
      showOverlay('PAUSED', '');
    }
  });
  window.addEventListener('focus', () => {
    if (Settings.data.muteWhenUnfocused) Audio2.setMuted(false);
  });

  // Achievement unlocks (from anywhere: mid-run, run end, shop) pop as toasts.
  if (typeof Achievements !== 'undefined') Achievements.setOnUnlock(showAchievementToasts);

  function startGame() {
    game.settings = Settings.data; // pick up latest settings
    Screens.hideAll();
    hud.classList.add('active');
    Input.clear();
    game.start();
    Audio2.startMusic();
    maybeShowTutorialTip();
  }

  // Brief control hint at the start of a run (General > Show Tutorial Tips).
  let _tipTimer = null;
  function maybeShowTutorialTip() {
    const tip = document.getElementById('tutorialTip');
    if (!tip) return;
    if (!Settings.data.tutorialTips) { tip.classList.remove('show'); return; }
    // reflect the player's actual key bindings rather than hard-coded keys
    const kb = Settings.data.keybinds || Input.getBindings();
    const primary = (a) => keyLabel((kb[a] || [])[0]);
    tip.textContent = `Move ${primary('left')} / ${primary('right')}  \u00b7  Jump ${primary('jump')}  \u00b7  Duck ${primary('duck')}`;
    tip.classList.add('show');
    if (_tipTimer) clearTimeout(_tipTimer);
    _tipTimer = setTimeout(() => { tip.classList.remove('show'); _tipTimer = null; }, 4500);
  }

  function startDailyChallenge() {
    game.settings = Settings.data;
    Screens.hideAll();
    hud.classList.add('active');
    Input.clear();
    game.startDaily();
    Audio2.startMusic();
  }

  function toMenu() {
    game.state = 'idle';
    hud.classList.remove('active');
    overlay.classList.remove('active');
    const tip = document.getElementById('tutorialTip');
    if (tip) tip.classList.remove('show');
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
    const hudBestEl = document.getElementById('hudBest');
    hudBestEl.textContent = p.best;
    hudBestEl.classList.remove('hud-newbest');
    renderLevel();
    renderMenuCharacter();
    updateHardFlag();
  }

  // Show the "Hard Mode 500 Coins Risk" warning on the menu only when Hard is selected.
  function updateHardFlag() {
    const flag = document.getElementById('hardFlag');
    if (flag) flag.style.display = (Settings.data.difficulty === 'hard') ? 'inline-flex' : 'none';
  }

  // ---- IN-GAME CONFIRM DIALOG ----
  const confirmScreen = document.getElementById('confirm');
  let confirmCb = null;
  function uiConfirm(opts, cb) {
    document.getElementById('confirmTitle').textContent = opts.title || 'CONFIRM';
    document.getElementById('confirmMsg').textContent = opts.message || '';
    document.getElementById('confirmYes').textContent = opts.yes || 'Confirm';
    document.getElementById('confirmNo').textContent = opts.no || 'Cancel';
    confirmCb = cb;
    confirmScreen.classList.add('active');
  }
  window.uiConfirm = uiConfirm; // expose for other modules (e.g. profile delete)
  function closeConfirm(result) {
    confirmScreen.classList.remove('active');
    const cb = confirmCb;
    confirmCb = null;
    if (cb) cb(result);
  }
  confirmScreen.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'confirm-yes') closeConfirm(true);
    else if (btn.dataset.action === 'confirm-no') closeConfirm(false);
  });

  // Prestige button on the main menu
  document.getElementById('prestigeBtn').addEventListener('click', () => {
    const pr = Profiles.progress();
    if (!pr || !pr.canPrestige) return;
    uiConfirm({
      title: 'PRESTIGE \u2605',
      message: 'Prestige now? This resets you to Level 1 and adds a Prestige star.',
      yes: 'Prestige',
      no: 'Cancel',
    }, (ok) => {
      if (!ok) return;
      const res = Profiles.prestige();
      if (res.ok) { Audio2.sfx.coin(); renderLevel(); }
    });
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
    // veteran profiles may already qualify for achievements added later
    if (typeof Achievements !== 'undefined') Achievements.evaluate();
    updateChip();
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
  // Optionally require an explicit confirmation before any coin purchase.
  function guardSpend(run) {
    if (!Settings.data.confirmSpend) { run(); return; }
    uiConfirm({ title: 'CONFIRM PURCHASE', message: 'Spend coins on this item?', yes: 'Buy', no: 'Cancel' },
      (ok) => { if (ok) run(); });
  }
  const shopHandlers = {
    buyUpgrade(id) {
      guardSpend(() => {
        const res = Profiles.buy(id);
        if (res.ok) Audio2.sfx.coin();
        refreshShop();
      });
    },
    toggleBuff(id) {
      Profiles.toggleBuff(id);
      Audio2.sfx.ui();
      refreshShop();
    },
    buyCosmetic(type, id) {
      guardSpend(() => {
        const res = Profiles.buyCosmetic(type, id);
        if (res.ok) { Audio2.sfx.coin(); Profiles.equip(type, id); } // auto-equip on purchase
        refreshShop();
      });
    },
    equip(type, id) {
      Profiles.equip(type, id);
      Audio2.sfx.ui();
      refreshShop();
    },
    buyColor(id) {
      const res = Profiles.buyColor(id);
      if (res.ok) Audio2.sfx.coin();
      refreshShop();
      return res;
    },
    setBodyColor(id) {
      Profiles.setBodyColor(id);
      Audio2.sfx.ui();
      refreshShop();
    },
    refreshColors() {
      refreshShop();
    },
    setItemColor(type, id, colorId) {
      Profiles.setItemColor(type, id, colorId);
      Audio2.sfx.ui();
      refreshShop();
    },
    setBodySkin(id) {
      Profiles.setBodySkin(id);
      Audio2.sfx.ui();
      refreshShop();
    },
    setItemSkin(type, id, skinId) {
      Profiles.setItemSkin(type, id, skinId);
      Audio2.sfx.ui();
      refreshShop();
    },
    buySkin(id) {
      const res = Profiles.buySkin(id);
      if (res.ok) Audio2.sfx.coin();
      refreshShop();
      return res;
    },
    buyConsumable(id) {
      guardSpend(() => {
        const res = Profiles.buyConsumable(id);
        if (res.ok) Audio2.sfx.coin();
        refreshShop();
      });
    },
    armCoinDoubler() {
      Profiles.setCoinDoublerArmed(!Profiles.coinDoublerArmed());
      Audio2.sfx.ui();
      refreshShop();
    },
    buyTrail(id) {
      guardSpend(() => {
        const res = Profiles.buyTrail(id);
        if (res.ok) { Audio2.sfx.coin(); Profiles.equipTrail(id); } // auto-equip on purchase
        refreshShop();
      });
    },
    equipTrail(id) {
      Profiles.equipTrail(id);
      Audio2.sfx.ui();
      refreshShop();
    },
  };
  function refreshShop() {
    // purchases can complete a collection — evaluate before re-rendering balances
    if (typeof Achievements !== 'undefined') Achievements.evaluate();
    renderShop(shopTab, shopHandlers);
    updateChip();
  }
  function openShop() {
    resetShopColorPreview();
    refreshShop();
    Screens.show('shop');
  }
  document.getElementById('shopTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-tab');
    if (!btn) return;
    shopTab = btn.dataset.tab;
    resetShopColorPreview();
    refreshShop();
  });
  document.querySelector('#shop .back-btn').addEventListener('click', () => Screens.show('menu'));

  // ---- PROFILE ----
  const PROFILE_PANES = {
    overview: 'profileTabOverview',
    achievements: 'profileTabAchievements',
    collection: 'profileTabCollection',
  };
  function setProfileTab(tab) {
    if (!PROFILE_PANES[tab]) tab = 'overview';
    document.querySelectorAll('#profileTabs .shop-tab').forEach((b) =>
      b.classList.toggle('on', b.dataset.tab === tab));
    for (const k in PROFILE_PANES) {
      document.getElementById(PROFILE_PANES[k]).style.display = (k === tab) ? '' : 'none';
    }
  }
  document.getElementById('profileTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-tab');
    if (btn) setProfileTab(btn.dataset.tab);
  });
  function openProfile(tab) {
    renderProfile();
    setProfileTab(tab || 'overview');
    Screens.show('profile');
  }
  document.querySelector('#profile .back-btn').addEventListener('click', () => Screens.show('menu'));

  // ---- CUSTOMIZE (quick equip) ----
  const customizeHandlers = {
    equip(type, id) { Profiles.equip(type, id); Audio2.sfx.ui(); renderCustomize(customizeHandlers); renderMenuCharacter(); },
    setBodyColor(id) { Profiles.setBodyColor(id); Audio2.sfx.ui(); renderCustomize(customizeHandlers); renderMenuCharacter(); },
    equipTrail(id) { Profiles.equipTrail(id); Audio2.sfx.ui(); renderCustomize(customizeHandlers); renderMenuCharacter(); },
  };
  function openCustomize() {
    renderCustomize(customizeHandlers);
    Screens.show('customize');
  }
  document.querySelector('#customize .back-btn').addEventListener('click', () => { Screens.show('menu'); renderMenuCharacter(); });

  const resumeBtn = overlay.querySelector('[data-action="resume"]');
  const overlayBest = document.getElementById('overlayBest');
  const overlayStats = document.getElementById('overlayStats');

  // ---- IN-GAME PAUSE SETTINGS (music / sfx / particles — NO difficulty mid-run) ----
  const pauseSettings = document.getElementById('pauseSettings');
  const pMusic = document.getElementById('pauseMusicVol');
  const pSfx = document.getElementById('pauseSfxVol');
  const pMusicVal = document.getElementById('pauseMusicVolVal');
  const pSfxVal = document.getElementById('pauseSfxVolVal');

  // mirror the current saved settings into the pause panel controls
  function syncPauseSettings() {
    const d = Settings.data;
    pMusic.value = d.musicVol; pMusicVal.textContent = d.musicVol;
    pSfx.value = d.sfxVol; pSfxVal.textContent = d.sfxVol;
    document.querySelectorAll('#pauseParticles button').forEach(b =>
      b.classList.toggle('on', b.dataset.val === (d.particles ? 'on' : 'off')));
  }

  pMusic.addEventListener('input', () => {
    const d = Settings.data;
    d.musicVol = +pMusic.value;
    pMusicVal.textContent = pMusic.value;
    Audio2.setVolumes(d.musicVol, d.sfxVol);
    Settings.save();
    // keep the main Settings screen controls in sync
    const m = document.getElementById('musicVol');
    if (m) { m.value = d.musicVol; document.getElementById('musicVolVal').textContent = d.musicVol; }
  });
  pSfx.addEventListener('input', () => {
    const d = Settings.data;
    d.sfxVol = +pSfx.value;
    pSfxVal.textContent = pSfx.value;
    Audio2.setVolumes(d.musicVol, d.sfxVol);
    Settings.save();
    const s = document.getElementById('sfxVol');
    if (s) { s.value = d.sfxVol; document.getElementById('sfxVolVal').textContent = d.sfxVol; }
  });
  document.getElementById('pauseParticles').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = Settings.data;
    d.particles = (b.dataset.val === 'on');
    Settings.save();
    game.settings = Settings.data;
    syncPauseSettings();
    // keep the main Settings screen toggle in sync
    document.querySelectorAll('#particles button').forEach(x =>
      x.classList.toggle('on', x.dataset.val === b.dataset.val));
  });

  function showOverlay(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub || '';
    overlayBest.className = 'overlay-best';
    overlayBest.textContent = '';
    overlayStats.innerHTML = '';
    // Resume only makes sense when paused, not on Game Over
    resumeBtn.style.display = (game.state === 'dead') ? 'none' : 'block';
    // in-game settings (music/sfx/particles) only while paused, never on Game Over
    if (pauseSettings) {
      if (game.state === 'dead') { pauseSettings.style.display = 'none'; }
      else { pauseSettings.style.display = ''; syncPauseSettings(); }
    }
    overlay.classList.add('active');
  }

  // Build a single polished stat row for the Game Over panel.
  function statRow(label, value, cls) {
    return `<div class="ov-stat ${cls || ''}"><span class="ov-label">${label}</span>` +
           `<span class="ov-val">${value}</span></div>`;
  }

  let _deathOverlayTimer = null;

  game.onDeath = (dist, coins, penalty, isBest) => {
    const doubled = game.coinDoublerActive;
    // award XP from the run: distance + a bonus per coin
    const xpGain = dist + coins * 2;
    const xpRes = Profiles.addXp(xpGain);
    // final sweep for anything the mid-run checks missed (best/bestRunCoins now saved)
    if (typeof Achievements !== 'undefined') Achievements.evaluate();
    updateChip();
    if (isBest) document.getElementById('hudBest').textContent = dist;
    const net = coins - (penalty || 0);

    const wasDaily = game._lastRunWasDaily;
    _deathOverlayTimer = setTimeout(() => {
      _deathOverlayTimer = null;
      showOverlay(wasDaily ? 'DAILY CHALLENGE' : 'GAME OVER', '');
      if (isBest) { overlayBest.textContent = 'NEW BEST'; overlayBest.classList.add('show'); }
      let rows = '';
      if (wasDaily) {
        const prev = Profiles.getDailyBest();
        rows += statRow('Daily Best', `${prev} <small>m</small>`, 'best');
      }
      rows += statRow('Distance', `${dist} <small>m</small>`);
      rows += statRow('Coins', `<span class="coin-ico"></span>+${coins}` + (doubled ? ' <em>5\u00d7</em>' : ''), 'coins');
      if (penalty > 0) {
        rows += statRow('Death Penalty', `\u2212${penalty}`, 'penalty');
        rows += statRow('Net', `<span class="coin-ico"></span>${net >= 0 ? '+' : ''}${net}`, net >= 0 ? 'coins' : 'penalty');
      }
      rows += statRow('XP Gained', `+${xpGain}`, 'xp');
      if (xpRes && xpRes.leveledUp) rows += statRow('Level Up', `\u2605 ${xpRes.level}`, 'levelup');
      if (!isBest) rows += statRow('Best', `${Profiles.current().best} <small>m</small>`, 'best');
      overlayStats.innerHTML = rows;
    }, 500);
  };

  // ---- MAIN MENU buttons ----
  document.querySelector('#menu .menu-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'play') startGame();
    else if (action === 'daily') startDailyChallenge();
    else if (action === 'shop') openShop();
    else if (action === 'profile') openProfile();
    else if (action === 'customize') openCustomize();
    else if (action === 'settings') Screens.show('settings');
    else if (action === 'update') updateGame();
    else if (action === 'quit') quitGame();
  });

  // Customize + Achievements buttons live in the menu character panel, outside .menu-buttons
  document.querySelector('#menu .mc-customize').addEventListener('click', openCustomize);
  document.querySelector('#menu .mc-achievements').addEventListener('click', () => openProfile('achievements'));

  // ---- SWITCH PROFILE (chip) ----
  document.getElementById('profileChip').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="switch"]')) { Profiles.logout(); openLogin(); }
  });

  // ---- SETTINGS back ----
  document.querySelector('#settings .back-btn').addEventListener('click', () => {
    Screens.show('menu');
    updateHardFlag();
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

  // ---- ESC to pause / arrow to restart after death ----
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (game.state === 'playing') { game.pause(); Audio2.stopMusic(); showOverlay('PAUSED', ''); }
      else if (game.state === 'paused') { overlay.classList.remove('active'); game.resume(); Audio2.startMusic(); }
    }
    if (game.state === 'dead' && e.code.startsWith('Arrow')) {
      if (_deathOverlayTimer) { clearTimeout(_deathOverlayTimer); _deathOverlayTimer = null; }
      overlay.classList.remove('active');
      overlayBest.classList.remove('show');
      overlayStats.innerHTML = '';
      game._lastRunWasDaily ? startDailyChallenge() : startGame();
    }
  });

  let _updateState = 'idle'; // idle, checking, available, downloading, ready
  async function updateGame() {
    const btn = document.querySelector('[data-action="update"]');
    const label = btn && btn.querySelector('.btn-label');
    if (!window.desktop || !window.desktop.checkForUpdate) {
      if (label) label.textContent = 'Desktop only';
      setTimeout(() => { if (label) label.textContent = 'Update Game'; }, 2000);
      return;
    }
    if (_updateState === 'ready') {
      window.desktop.installUpdate();
      return;
    }
    if (_updateState === 'downloading') return;
    if (label) label.textContent = 'Checking...';
    btn.disabled = true;
    const res = await window.desktop.checkForUpdate();
    if (res.state === 'error') {
      if (label) label.textContent = 'Error';
      setTimeout(() => { if (label) label.textContent = 'Update Game'; btn.disabled = false; }, 3000);
    }
  }

  if (window.desktop && window.desktop.onUpdateStatus) {
    window.desktop.onUpdateStatus((data) => {
      const btn = document.querySelector('[data-action="update"]');
      const label = btn && btn.querySelector('.btn-label');
      _updateState = data.state;
      switch (data.state) {
        case 'checking':
          if (label) label.textContent = 'Checking...';
          break;
        case 'available':
          if (label) label.textContent = 'Downloading...';
          if (btn) btn.disabled = true;
          window.desktop.downloadUpdate();
          break;
        case 'up-to-date':
          if (label) label.textContent = 'Up to date!';
          setTimeout(() => { if (label) label.textContent = 'Update Game'; if (btn) btn.disabled = false; _updateState = 'idle'; }, 3000);
          break;
        case 'downloading':
          if (label) label.textContent = `Downloading ${data.percent}%`;
          break;
        case 'ready':
          if (label) label.textContent = 'Restarting...';
          setTimeout(() => window.desktop.installUpdate(), 1500);
          break;
        case 'error':
          if (label) label.textContent = 'Update Failed';
          console.error('Update error:', data.message);
          setTimeout(() => { if (label) label.textContent = 'Update Game'; if (btn) btn.disabled = false; _updateState = 'idle'; }, 3000);
          break;
      }
    });
  }

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

  // ---- BOOT ----
  openLogin();
})();
