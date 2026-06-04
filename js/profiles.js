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
    { id: 'cowboy',       name: 'Cowboy Clothes', price: 200, desc: 'Yeehaw. Cosmetic only.' },
    { id: 'suit',         name: 'Suit & Tie',     price: 200, desc: 'Sharp dresser. Cosmetic only.' },
    { id: 'formalDress',  name: 'Formal Dress',   price: 250, desc: 'Elegant night out. Cosmetic only.' },
    { id: 'weddingDress', name: 'Wedding Dress',  price: 300, desc: 'Here comes the racer. Cosmetic only.' },
    { id: 'street',       name: 'Street Clothes', price: 150, desc: 'Casual and comfy. Cosmetic only.' },
  ];

  function newProfile(name) {
    return {
      name,
      coins: 0,
      best: 0,
      owned: { speed: false, coins: false, doubleJump: false, secondChance: false },
      cosmetics: { hats: {}, clothes: {} },
      equipped: { hat: null, clothes: null },
      level: 1,
      xp: 0,
      prestige: 0,
    };
  }

  // Backfill missing fields on profiles created before newer features existed.
  function ensure(p) {
    if (!p.cosmetics) p.cosmetics = { hats: {}, clothes: {} };
    if (!p.cosmetics.hats) p.cosmetics.hats = {};
    if (!p.cosmetics.clothes) p.cosmetics.clothes = {};
    if (!p.equipped) p.equipped = { hat: null, clothes: null };
    if (typeof p.level !== 'number') p.level = 1;
    if (typeof p.xp !== 'number') p.xp = 0;
    if (typeof p.prestige !== 'number') p.prestige = 0;
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
  function recordRun(dist) {
    const p = current();
    if (!p) return false;
    if (dist > p.best) { p.best = dist; save(); return true; }
    return false;
  }
  function owns(id) { const p = current(); return !!(p && p.owned[id]); }

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
    UPGRADES, HATS, CLOTHES, MAX_LEVEL, MAX_PRESTIGE,
    load, save, list, exists, create, remove,
    setCurrent, logout, current, addCoins, spend, recordRun, owns, buy,
    ownsCosmetic, buyCosmetic, equip, equipped, equippedHatBuff,
    addXp, prestige, progress,
  };
})();
