// Achievements — data-driven registry (mirrors the Skins.REGISTRY pattern).
// Every achievement is a pure predicate over the profile (plus optional live-run
// stats), so the same registry can be validated server-side for multiplayer later.
// Unlocks award coins + XP and are stored on the profile as { id: ISO date }.
const Achievements = (() => {

  // check(p, counts, run) -> boolean
  //   p      = current profile (ensured)
  //   counts = Profiles.unlockCounts() snapshot (may be null)
  //   run    = live run stats { dist, coins } (zeros outside a run)
  const REGISTRY = [
    // ---- distance milestones (best run OR the run in progress) ----
    { id: 'dist100',   name: 'First Steps',       desc: 'Reach 100m in a single run.',    reward: { coins: 100,  xp: 100 },
      check: (p, c, run) => Math.max(p.best, run.dist) >= 100 },
    { id: 'dist500',   name: 'Getting Somewhere', desc: 'Reach 500m in a single run.',    reward: { coins: 300,  xp: 250 },
      check: (p, c, run) => Math.max(p.best, run.dist) >= 500 },
    { id: 'dist1000',  name: 'Kilometre Club',    desc: 'Reach 1,000m in a single run.',  reward: { coins: 750,  xp: 500 },
      check: (p, c, run) => Math.max(p.best, run.dist) >= 1000 },
    { id: 'dist5000',  name: 'Long Hauler',       desc: 'Reach 5,000m in a single run.',  reward: { coins: 2500, xp: 1500 },
      check: (p, c, run) => Math.max(p.best, run.dist) >= 5000 },
    { id: 'dist10000', name: 'Horizon Breaker',   desc: 'Reach 10,000m in a single run.', reward: { coins: 6000, xp: 4000 },
      check: (p, c, run) => Math.max(p.best, run.dist) >= 10000 },

    // ---- coins in one run (best banked OR the run in progress) ----
    { id: 'runCoins500',   name: 'Pocket Money',   desc: 'Collect 500 coins in one run.',    reward: { coins: 250,  xp: 200 },
      check: (p, c, run) => Math.max(p.stats.bestRunCoins || 0, run.coins) >= 500 },
    { id: 'runCoins1000',  name: 'Payday',         desc: 'Collect 1,000 coins in one run.',  reward: { coins: 500,  xp: 400 },
      check: (p, c, run) => Math.max(p.stats.bestRunCoins || 0, run.coins) >= 1000 },
    { id: 'runCoins5000',  name: 'Jackpot',        desc: 'Collect 5,000 coins in one run.',  reward: { coins: 2000, xp: 1200 },
      check: (p, c, run) => Math.max(p.stats.bestRunCoins || 0, run.coins) >= 5000 },
    { id: 'runCoins10000', name: "Dragon's Hoard", desc: 'Collect 10,000 coins in one run.', reward: { coins: 5000, xp: 3000 },
      check: (p, c, run) => Math.max(p.stats.bestRunCoins || 0, run.coins) >= 10000 },

    // ---- firsts ----
    { id: 'firstDeath', name: 'Learning Experience', desc: 'Die for the first time.', reward: { coins: 50, xp: 50 },
      check: (p) => p.stats.runs >= 1 },

    // ---- collection completions ----
    { id: 'allHats',    name: 'Mad Hatter',        desc: 'Unlock every hat.',            reward: { coins: 500,  xp: 400 },
      check: (p, c) => c && c.hats.total > 0 && c.hats.owned >= c.hats.total },
    { id: 'allClothes', name: 'Full Wardrobe',     desc: 'Unlock every clothing item.',  reward: { coins: 500,  xp: 400 },
      check: (p, c) => c && c.clothes.total > 0 && c.clothes.owned >= c.clothes.total },
    { id: 'allColors',  name: 'Full Spectrum',     desc: 'Unlock every colour.',         reward: { coins: 500,  xp: 400 },
      check: (p, c) => c && c.colors.total > 0 && c.colors.owned >= c.colors.total },
    { id: 'allBuffs',   name: 'Fully Loaded',      desc: 'Unlock every buff.',           reward: { coins: 500,  xp: 400 },
      check: (p, c) => c && c.buffs.total > 0 && c.buffs.owned >= c.buffs.total },
    { id: 'allTrails',  name: 'Trailblazer',       desc: 'Unlock every trail.',          reward: { coins: 1500, xp: 800 },
      check: (p, c) => c && c.trails.total > 0 && c.trails.owned >= c.trails.total },
    { id: 'allSkins',   name: 'Woven Legend',      desc: 'Unlock every cloth skin.',     reward: { coins: 3000, xp: 1500 },
      check: (p, c) => c && c.skins.total > 0 && c.skins.owned >= c.skins.total },
  ];

  function byId(id) { return REGISTRY.find(a => a.id === id) || null; }
  function list() { return REGISTRY; }

  function ownedMap() {
    const p = (typeof Profiles !== 'undefined') ? Profiles.current() : null;
    return p ? (p.achievements || {}) : {};
  }
  function has(id) { return !!ownedMap()[id]; }
  function counts() {
    const own = ownedMap();
    return { owned: REGISTRY.filter(a => own[a.id]).length, total: REGISTRY.length };
  }

  // Fired with the array of newly unlocked achievements (set by main.js to show toasts).
  let onUnlock = null;
  function setOnUnlock(fn) { onUnlock = fn; }

  // Evaluate all locked achievements. `run` = live run stats (optional).
  // Grants rewards, persists, fires onUnlock. Idempotent and cheap; safe to
  // call at run end, after purchases, on profile load, or periodically mid-run.
  function evaluate(run) {
    if (typeof Profiles === 'undefined') return [];
    const p = Profiles.current();
    if (!p) return [];
    if (!p.achievements) p.achievements = {};
    run = run || { dist: 0, coins: 0 };
    if (typeof run.dist !== 'number') run.dist = 0;
    if (typeof run.coins !== 'number') run.coins = 0;
    const cts = Profiles.unlockCounts();
    const unlocked = [];
    for (const a of REGISTRY) {
      if (p.achievements[a.id]) continue;
      let pass = false;
      try { pass = !!a.check(p, cts, run); } catch (e) { pass = false; }
      if (!pass) continue;
      p.achievements[a.id] = new Date().toISOString();
      unlocked.push(a);
    }
    if (unlocked.length) {
      for (const a of unlocked) {
        if (a.reward.coins) Profiles.addCoins(a.reward.coins);
        if (a.reward.xp) Profiles.addXp(a.reward.xp);
      }
      Profiles.save();
      if (onUnlock) { try { onUnlock(unlocked); } catch (e) {} }
    }
    return unlocked;
  }

  return { REGISTRY, byId, list, has, counts, evaluate, setOnUnlock };
})();
