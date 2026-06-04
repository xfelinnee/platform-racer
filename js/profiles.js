// Local multi-profile system: each profile keeps coins, best score, and shop unlocks.
const Profiles = (() => {
  const KEY = 'platformRacer_profiles';
  let store = { profiles: {}, current: null };

  // Shop catalogue — id, label, price, description.
  const UPGRADES = [
    { id: 'speed',        name: 'x1.5 Speed Boost',  price: 250, desc: 'Run & sprint 50% faster.' },
    { id: 'coins',        name: 'x1.5 Coin Bonus',   price: 200, desc: 'Earn 50% more coins per pickup.' },
    { id: 'doubleJump',   name: 'Double Jump',       price: 350, desc: 'Jump a second time in mid-air.' },
    { id: 'secondChance', name: '2nd Chance',        price: 400, desc: 'Revive once per run after a fatal hit.' },
  ];

  function newProfile(name) {
    return {
      name,
      coins: 0,
      best: 0,
      owned: { speed: false, coins: false, doubleJump: false, secondChance: false },
    };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.profiles) store = s;
    } catch (e) {}
    // migrate legacy single 'best' if present and no profiles yet
    if (Object.keys(store.profiles).length === 0) {
      try {
        const legacy = JSON.parse(localStorage.getItem('platformRacer') || '{}');
        if (legacy.best) {
          const p = newProfile('Player 1');
          p.best = legacy.best;
          store.profiles['Player 1'] = p;
        }
      } catch (e) {}
    }
    save();
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(store)); }

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

  return {
    UPGRADES, load, save, list, exists, create, remove,
    setCurrent, logout, current, addCoins, spend, recordRun, owns, buy,
  };
})();
