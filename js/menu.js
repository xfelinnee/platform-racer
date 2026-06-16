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
      const onConfirm = (ok) => {
        if (!ok) return;
        Profiles.remove(p.name);
        renderProfiles(onPick);
      };
      if (typeof window.uiConfirm === 'function') {
        window.uiConfirm({
          title: 'DELETE PROFILE',
          message: `Delete profile "${p.name}"? This cannot be undone.`,
          yes: 'Delete',
          no: 'Cancel',
        }, onConfirm);
      } else {
        onConfirm(confirm(`Delete profile "${p.name}"? This cannot be undone.`));
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
    const key = `${type}:${item.id}`;
    const mode = shopMode(key);
    const activeSkin = Profiles.itemSkinId(type, item.id);
    const skinPrev = (_skinPreviewKey === key) ? _skinPreviewId : null;
    const card = document.createElement('div');
    card.className = 'shop-item cosmetic' + (isEquipped ? ' equipped' : (owned ? ' owned' : (canAfford ? '' : ' cant')));
    card.innerHTML =
      `<canvas class="si-preview" width="80" height="96"></canvas>` +
      `<div class="si-info"><h3></h3><p></p><button class="si-buy"></button><div class="si-colors"></div></div>`;
    card.querySelector('h3').textContent = item.name;
    card.querySelector('p').textContent = item.desc;

    // live preview of the stickman wearing this item (recolour or animated skin)
    const cv = card.querySelector('.si-preview');
    const prevOpts = {};
    if (type === 'hat') {
      prevOpts.hat = item.id; prevOpts.hatTint = tintHex;
      prevOpts.hatSkin = (mode === 'skins') ? (skinPrev || activeSkin) : activeSkin;
    } else {
      prevOpts.clothes = item.id; prevOpts.clothesTint = tintHex;
      prevOpts.clothesSkin = (mode === 'skins') ? (skinPrev || activeSkin) : activeSkin;
    }
    drawCosmeticPreview(cv, prevOpts);

    const btn = card.querySelector('.si-buy');
    if (!owned) {
      btn.innerHTML = `<span class="coin-ico"></span>${item.price}`;
      btn.addEventListener('click', () => handlers.buyCosmetic(type, item.id));
    } else {
      btn.textContent = isEquipped ? 'EQUIPPED' : 'Equip';
      btn.addEventListener('click', () => handlers.equip(type, item.id));
    }

    // recolour / skins strip (only for owned items)
    const colorsRow = card.querySelector('.si-colors');
    if (owned) {
      const info = card.querySelector('.si-info');
      info.insertBefore(makeModeToggle(mode,
        () => { _shopMode[key] = 'colors'; resetSkinPreview(); handlers.refreshColors(); },
        () => { _shopMode[key] = 'skins'; handlers.refreshColors(); }
      ), colorsRow);

      if (mode === 'skins') {
        buildSkinsPicker(colorsRow, p, {
          key, slot: type,
          activeSkinId: activeSkin,
          ownsSkin: (id) => Profiles.ownsSkin(id),
          onEquip: (id) => handlers.setItemSkin(type, item.id, id),
          onBuy: (id) => handlers.buySkin(id),
          refresh: () => handlers.refreshColors(),
          onPreview: () => {},
        });
      } else {
        const activeId = Profiles.itemColorId(type, item.id);
        colorsRow.appendChild(makeSwatch(null, !activeId && !activeSkin, false, () => handlers.setItemColor(type, item.id, null)));
        for (const col of Profiles.colorCatalogue()) {
          if (!Profiles.ownsColor(col.id)) continue;
          colorsRow.appendChild(makeSwatch(col.hex, activeId === col.id && !activeSkin, false,
            () => handlers.setItemColor(type, item.id, col.id)));
        }
      }
    } else {
      colorsRow.remove();
    }
    itemsEl.appendChild(card);
  }
}

// module-level preview state for the shop colours tab (id of unowned colour being previewed)
let _shopColorPreview = null;
// Colours|Skins view mode per card. 'body' for the body card, `${type}:${id}` for items.
let _shopMode = {};
function shopMode(key) { return _shopMode[key] || 'colors'; }
function resetShopColorPreview() { _shopColorPreview = null; resetSkinPreview(); _shopMode = {}; }

// A small Colours | Skins segmented toggle.
function makeModeToggle(mode, onColors, onSkins) {
  const wrap = document.createElement('div');
  wrap.className = 'mode-toggle';
  const c = document.createElement('button');
  c.className = 'mode-btn' + (mode === 'colors' ? ' on' : '');
  c.textContent = 'Colours';
  const s = document.createElement('button');
  s.className = 'mode-btn' + (mode === 'skins' ? ' on' : '');
  s.textContent = 'Skins';
  c.addEventListener('click', (e) => { e.stopPropagation(); onColors(); });
  s.addEventListener('click', (e) => { e.stopPropagation(); onSkins(); });
  wrap.appendChild(c); wrap.appendChild(s);
  return wrap;
}

// Colours tab: pick the active body colour + preview/buy new palette colours, OR
// switch to animated Skins.
function renderColorsTab(p, itemsEl, handlers) {
  const mode = shopMode('body');
  const activeBody = Profiles.bodyColorId();
  // if the previewed colour is now owned (or invalid), clear the preview
  if (_shopColorPreview && Profiles.ownsColor(_shopColorPreview)) _shopColorPreview = null;

  const previewCol = _shopColorPreview ? Profiles.colorCatalogue().find(c => c.id === _shopColorPreview) : null;
  const previewHex = previewCol ? previewCol.hex : Profiles.bodyColorHex();
  const skinPrev = (_skinPreviewKey === 'body') ? _skinPreviewId : null;

  // body preview card — keeps equipped hat/clothes, shows previewed colour/skin on the body
  const card = document.createElement('div');
  card.className = 'shop-item cosmetic color-card';
  card.innerHTML =
    `<canvas class="si-preview" width="80" height="96"></canvas>` +
    `<div class="si-info"><h3>Body Colour</h3><p class="cc-desc"></p><div class="si-colors palette"></div><div class="si-buy-row"></div></div>`;

  const opts = equippedPreviewOpts(0.85);
  if (mode === 'skins') {
    // preview the previewed/equipped body skin
    if (skinPrev) { opts.bodySkin = skinPrev; opts.body = Skins.byId(skinPrev).baseHex; }
  } else {
    opts.bodySkin = null;          // solid-colour preview
    opts.body = previewHex;
  }
  drawCosmeticPreview(card.querySelector('.si-preview'), opts);

  card.querySelector('.cc-desc').textContent = mode === 'skins'
    ? 'Animated body materials. Tap a locked skin to preview it, then buy.'
    : 'Pick a scheme for your racer. Tap a locked colour to preview it, then buy.';

  // toggle
  const info = card.querySelector('.si-info');
  info.insertBefore(makeModeToggle(mode,
    () => { _shopMode.body = 'colors'; resetSkinPreview(); handlers.refreshColors(); },
    () => { _shopMode.body = 'skins'; _shopColorPreview = null; handlers.refreshColors(); }
  ), info.querySelector('.cc-desc').nextSibling);

  const row = card.querySelector('.palette');

  if (mode === 'skins') {
    buildSkinsPicker(row, p, {
      key: 'body', slot: 'body',
      activeSkinId: Profiles.bodySkinId(),
      ownsSkin: (id) => Profiles.ownsSkin(id),
      onEquip: (id) => handlers.setBodySkin(id),
      onBuy: (id) => handlers.buySkin(id),
      refresh: () => handlers.refreshColors(),
      onPreview: () => {},
    });
  } else {
    for (const col of Profiles.colorCatalogue()) {
      const owned = Profiles.ownsColor(col.id);
      if (owned) {
        row.appendChild(makeSwatch(col.hex, activeBody === col.id && !Profiles.bodySkinId(), false, () => {
          _shopColorPreview = null;
          handlers.setBodyColor(col.id);
        }));
      } else {
        row.appendChild(makeSwatch(col.hex, _shopColorPreview === col.id, true, () => {
          _shopColorPreview = (_shopColorPreview === col.id) ? null : col.id;
          handlers.refreshColors();
        }, col.price));
      }
    }
    // buy row appears only when previewing a locked colour
    const buyRow = card.querySelector('.si-buy-row');
    if (previewCol) {
      const canAfford = p.coins >= previewCol.price;
      const buy = document.createElement('button');
      buy.className = 'si-buy' + (canAfford ? '' : ' cant');
      buy.innerHTML = `<span class="coin-ico"></span>Buy ${previewCol.name} \u2014 ${previewCol.price}`;
      buy.addEventListener('click', () => {
        const res = handlers.buyColor(previewCol.id);
        if (res && res.ok) {
          _shopColorPreview = null;
          handlers.setBodyColor(previewCol.id);
        }
      });
      buyRow.appendChild(buy);
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

// An animated swatch that renders a skin's live material via the preview ticker.
function makeSkinSwatch(skin, active, locked, onClick) {
  const b = document.createElement('button');
  b.className = 'swatch skin-swatch' + (active ? ' active' : '') + (locked ? ' locked' : '');
  b.title = skin.name;
  const cv = document.createElement('canvas');
  cv.width = 30; cv.height = 30; cv.className = 'skin-swatch-cv';
  cv._render = (c, t) => { Skins.drawSwatch(skin, c.getContext('2d'), c.width, t); };
  cv._render(cv, performance.now() / 1000);
  _previewCanvases.add(cv); _ensurePreviewLoop();
  b.appendChild(cv);
  if (locked) {
    const tag = document.createElement('span');
    tag.className = 'swatch-price';
    tag.textContent = skin.price;
    b.appendChild(tag);
  }
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

// Module state: which skin (if any) is being previewed, keyed by card context.
// key = 'body' for the body card, or `${type}:${itemId}` for a cosmetic card.
let _skinPreviewKey = null;
let _skinPreviewId = null;
function resetSkinPreview() { _skinPreviewKey = null; _skinPreviewId = null; }

// Build a skins picker into `row`, with preview-then-buy.
// ctx: { key, slot, activeSkinId, ownsSkin(id), onEquip(id), onBuy(id)->res, refresh(), onPreview(skinId) }
function buildSkinsPicker(row, p, ctx) {
  const previewing = (_skinPreviewKey === ctx.key) ? _skinPreviewId : null;
  for (const skin of Skins.forSlot(ctx.slot)) {
    const owned = ctx.ownsSkin(skin.id);
    const active = ctx.activeSkinId === skin.id;
    const isPrev = previewing === skin.id;
    const sw = makeSkinSwatch(skin, active || isPrev, !owned, () => {
      if (owned) {
        resetSkinPreview();
        ctx.onEquip(active ? null : skin.id); // toggle off if already active
      } else {
        _skinPreviewKey = ctx.key; _skinPreviewId = skin.id;
        ctx.onPreview(skin.id);
        ctx.refresh();
      }
    });
    row.appendChild(sw);
  }
  // buy button for a previewed (locked) skin
  if (previewing) {
    const skin = Skins.byId(previewing);
    if (skin && !ctx.ownsSkin(skin.id)) {
      const buyRow = document.createElement('div');
      buyRow.className = 'cz-row si-buy-row';
      buyRow.style.marginTop = '8px';
      const canAfford = p.coins >= skin.price;
      const buy = document.createElement('button');
      buy.className = 'si-buy' + (canAfford ? '' : ' cant');
      buy.innerHTML = `<span class="coin-ico"></span>Buy ${skin.name} \u2014 ${skin.price}`;
      buy.addEventListener('click', () => {
        const res = ctx.onBuy(skin.id);
        if (res && res.ok) {
          resetSkinPreview();
          ctx.onEquip(skin.id);
        }
      });
      buyRow.appendChild(buy);
      row.appendChild(buyRow);
    }
  }
}

// ---- animated cosmetic previews ----
// Canvases that carry an animated skin re-render on a shared, throttled rAF loop.
const _previewCanvases = new Set();
let _previewRAF = null;
function _previewTick(now) {
  if (now - (_previewTick._last || 0) >= 33) { // ~30fps
    _previewTick._last = now;
    const t = now / 1000;
    for (const cv of [..._previewCanvases]) {
      if (!cv.isConnected) { _previewCanvases.delete(cv); continue; }
      if (cv._render) cv._render(cv, t); else _renderCosmetic(cv, cv._opts, t);
    }
  }
  _previewRAF = _previewCanvases.size ? requestAnimationFrame(_previewTick) : null;
}
function _ensurePreviewLoop() { if (!_previewRAF) _previewRAF = requestAnimationFrame(_previewTick); }

// Render a small stickman wearing the given cosmetic onto a canvas at time t.
// opts: { hat, clothes, hatTint, clothesTint, body, bodySkin, hatSkin, clothesSkin, scale }
function _renderCosmetic(canvas, opts, t) {
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
  pl.bodySkin = opts.bodySkin || null;
  pl.hatSkin = opts.hatSkin || null;
  pl.clothesSkin = opts.clothesSkin || null;
  pl.hatReviveAvailable = true; // show golden cowboy hat in its gold (unused) state
  const scale = opts.scale || 0.8;
  ctx.save();
  ctx.translate(canvas.width / 2 - pl.cx * scale, canvas.height - 6 - pl.feet * scale);
  ctx.scale(scale, scale);
  pl.draw(ctx, t);
  ctx.restore();
}

// Public entry: draws once, and registers for animation if the opts carry a skin.
function drawCosmeticPreview(canvas, opts) {
  canvas._opts = opts;
  _renderCosmetic(canvas, opts, performance.now() / 1000);
  if (opts.bodySkin || opts.hatSkin || opts.clothesSkin) {
    _previewCanvases.add(canvas);
    _ensurePreviewLoop();
  } else {
    _previewCanvases.delete(canvas);
  }
}

// ---------- MENU CHARACTER + QUICK CUSTOMIZE ----------
function equippedPreviewOpts(scale) {
  const hat = Profiles.equipped('hat');
  const clothes = Profiles.equipped('clothes');
  return {
    hat, clothes,
    hatTint: hat ? Profiles.itemColorHex('hat', hat) : null,
    clothesTint: clothes ? Profiles.itemColorHex('clothes', clothes) : null,
    body: Profiles.bodyColorHex(),
    bodySkin: Profiles.bodySkinId(),
    hatSkin: hat ? Profiles.itemSkinId('hat', hat) : null,
    clothesSkin: clothes ? Profiles.itemSkinId('clothes', clothes) : null,
    scale,
  };
}

function renderMenuCharacter() {
  const canvas = document.getElementById('menuCharCanvas');
  if (!canvas || typeof Profiles === 'undefined' || !Profiles.current()) return;
  drawCosmeticPreview(canvas, equippedPreviewOpts(1.4));
}

// handlers: { equip(type,id), setBodyColor(id), equipTrail(id) }
function renderCustomize(handlers) {
  const p = Profiles.current();
  if (!p) return;
  drawCosmeticPreview(document.getElementById('customizeCanvas'), equippedPreviewOpts(2.0));

  const root = document.getElementById('customizeOptions');
  root.innerHTML = '';

  const section = (title, build) => {
    const sec = document.createElement('div');
    sec.className = 'cz-section';
    const h = document.createElement('h3');
    h.className = 'cz-title';
    h.textContent = title;
    sec.appendChild(h);
    const row = document.createElement('div');
    row.className = 'cz-row';
    build(row);
    sec.appendChild(row);
    root.appendChild(sec);
  };

  // a chip with a tiny character preview + label
  const czItem = (label, equipped, drawFn, onClick) => {
    const chip = document.createElement('button');
    chip.className = 'cz-item' + (equipped ? ' on' : '');
    const cv = document.createElement('canvas');
    cv.width = 56; cv.height = 70; cv.className = 'cz-prev';
    chip.appendChild(cv);
    const lab = document.createElement('span');
    lab.className = 'cz-label';
    lab.textContent = label;
    chip.appendChild(lab);
    drawFn(cv);
    chip.addEventListener('click', onClick);
    return chip;
  };

  // HATS (owned only) + None
  section('Hat', row => {
    row.appendChild(czItem('None', !Profiles.equipped('hat'),
      cv => drawCosmeticPreview(cv, { body: Profiles.bodyColorHex(), scale: 0.85 }),
      () => handlers.equip('hat', null)));
    for (const h of Profiles.HATS) {
      if (!Profiles.ownsCosmetic('hat', h.id)) continue;
      row.appendChild(czItem(h.name, Profiles.equipped('hat') === h.id,
        cv => drawCosmeticPreview(cv, { hat: h.id, hatTint: Profiles.itemColorHex('hat', h.id), body: Profiles.bodyColorHex(), scale: 0.85 }),
        () => handlers.equip('hat', h.id)));
    }
  });

  // CLOTHES (owned only) + None
  section('Clothes', row => {
    row.appendChild(czItem('None', !Profiles.equipped('clothes'),
      cv => drawCosmeticPreview(cv, { body: Profiles.bodyColorHex(), scale: 0.85 }),
      () => handlers.equip('clothes', null)));
    for (const c of Profiles.CLOTHES) {
      if (!Profiles.ownsCosmetic('clothes', c.id)) continue;
      row.appendChild(czItem(c.name, Profiles.equipped('clothes') === c.id,
        cv => drawCosmeticPreview(cv, { clothes: c.id, clothesTint: Profiles.itemColorHex('clothes', c.id), body: Profiles.bodyColorHex(), scale: 0.85 }),
        () => handlers.equip('clothes', c.id)));
    }
  });

  // COLOR swatches (owned only)
  section('Color', row => {
    for (const col of Profiles.colorCatalogue()) {
      if (!Profiles.ownsColor(col.id)) continue;
      row.appendChild(makeSwatch(col.hex, Profiles.bodyColorId() === col.id, false, () => handlers.setBodyColor(col.id)));
    }
  });

  // TRAILS (owned only) + None
  section('Trail', row => {
    const none = document.createElement('button');
    none.className = 'cz-item' + (!Profiles.equippedTrail() ? ' on' : '');
    none.innerHTML = `<canvas class="cz-prev" width="56" height="70"></canvas><span class="cz-label">None</span>`;
    none.addEventListener('click', () => handlers.equipTrail(null));
    row.appendChild(none);
    for (const tr of Profiles.trailCatalogue()) {
      if (!Profiles.ownsTrail(tr.id)) continue;
      const chip = document.createElement('button');
      chip.className = 'cz-item' + (Profiles.equippedTrail() === tr.id ? ' on' : '');
      const cv = document.createElement('canvas');
      cv.width = 56; cv.height = 70; cv.className = 'cz-prev';
      chip.appendChild(cv);
      const lab = document.createElement('span');
      lab.className = 'cz-label';
      lab.textContent = tr.name.replace(' Trail', '');
      chip.appendChild(lab);
      drawTrailPreview(cv, tr);
      chip.addEventListener('click', () => handlers.equipTrail(tr.id));
      row.appendChild(chip);
    }
  });
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

  renderLeaderboard();

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

function renderLeaderboard() {
  const el = document.getElementById('profileLeaderboard');
  if (!el) return;
  const rows = Profiles.getLeaderboard();
  if (!rows.length) { el.innerHTML = '<div class="lb-empty">No runs recorded yet.</div>'; return; }
  el.innerHTML = '';
  rows.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'lb-row' + (r.daily ? ' lb-daily' : '');
    const timeStr = r.timeMs ? formatRunTime(r.timeMs) : '\u2014';
    d.innerHTML =
      `<span class="lb-rank">#${i + 1}</span>` +
      `<span class="lb-dist">${r.dist}<small>m</small></span>` +
      `<span class="lb-time">\u23f1 ${timeStr}</span>` +
      `<span class="lb-coins"><span class="coin-ico"></span>${r.coins}</span>` +
      `<span class="lb-date">${r.daily ? '\u2605 Daily \u00b7 ' : ''}${r.date}</span>`;
    el.appendChild(d);
  });
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

// Duration of a single run, e.g. "1m 23s" or "8.4s".
function formatRunTime(ms) {
  const total = (ms || 0) / 1000;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m) return `${m}m ${Math.floor(s)}s`;
  return `${s.toFixed(1)}s`;
}
