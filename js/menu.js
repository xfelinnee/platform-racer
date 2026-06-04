// Settings + screen management
const Settings = {
  data: {
    musicVol: 50,
    sfxVol: 70,
    difficulty: 'normal',
    particles: true,
    best: 0,
  },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('platformRacer') || '{}');
      Object.assign(this.data, s);
    } catch (e) {}
  },
  save() {
    localStorage.setItem('platformRacer', JSON.stringify(this.data));
  },
};

const Screens = {
  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },
  hideAll() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  },
};

function initSettingsUI() {
  Settings.load();
  const d = Settings.data;

  const music = document.getElementById('musicVol');
  const sfx = document.getElementById('sfxVol');
  music.value = d.musicVol;
  sfx.value = d.sfxVol;
  document.getElementById('musicVolVal').textContent = d.musicVol;
  document.getElementById('sfxVolVal').textContent = d.sfxVol;
  document.getElementById('hudBest').textContent = d.best;

  music.addEventListener('input', () => {
    d.musicVol = +music.value;
    document.getElementById('musicVolVal').textContent = music.value;
    Audio2.setVolumes(d.musicVol, d.sfxVol);
    Settings.save();
  });
  sfx.addEventListener('input', () => {
    d.sfxVol = +sfx.value;
    document.getElementById('sfxVolVal').textContent = sfx.value;
    Audio2.setVolumes(d.musicVol, d.sfxVol);
    Settings.save();
  });

  setupSeg('difficulty', d.difficulty, (val) => { d.difficulty = val; Settings.save(); });
  setupSeg('particles', d.particles ? 'on' : 'off', (val) => { d.particles = (val === 'on'); Settings.save(); });
}

function setupSeg(id, current, onChange) {
  const seg = document.getElementById(id);
  seg.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.val === current);
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      onChange(b.dataset.val);
    });
  });
}

// ---------- LOGIN / PROFILE LIST ----------
function renderProfiles(onPick) {
  const listEl = document.getElementById('profileList');
  const profiles = Profiles.list();
  listEl.innerHTML = '';

  if (profiles.length === 0) {
    listEl.innerHTML = '<div class="profile-empty">No profiles yet. Create one below.</div>';
    return;
  }

  profiles.sort((a, b) => b.best - a.best);
  for (const p of profiles) {
    const row = document.createElement('div');
    row.className = 'profile-row';
    const playMs = (p.stats && p.stats.playMs) || 0;
    row.innerHTML =
      `<span class="pr-name"><span class="pr-name-inner"></span></span>` +
      `<span class="pr-meta">` +
        `<span><span class="coin-ico"></span>${p.coins}</span>` +
        `<span>BEST ${p.best}m</span>` +
        `<span class="pr-time">\u23f1 ${formatPlaytime(playMs)}</span>` +
      `</span>` +
      `<button class="pr-delete" title="Delete">&times;</button>`;
    row.querySelector('.pr-name-inner').textContent = p.name;

    row.addEventListener('click', () => onPick(p.name));
    row.querySelector('.pr-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete profile "${p.name}"? This cannot be undone.`)) {
        Profiles.remove(p.name);
        renderProfiles(onPick);
      }
    });
    listEl.appendChild(row);
  }

  // Enable a slow marquee on any name that is too long to fit.
  requestAnimationFrame(() => {
    listEl.querySelectorAll('.pr-name').forEach(nameEl => {
      const inner = nameEl.querySelector('.pr-name-inner');
      if (!inner) return;
      const overflow = inner.scrollWidth - nameEl.clientWidth;
      if (overflow > 4) {
        nameEl.style.setProperty('--scroll', (overflow + 10) + 'px');
        nameEl.classList.add('scroll');
      }
    });
  });
}

// ---------- LEVEL / XP BAR ----------
function renderLevel() {
  const pr = Profiles.progress();
  if (!pr) return;
  document.getElementById('lvlBadge').textContent = `LVL ${pr.level}`;
  const badge = document.getElementById('prestigeBadge');
  badge.textContent = pr.prestige > 0 ? `\u2605 P${pr.prestige}` : '';
  badge.style.display = pr.prestige > 0 ? 'inline-flex' : 'none';

  const pct = pr.atMax ? 100 : Math.max(0, Math.min(100, (pr.xp / pr.need) * 100));
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('xpText').textContent = pr.atMax
    ? (pr.canPrestige ? 'MAX \u00b7 Ready to Prestige' : 'MAX LEVEL')
    : `${pr.xp} / ${pr.need} XP`;

  const btn = document.getElementById('prestigeBtn');
  btn.style.display = pr.canPrestige ? 'block' : 'none';
}

// ---------- SHOP ----------
// tab: 'buffs' | 'colors' | 'hats' | 'clothes'
// handlers: { buyUpgrade, buyCosmetic, equip, buyColor, setBodyColor, setItemColor }
function renderShop(tab, handlers) {
  const p = Profiles.current();
  if (!p) return;
  document.getElementById('shopCoins').textContent = p.coins;

  // reflect active tab button
  document.querySelectorAll('#shopTabs .shop-tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
  });

  const itemsEl = document.getElementById('shopItems');
  itemsEl.innerHTML = '';

  if (tab === 'buffs') {
    for (const up of Profiles.UPGRADES) {
      const owned = p.owned[up.id];
      const active = owned && Profiles.buffActive(up.id);
      const canAfford = p.coins >= up.price;
      const card = document.createElement('div');
      card.className = 'shop-item' + (active ? ' equipped' : (owned ? ' owned' : (canAfford ? '' : ' cant')));
      card.innerHTML = `<h3></h3><p></p><button class="si-buy"></button>`;
      card.querySelector('h3').textContent = up.name;
      card.querySelector('p').textContent = up.desc;
      const btn = card.querySelector('.si-buy');
      if (!owned) {
        btn.innerHTML = `<span class="coin-ico"></span>${up.price}`;
        btn.addEventListener('click', () => handlers.buyUpgrade(up.id));
      } else {
        btn.textContent = active ? 'ACTIVE · Unequip' : 'Equip';
        btn.addEventListener('click', () => handlers.toggleBuff(up.id));
      }
      itemsEl.appendChild(card);
    }
    return;
  }

  if (tab === 'colors') {
    renderColorsTab(p, itemsEl, handlers);
    return;
  }

  if (tab === 'items') {
    renderItemsTab(p, itemsEl, handlers);
    return;
  }

  if (tab === 'trails') {
    renderTrailsTab(p, itemsEl, handlers);
    return;
  }

  // cosmetics: hats or clothes
  const type = (tab === 'hats') ? 'hat' : 'clothes';
  const list = (tab === 'hats') ? Profiles.HATS : Profiles.CLOTHES;
  for (const item of list) {
    const owned = Profiles.ownsCosmetic(type, item.id);
    const isEquipped = Profiles.equipped(type) === item.id;
    const canAfford = p.coins >= item.price;
    const tintHex = Profiles.itemColorHex(type, item.id);
    const card = document.createElement('div');
    card.className = 'shop-item cosmetic' + (isEquipped ? ' equipped' : (owned ? ' owned' : (canAfford ? '' : ' cant')));
    card.innerHTML =
      `<canvas class="si-preview" width="80" height="96"></canvas>` +
      `<div class="si-info"><h3></h3><p></p><button class="si-buy"></button><div class="si-colors"></div></div>`;
    card.querySelector('h3').textContent = item.name;
    card.querySelector('p').textContent = item.desc;

    // live preview of the stickman wearing this item (with its recolour)
    const cv = card.querySelector('.si-preview');
    drawCosmeticPreview(cv, type === 'hat'
      ? { hat: item.id, hatTint: tintHex }
      : { clothes: item.id, clothesTint: tintHex });

    const btn = card.querySelector('.si-buy');
    if (!owned) {
      btn.innerHTML = `<span class="coin-ico"></span>${item.price}`;
      btn.addEventListener('click', () => handlers.buyCosmetic(type, item.id));
    } else {
      btn.textContent = isEquipped ? 'EQUIPPED' : 'Equip';
      btn.addEventListener('click', () => handlers.equip(type, item.id));
    }

    // recolour strip (only for owned items, using unlocked palette colours)
    const colorsRow = card.querySelector('.si-colors');
    if (owned) {
      const activeId = Profiles.itemColorId(type, item.id);
      // "default" chip clears the recolour
      colorsRow.appendChild(makeSwatch(null, !activeId, false, () => handlers.setItemColor(type, item.id, null)));
      for (const col of Profiles.colorCatalogue()) {
        if (!Profiles.ownsColor(col.id)) continue;
        colorsRow.appendChild(makeSwatch(col.hex, activeId === col.id, false,
          () => handlers.setItemColor(type, item.id, col.id)));
      }
    } else {
      colorsRow.remove();
    }
    itemsEl.appendChild(card);
  }
}

// Colours tab: pick the active body colour + buy new palette colours.
function renderColorsTab(p, itemsEl, handlers) {
  const activeBody = Profiles.bodyColorId();

  // body preview card
  const card = document.createElement('div');
  card.className = 'shop-item cosmetic color-card';
  card.innerHTML =
    `<canvas class="si-preview" width="80" height="96"></canvas>` +
    `<div class="si-info"><h3>Body Colour</h3><p>Pick a scheme for your racer. Buy new colours to use on your body, hats &amp; clothes.</p><div class="si-colors palette"></div></div>`;
  drawCosmeticPreview(card.querySelector('.si-preview'), { body: Profiles.bodyColorHex() });

  const row = card.querySelector('.palette');
  for (const col of Profiles.colorCatalogue()) {
    const owned = Profiles.ownsColor(col.id);
    if (owned) {
      row.appendChild(makeSwatch(col.hex, activeBody === col.id, false, () => handlers.setBodyColor(col.id)));
    } else {
      row.appendChild(makeSwatch(col.hex, false, true, () => handlers.buyColor(col.id), col.price));
    }
  }
  itemsEl.appendChild(card);
}

// Items tab: buy single-use consumables; arm the coin doubler for the next run.
function renderItemsTab(p, itemsEl, handlers) {
  for (const it of Profiles.CONSUMABLES) {
    const count = Profiles.consumableCount(it.id);
    const canAfford = p.coins >= it.price;
    const armed = it.id === 'coinDoubler' && Profiles.coinDoublerArmed();
    const card = document.createElement('div');
    card.className = 'shop-item' + (count > 0 ? ' owned' : (canAfford ? '' : ' cant'));
    card.innerHTML = `<h3></h3><p></p><div class="si-actions"></div>`;
    card.querySelector('h3').textContent = it.name + (count > 0 ? `  \u00d7${count}` : '');
    card.querySelector('p').textContent = it.desc;
    const actions = card.querySelector('.si-actions');

    const buy = document.createElement('button');
    buy.className = 'si-buy';
    buy.innerHTML = `<span class="coin-ico"></span>${it.price}`;
    buy.addEventListener('click', () => handlers.buyConsumable(it.id));
    actions.appendChild(buy);

    if (it.id === 'coinDoubler') {
      const arm = document.createElement('button');
      arm.className = 'si-buy arm-btn' + (armed ? ' on' : '');
      arm.textContent = armed ? 'ARMED' : 'Arm';
      arm.disabled = count <= 0 && !armed;
      arm.addEventListener('click', () => handlers.armCoinDoubler());
      actions.appendChild(arm);
    }
    itemsEl.appendChild(card);
  }
}

// Trails tab: premium vanity trail effects.
function renderTrailsTab(p, itemsEl, handlers) {
  for (const tr of Profiles.trailCatalogue()) {
    const owned = Profiles.ownsTrail(tr.id);
    const isEq = Profiles.equippedTrail() === tr.id;
    const canAfford = p.coins >= tr.price;
    const card = document.createElement('div');
    card.className = 'shop-item cosmetic' + (isEq ? ' equipped' : (owned ? ' owned' : (canAfford ? '' : ' cant')));
    card.innerHTML =
      `<canvas class="si-preview" width="80" height="96"></canvas>` +
      `<div class="si-info"><h3></h3><p></p><button class="si-buy"></button></div>`;
    card.querySelector('h3').textContent = tr.name;
    card.querySelector('p').textContent = tr.desc;
    drawTrailPreview(card.querySelector('.si-preview'), tr);

    const btn = card.querySelector('.si-buy');
    if (!owned) {
      btn.innerHTML = `<span class="coin-ico"></span>${tr.price}`;
      btn.addEventListener('click', () => handlers.buyTrail(tr.id));
    } else {
      btn.textContent = isEq ? 'EQUIPPED' : 'Equip';
      btn.addEventListener('click', () => handlers.equipTrail(tr.id));
    }
    itemsEl.appendChild(card);
  }
}

// A diagonal streak of fading dots representing the trail colour.
function drawTrailPreview(canvas, tr) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = 16 + t * (canvas.width - 30);
    const y = canvas.height - 16 - t * (canvas.height - 34);
    const col = tr.color === 'rainbow' ? `hsl(${Math.floor(t * 300)}, 90%, 62%)` : tr.color;
    ctx.globalAlpha = 0.2 + t * 0.8;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + t * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// Build a colour swatch button. hex=null renders the "default" chip.
function makeSwatch(hex, active, locked, onClick, price) {
  const b = document.createElement('button');
  b.className = 'swatch' + (active ? ' active' : '') + (locked ? ' locked' : '') + (hex === null ? ' none' : '');
  if (hex) b.style.background = hex;
  if (hex === null) b.title = 'Default';
  if (locked && price != null) {
    const tag = document.createElement('span');
    tag.className = 'swatch-price';
    tag.textContent = price;
    b.appendChild(tag);
  }
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

// Render a small static stickman wearing the given cosmetic onto a canvas.
// opts: { hat, clothes, hatTint, clothesTint, body }
function drawCosmeticPreview(canvas, opts) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pl = new Player(0, 0);
  pl.onGround = true;
  pl.dir = 1;
  pl.vx = 0; pl.vy = 0;
  pl.runPhase = 0;
  pl.squash = 1;
  pl.bodyColor = opts.body || (typeof Profiles !== 'undefined' ? Profiles.bodyColorHex() : '#2ee6ff');
  pl.hat = opts.hat || null;
  pl.clothes = opts.clothes || null;
  pl.hatTint = opts.hatTint || null;
  pl.clothesTint = opts.clothesTint || null;
  pl.hatReviveAvailable = true; // show golden cowboy hat in its gold (unused) state
  const scale = 0.8;
  ctx.save();
  ctx.translate(canvas.width / 2 - pl.cx * scale, canvas.height - 6 - pl.feet * scale);
  ctx.scale(scale, scale);
  pl.draw(ctx);
  ctx.restore();
}

// ---------- PROFILE SCREEN ----------
function renderProfile() {
  const p = Profiles.current();
  if (!p) return;
  const pr = Profiles.progress();
  const counts = Profiles.unlockCounts();
  const st = p.stats || { runs: 0, coinsCollected: 0, playMs: 0 };

  document.getElementById('profileCoins').textContent = p.coins;
  document.getElementById('profileName').textContent = p.name;
  document.getElementById('profileRank').textContent =
    (p.prestige ? '\u2605'.repeat(p.prestige) + '  ' : '') + 'Level ' + p.level;

  const stats = [
    { label: 'Best Distance', value: p.best + ' m' },
    { label: 'Total Runs', value: st.runs },
    { label: 'Coins Collected', value: st.coinsCollected },
    { label: 'Coin Balance', value: p.coins },
    { label: 'Playtime', value: formatPlaytime(st.playMs) },
    { label: 'Prestige', value: p.prestige + ' / ' + (pr ? pr.maxPrestige : 10) },
  ];
  const sEl = document.getElementById('profileStats');
  sEl.innerHTML = '';
  for (const s of stats) {
    const d = document.createElement('div');
    d.className = 'stat-card';
    d.innerHTML = `<span class="stat-val"></span><span class="stat-label"></span>`;
    d.querySelector('.stat-val').textContent = s.value;
    d.querySelector('.stat-label').textContent = s.label;
    sEl.appendChild(d);
  }

  const unlocks = [
    { label: 'Hats', c: counts.hats },
    { label: 'Clothes', c: counts.clothes },
    { label: 'Colors', c: counts.colors },
    { label: 'Trails', c: counts.trails },
    { label: 'Buffs', c: counts.buffs },
  ];
  const uEl = document.getElementById('profileUnlocks');
  uEl.innerHTML = '';
  for (const u of unlocks) {
    const pct = u.c.total ? Math.round((u.c.owned / u.c.total) * 100) : 0;
    const d = document.createElement('div');
    d.className = 'unlock-card' + (u.c.owned === u.c.total ? ' complete' : '');
    d.innerHTML =
      `<div class="unlock-top"><span class="unlock-name"></span><span class="unlock-count"></span></div>` +
      `<div class="unlock-track"><div class="unlock-fill"></div></div>`;
    d.querySelector('.unlock-name').textContent = u.label;
    d.querySelector('.unlock-count').textContent = u.c.owned + ' / ' + u.c.total;
    d.querySelector('.unlock-fill').style.width = pct + '%';
    uEl.appendChild(d);
  }
}

function formatPlaytime(ms) {
  const s = Math.floor((ms || 0) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}
