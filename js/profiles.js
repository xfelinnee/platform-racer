// Local multi-profile system: each profile keeps coins, best score, and shop unlocks.
const Profiles = (() => {
  const KEY = 'platformRacer_profiles';
  let store = { profiles: {}, current: null };

  // Storage backend: on desktop use a real file (file:// localStorage is not
  // reliably persisted by Electron); in the browser use localStorage.
  const desktop = (typeof window !== 'undefined' && window.desktop && window.desktop.isDesktop)
    ? window.desktop : null;

  function readRaw() {
    if (desktop) {
      try { return desktop.storageLoad(); } catch (e) { return null; }
    }
    return localStorage.getItem(KEY);
  }
  function writeRaw(str) {
    if (desktop) { try { desktop.storageSave(str); } catch (e) {} return; }
    localStorage.setItem(KEY, str);
  }

  // Shop catalogue — id, label, price, description.
  const UPGRADES = [
    { id: 'speed',        name: 'x1.5 Speed Boost',  price: 250, desc: 'Run & sprint 50% faster.' },
    { id: 'coins',        name: 'x1.5 Coin Bonus',   price: 200, desc: 'Earn 50% more coins per pickup.' },
    { id: 'doubleJump',   name: 'Double Jump',       price: 350, desc: 'Jump a second time in mid-air.' },
    { id: 'secondChance', name: '2nd Chance',        price: 400, desc: 'Revive once per run after a fatal hit.' },
  ];

  // Cosmetic hats — these DO grant a gameplay buff.
  const HATS = [
    { id: 'topHat',     name: 'Top Hat',           price: 300, desc: 'Dapper. Jump noticeably higher.', buff: 'highJump' },
    { id: 'propHat',    name: 'Propeller Hat',     price: 500, desc: 'Hold Jump (W) in the air to hover and slow-fall.', buff: 'hover' },
    { id: 'goldCowboy', name: 'Golden Cowboy Hat', price: 800, desc: 'One free revive per run. Turns brown once used.', buff: 'revive' },
  ];

  // Clothing — purely cosmetic, no buffs.
  const CLOTHES = [
    { id: 'cowboy',       name: 'Cowboy Clothes', price: 200, desc: 'Vest, bandana & blue jeans. Cosmetic only.' },
    { id: 'suit',         name: 'Suit & Tie',     price: 200, desc: 'Jacket, tie & trousers. Cosmetic only.' },
    { id: 'formalDress',  name: 'Formal Dress',   price: 250, desc: 'Full-length evening gown. Cosmetic only.' },
    { id: 'weddingDress', name: 'Wedding Dress',  price: 300, desc: 'Flowing gown & veil. Cosmetic only.' },
    { id: 'street',       name: 'Street Clothes', price: 150, desc: 'Hoodie & joggers. Cosmetic only.' },
  ];

  // Colour palette — unlock once, reuse anywhere (body, clothes, hats).
  const COLORS = [
    { id: 'cyan',    name: 'Cyan',    hex: '#2ee6ff', price: 0 },
    { id: 'magenta', name: 'Magenta', hex: '#ff4dd2', price: 150 },
    { id: 'lime',    name: 'Lime',    hex: '#8dff3c', price: 150 },
    { id: 'gold',    name: 'Gold',    hex: '#ffd23c', price: 200 },
    { id: 'crimson', name: 'Crimson', hex: '#ff4d4d', price: 150 },
    { id: 'violet',  name: 'Violet',  hex: '#a96cff', price: 150 },
    { id: 'orange',  name: 'Orange',  hex: '#ff8a3c', price: 150 },
    { id: 'mint',    name: 'Mint',    hex: '#3cffb0', price: 150 },
    { id: 'white',   name: 'White',   hex: '#eef3ff', price: 250 },
    { id: 'onyx',    name: 'Onyx',    hex: '#3a4256', price: 200 },
  ];
  function colorHex(id) { const c = COLORS.find(c => c.id === id); return c ? c.hex : null; }

  // Consumables — single-use boosters. Pricey on purpose (recurring gold sink).
  const CONSUMABLES = [
    { id: 'revive',      name: 'Extra Revive', price: 600,  desc: 'Carry a spare life. Auto-used on death when you have no other revive. Up to 3 used per run.' },
    { id: 'coinDoubler', name: 'Coin Booster', price: 1000, desc: '5\u00d7 every coin for one run. Arm it, then it is spent when the run begins.' },
  ];

  // Premium vanity trail effects (no gameplay impact).
  const TRAILS = [
    { id: 'spark',   name: 'Spark Trail',   price: 1500, desc: 'Cyan sparks in your wake.',  color: '#2ee6ff' },
    { id: 'bubble',  name: 'Bubble Trail',  price: 1800, desc: 'Floaty rising bubbles.',     color: '#9fdcff' },
    { id: 'shadow',  name: 'Shadow Trail',  price: 2200, desc: 'Violet afterimages.',        color: '#7a4dff' },
    { id: 'flame',   name: 'Flame Trail',   price: 2800, desc: 'Blazing embers behind you.', color: '#ff7a1a' },
    { id: 'rainbow', name: 'Rainbow Trail', price: 4500, desc: 'Shifting prism of colour.',  color: 'rainbow' },
  ];

  function newProfile(name) {
    return {
      name,
      coins: 0,
      best: 0,
      owned: { speed: false, coins: false, doubleJump: false, secondChance: false },
      buffsOff: {},                  // owned buffs the player has toggled OFF
      cosmetics: { hats: {}, clothes: {} },
      equipped: { hat: null, clothes: null },
      colorsOwned: { cyan: true },   // unlocked palette colours
      bodyColor: 'cyan',             // active body colour scheme
      clothesColor: {},              // { clothesId: colorId } recolours
      hatColor: {},                  // { hatId: colorId } recolours
      consumables: { revive: 0, coinDoubler: 0 }, // single-use booster stock
      coinDoublerArmed: false,       // bring a coin doubler into the next run
      trails: {},                    // owned trail ids
      equippedTrail: null,           // active trail id
      stats: { runs: 0, coinsCollected: 0, playMs: 0 }, // lifetime totals
      level: 1,
      xp: 0,
      prestige: 0,
      runHistory: [],                // top-10 leaderboard entries [{dist,coins,date}]
      dailyBests: {},                // { 'YYYY-MM-DD': dist } daily challenge bests
      ghostData: null,               // position samples from the best run
    };
  }

  // Backfill missing fields on profiles created before newer features existed.
  function ensure(p) {
    if (!p.cosmetics) p.cosmetics = { hats: {}, clothes: {} };
    if (!p.cosmetics.hats) p.cosmetics.hats = {};
    if (!p.cosmetics.clothes) p.cosmetics.clothes = {};
    if (!p.equipped) p.equipped = { hat: null, clothes: null };
    if (!p.colorsOwned) p.colorsOwned = { cyan: true };
    p.colorsOwned.cyan = true; // base colour is always free
    if (!p.bodyColor) p.bodyColor = 'cyan';
    if (!p.clothesColor) p.clothesColor = {};
    if (!p.hatColor) p.hatColor = {};
    if (!p.buffsOff) p.buffsOff = {};
    if (!p.consumables) p.consumables = { revive: 0, coinDoubler: 0 };
    if (typeof p.consumables.revive !== 'number') p.consumables.revive = 0;
    if (typeof p.consumables.coinDoubler !== 'number') p.consumables.coinDoubler = 0;
    if (typeof p.coinDoublerArmed !== 'boolean') p.coinDoublerArmed = false;
    if (!p.trails) p.trails = {};
    if (p.equippedTrail === undefined) p.equippedTrail = null;
    if (!p.stats) p.stats = { runs: 0, coinsCollected: 0, playMs: 0 };
    if (typeof p.level !== 'number') p.level = 1;
    if (typeof p.xp !== 'number') p.xp = 0;
    if (typeof p.prestige !== 'number') p.prestige = 0;
    if (!p.runHistory) p.runHistory = [];
    if (!p.dailyBests) p.dailyBests = {};
    if (p.ghostData === undefined) p.ghostData = null;
    return p;
  }

  // ---- LEVELS (1-60) & PRESTIGE (0-10) ----
  const MAX_LEVEL = 60;
  const MAX_PRESTIGE = 10;
  // XP required to advance FROM the given level (rises as you climb).
  function xpForLevel(level) { return 100 + (level - 1) * 40; }

  function load() {
    try {
      const s = JSON.parse(readRaw() || 'null');
      if (s && s.profiles) store = s;
    } catch (e) {}
    // one-time migration: pull any existing localStorage data into the new backend
    if (desktop && Object.keys(store.profiles).length === 0) {
      try {
        const legacy = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (legacy && legacy.profiles) store = legacy;
      } catch (e) {}
    }
    // make sure every profile has the cosmetics fields
    for (const name in store.profiles) ensure(store.profiles[name]);
    save();
  }

  function save() { writeRaw(JSON.stringify(store)); }

  function list() { return Object.values(store.profiles); }
  function exists(name) { return !!store.profiles[name.trim()]; }

  function create(name) {
    name = name.trim().slice(0, 16);
    if (!name) return { ok: false, error: 'Name cannot be empty.' };
    if (store.profiles[name]) return { ok: false, error: 'That name is taken.' };
    store.profiles[name] = newProfile(name);
    save();
    return { ok: true };
  }

  function remove(name) {
    delete store.profiles[name];
    if (store.current === name) store.current = null;
    save();
  }

  function setCurrent(name) {
    if (store.profiles[name]) { store.current = name; save(); }
  }
  function logout() { store.current = null; save(); }

  function current() { return store.current ? store.profiles[store.current] : null; }

  // ---- gameplay helpers ----
  function addCoins(n) { const p = current(); if (p) { p.coins += n; save(); } }
  function spend(n) { const p = current(); if (p && p.coins >= n) { p.coins -= n; save(); return true; } return false; }
  function dailyKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  // Numeric seed derived from the UTC date string — same for every player on the same day.
  function dailySeed() {
    const key = dailyKey();
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }

  function recordRun(dist, coins = 0, playMs = 0, ghostSamples = null, isDaily = false) {
    const p = current();
    if (!p) return false;
    ensure(p);
    p.stats.runs += 1;
    p.stats.coinsCollected += Math.max(0, coins);
    p.stats.playMs += Math.max(0, playMs);
    let isBest = false;
    if (dist > p.best) {
      p.best = dist;
      isBest = true;
      if (ghostSamples) p.ghostData = ghostSamples;
    }
    // update top-10 leaderboard
    const entry = { dist, coins, date: new Date().toLocaleDateString(), daily: isDaily };
    p.runHistory.push(entry);
    p.runHistory.sort((a, b) => b.dist - a.dist);
    if (p.runHistory.length > 10) p.runHistory.length = 10;
    // daily best
    if (isDaily) {
      const key = dailyKey();
      if (!p.dailyBests[key] || dist > p.dailyBests[key]) p.dailyBests[key] = dist;
    }
    save();
    return isBest;
  }

  function getDailyBest() {
    const p = current();
    if (!p) return 0;
    ensure(p);
    return p.dailyBests[dailyKey()] || 0;
  }

  function setGhost(samples) {
    const p = current();
    if (!p) return;
    p.ghostData = samples;
    save();
  }

  function getGhost() {
    const p = current();
    if (!p) return null;
    return p.ghostData || null;
  }

  function getLeaderboard() {
    const p = current();
    if (!p) return [];
    ensure(p);
    return p.runHistory.slice();
  }
  function owns(id) { const p = current(); return !!(p && p.owned[id]); }

  // ---- buff activation (owned buffs can be toggled off) ----
  function buffActive(id) { const p = current(); return !!(p && p.owned[id] && !ensure(p).buffsOff[id]); }
  function toggleBuff(id) {
    const p = current();
    if (!p || !p.owned[id]) return { ok: false };
    ensure(p);
    if (p.buffsOff[id]) delete p.buffsOff[id]; else p.buffsOff[id] = true;
    save();
    return { ok: true, active: !p.buffsOff[id] };
  }

  // ---- consumables (single-use boosters) ----
  function consumableCount(id) { const p = current(); return p ? (ensure(p).consumables[id] || 0) : 0; }
  function buyConsumable(id) {
    const p = current();
    if (!p) return { ok: false, error: 'No profile.' };
    ensure(p);
    const it = CONSUMABLES.find(c => c.id === id);
    if (!it) return { ok: false, error: 'Unavailable.' };
    if (p.coins < it.price) return { ok: false, error: 'Not enough coins.' };
    p.coins -= it.price;
    p.consumables[id] = (p.consumables[id] || 0) + 1;
    save();
    return { ok: true };
  }
  function useConsumable(id) {
    const p = current();
    if (!p) return false;
    ensure(p);
    if ((p.consumables[id] || 0) <= 0) return false;
    p.consumables[id] -= 1;
    save();
    return true;
  }
  function coinDoublerArmed() { const p = current(); return !!(p && ensure(p).coinDoublerArmed && p.consumables.coinDoubler > 0); }
  function setCoinDoublerArmed(v) {
    const p = current();
    if (!p) return;
    ensure(p);
    p.coinDoublerArmed = !!v;
    save();
  }

  // ---- trails (premium vanity) ----
  function trailCatalogue() { return TRAILS; }
  function ownsTrail(id) { const p = current(); return !!(p && ensure(p).trails[id]); }
  function buyTrail(id) {
    const p = current();
    if (!p) return { ok: false, error: 'No profile.' };
    ensure(p);
    const tr = TRAILS.find(t => t.id === id);
    if (!tr) return { ok: false, error: 'Unavailable.' };
    if (p.trails[id]) return { ok: false, error: 'Already owned.' };
    if (p.coins < tr.price) return { ok: false, error: 'Not enough coins.' };
    p.coins -= tr.price;
    p.trails[id] = true;
    save();
    return { ok: true };
  }
  function equipTrail(id) {
    const p = current();
    if (!p) return { ok: false };
    ensure(p);
    if (id && !p.trails[id]) return { ok: false, error: 'Not owned.' };
    p.equippedTrail = (p.equippedTrail === id) ? null : id;
    save();
    return { ok: true };
  }
  function equippedTrail() { const p = current(); return p ? ensure(p).equippedTrail : null; }
  function trailColor(id) { const t = TRAILS.find(t => t.id === id); return t ? t.color : null; }

  // ---- unlock progress for the profile screen ----
  function unlockCounts() {
    const p = current();
    if (!p) return null;
    ensure(p);
    const ow = id => !!p.owned[id];
    return {
      hats:    { owned: HATS.filter(h => p.cosmetics.hats[h.id]).length, total: HATS.length },
      clothes: { owned: CLOTHES.filter(c => p.cosmetics.clothes[c.id]).length, total: CLOTHES.length },
      colors:  { owned: COLORS.filter(c => p.colorsOwned[c.id]).length, total: COLORS.length },
      trails:  { owned: TRAILS.filter(t => p.trails[t.id]).length, total: TRAILS.length },
      buffs:   { owned: UPGRADES.filter(u => ow (u.id)).length, total: UPGRADES.length },
    };
  }

  function buy(id) {
    const p = current();
    const up = UPGRADES.find(u => u.id === id);
    if (!p || !up) return { ok: false, error: 'Unavailable.' };
    if (p.owned[id]) return { ok: false, error: 'Already owned.' };
    if (p.coins < up.price) return { ok: false, error: 'Not enough coins.' };
    p.coins -= up.price;
    p.owned[id] = true;
    save();
    return { ok: true };
  }

  // ---- cosmetics (hats & clothes) ----
  // type is 'hat' or 'clothes'
  function catalogue(type) { return type === 'hat' ? HATS : CLOTHES; }
  function bag(p, type) { return type === 'hat' ? p.cosmetics.hats : p.cosmetics.clothes; }

  function ownsCosmetic(type, id) {
    const p = current();
    return !!(p && bag(ensure(p), type)[id]);
  }

  function buyCosmetic(type, id) {
    const p = current();
    if (!p) return { ok: false, error: 'No profile.' };
    ensure(p);
    const item = catalogue(type).find(c => c.id === id);
    if (!item) return { ok: false, error: 'Unavailable.' };
    if (bag(p, type)[id]) return { ok: false, error: 'Already owned.' };
    if (p.coins < item.price) return { ok: false, error: 'Not enough coins.' };
    p.coins -= item.price;
    bag(p, type)[id] = true;
    save();
    return { ok: true };
  }

  // equip an owned cosmetic; passing the currently-equipped id toggles it off
  function equip(type, id) {
    const p = current();
    if (!p) return { ok: false, error: 'No profile.' };
    ensure(p);
    if (id && !bag(p, type)[id]) return { ok: false, error: 'Not owned.' };
    p.equipped[type] = (p.equipped[type] === id) ? null : id;
    save();
    return { ok: true, equipped: p.equipped[type] };
  }

  function equipped(type) {
    const p = current();
    return p && p.equipped ? p.equipped[type] : null;
  }

  // the active hat's buff id ('highJump' | 'hover' | 'revive'), or null
  function equippedHatBuff() {
    const id = equipped('hat');
    const hat = HATS.find(h => h.id === id);
    return hat ? hat.buff : null;
  }

  // ---- COLOURS (body scheme + per-item recolour) ----
  function colorCatalogue() { return COLORS; }
  function ownsColor(id) { const p = current(); return !!(p && ensure(p).colorsOwned[id]); }

  function buyColor(id) {
    const p = current();
    if (!p) return { ok: false, error: 'No profile.' };
    ensure(p);
    const c = COLORS.find(c => c.id === id);
    if (!c) return { ok: false, error: 'Unavailable.' };
    if (p.colorsOwned[id]) return { ok: false, error: 'Already owned.' };
    if (p.coins < c.price) return { ok: false, error: 'Not enough coins.' };
    p.coins -= c.price;
    p.colorsOwned[id] = true;
    save();
    return { ok: true };
  }

  function bodyColorId() { const p = current(); return p ? ensure(p).bodyColor : 'cyan'; }
  function bodyColorHex() { return colorHex(bodyColorId()) || '#2ee6ff'; }
  function setBodyColor(id) {
    const p = current();
    if (!p) return { ok: false };
    ensure(p);
    if (!p.colorsOwned[id]) return { ok: false, error: 'Not owned.' };
    p.bodyColor = id;
    save();
    return { ok: true };
  }

  // type is 'hat' or 'clothes'
  function itemColorMap(p, type) { return type === 'hat' ? p.hatColor : p.clothesColor; }
  function itemColorId(type, id) { const p = current(); return p ? (itemColorMap(ensure(p), type)[id] || null) : null; }
  function itemColorHex(type, id) { const cid = itemColorId(type, id); return cid ? colorHex(cid) : null; }
  function setItemColor(type, id, colorId) {
    const p = current();
    if (!p) return { ok: false };
    ensure(p);
    if (colorId && !p.colorsOwned[colorId]) return { ok: false, error: 'Not owned.' };
    const map = itemColorMap(p, type);
    // clicking the active colour clears the recolour (back to default)
    if (map[id] === colorId) delete map[id];
    else if (colorId) map[id] = colorId; else delete map[id];
    save();
    return { ok: true };
  }

  // ---- XP / leveling ----
  // Add XP, rolling over level-ups. Returns a summary for UI feedback.
  function addXp(n) {
    const p = current();
    if (!p) return null;
    ensure(p);
    let leveledUp = false;
    const fromLevel = p.level;
    if (p.level >= MAX_LEVEL) {
      p.xp = xpForLevel(MAX_LEVEL); // bar stays full at max
    } else {
      p.xp += n;
      while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
        p.xp -= xpForLevel(p.level);
        p.level++;
        leveledUp = true;
      }
      if (p.level >= MAX_LEVEL) { p.level = MAX_LEVEL; p.xp = xpForLevel(MAX_LEVEL); }
    }
    save();
    return { gained: n, leveledUp, fromLevel, level: p.level, canPrestige: p.level >= MAX_LEVEL && p.prestige < MAX_PRESTIGE };
  }

  // Reset to level 1 and bank a prestige rank (requires level 60).
  function prestige() {
    const p = current();
    if (!p) return { ok: false, error: 'No profile.' };
    ensure(p);
    if (p.level < MAX_LEVEL) return { ok: false, error: 'Reach level 60 first.' };
    if (p.prestige >= MAX_PRESTIGE) return { ok: false, error: 'Max prestige reached.' };
    p.prestige++;
    p.level = 1;
    p.xp = 0;
    save();
    return { ok: true, prestige: p.prestige };
  }

  // Snapshot for the UI.
  function progress() {
    const p = current();
    if (!p) return null;
    ensure(p);
    return {
      level: p.level,
      xp: p.xp,
      need: xpForLevel(p.level),
      prestige: p.prestige,
      atMax: p.level >= MAX_LEVEL,
      canPrestige: p.level >= MAX_LEVEL && p.prestige < MAX_PRESTIGE,
      maxLevel: MAX_LEVEL,
      maxPrestige: MAX_PRESTIGE,
    };
  }

  return {
    UPGRADES, HATS, CLOTHES, COLORS, CONSUMABLES, TRAILS, MAX_LEVEL, MAX_PRESTIGE,
    load, save, list, exists, create, remove,
    setCurrent, logout, current, addCoins, spend, recordRun, owns, buy,
    buffActive, toggleBuff, unlockCounts,
    consumableCount, buyConsumable, useConsumable, coinDoublerArmed, setCoinDoublerArmed,
    trailCatalogue, ownsTrail, buyTrail, equipTrail, equippedTrail, trailColor,
    ownsCosmetic, buyCosmetic, equip, equipped, equippedHatBuff,
    colorCatalogue, ownsColor, buyColor, colorHex,
    bodyColorId, bodyColorHex, setBodyColor,
    itemColorId, itemColorHex, setItemColor,
    addXp, prestige, progress,
    dailyKey, dailySeed, getDailyBest,
    setGhost, getGhost, getLeaderboard,
  };
})();
