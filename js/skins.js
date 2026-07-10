// Animated cosmetic SKINS — premium materials that sit above the solid colour palette.
// Phase 1 (Tier A): "procedural-hex" skins. Each returns a #rrggbb that changes over
// time, so it can be fed straight into the existing bodyColor / hatTint / clothesTint
// pipeline. shade() downstream still derives mid/dark tones because we always return hex.
//
// Prices are PLACEHOLDERS — to be tuned once we see them in-game (see SKINS_PLAN.md).
const Skins = (function () {
  // ---- colour helpers (all return #rrggbb so shade() keeps working) ----
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function toHex(r, g, b) {
    const c = v => ('0' + clamp(Math.round(v), 0, 255).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  }
  function parseHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shadeHex(hex, f) {
    let [r, g, b] = parseHex(hex);
    if (f <= 1) { r *= f; g *= f; b *= f; }
    else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    return toHex(r, g, b);
  }
  function lerpHex(h1, h2, t) {
    const a = parseHex(h1), b = parseHex(h2);
    return toHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const hue = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
    }
    return toHex(r * 255, g * 255, b * 255);
  }

  // ---- registry ----
  // tier: 'rare' | 'epic' | 'legendary' | 'mythic'
  // scope: 'body' | 'hat' | 'clothes' | 'all'
  // kind: renderer key used by resolveHex (Tier A) / paint (Tier C, later)
  // "cloth" model: a skin is an animated fabric pattern that fills the
  // clothes garment + hat dome (the body keeps its solid colour). Rare skins are a
  // flowing solid colour (resolveHex); Epic+ skins are a flowing CanvasGradient
  // (kind:'cloth', resolvePaint). Legendary/Mythic carry an edge glow; Mythic cloths
  // are reactive (flow + shimmer respond to the player's motion).
  const REGISTRY = [
    // ---- Rare: flowing solid-colour cloths (resolveHex) ----
    {
      id: 'pulse', name: 'Pulse', tier: 'rare', scope: 'all', kind: 'pulse',
      baseHex: '#2ee6ff', loop: 2.0, price: 300,
      desc: 'Brightness breathes in a smooth glow.',
      params: { lo: 0.7, hi: 1.35 },
    },
    {
      id: 'ember', name: 'Ember', tier: 'rare', scope: 'all', kind: 'ember',
      baseHex: '#ff8a3c', loop: 1.4, price: 400,
      desc: 'Flickers between molten orange and gold.',
      params: { a: '#ff3c1a', b: '#ffd23c' },
    },
    {
      id: 'spectrum', name: 'Spectrum', tier: 'rare', scope: 'all', kind: 'spectrum',
      baseHex: '#ff4dd2', loop: 6.0, price: 500,
      desc: 'Cycles slowly through the full rainbow.',
      params: { s: 0.85, l: 0.62 },
    },
    // ---- Epic: flowing-fabric cloths (animated gradient on clothes + hat dome) ----
    {
      id: 'chrome', name: 'Liquid Chrome', tier: 'epic', scope: 'all', kind: 'cloth',
      baseHex: '#9aa3b8', loop: 3.0, price: 1500,
      desc: 'A mirror-metal sheen that slides across the fabric.',
      params: { palette: ['#2c3140', '#7c869e', '#eef2fb', '#7c869e'], flow: 1, shimmer: 0.95, sharp: 9 },
    },
    {
      id: 'holo', name: 'Holographic', tier: 'epic', scope: 'all', kind: 'cloth',
      baseHex: '#b06cff', loop: 4.0, price: 1800,
      desc: 'Iridescent foil woven through the cloth.',
      params: { hue: true, s: 0.8, l: 0.62, spread: 300, flow: 1, shimmer: 0.35, sharp: 7 },
    },
    {
      id: 'circuit', name: 'Neon Circuit', tier: 'epic', scope: 'all', kind: 'cloth',
      baseHex: '#0a3a24', loop: 2.2, price: 4000,
      desc: 'Live current racing through woven neon traces.',
      params: { palette: ['#062a18', '#0a6e3e', '#0bd47a', '#aeffd9', '#0bd47a', '#0a6e3e'], flow: 2, shimmer: 0.8, sharp: 10 },
    },
    // ---- Legendary: rich multi-colour cloths with an edge glow ----
    {
      id: 'eventhorizon', name: 'Event Horizon', tier: 'legendary', scope: 'all', kind: 'cloth',
      baseHex: '#2a1458', loop: 8.0, price: 6000,
      desc: 'Woven starlight spiralling into a violet singularity.',
      params: { palette: ['#05010f', '#2a1458', '#6a2bd6', '#d62b9c', '#6a2bd6', '#2a1458'], flow: 1, shimmer: 0.6, sharp: 8, glow: '#d62b9c' },
    },
    {
      id: 'starlight', name: 'Starlight', tier: 'legendary', scope: 'all', kind: 'cloth',
      baseHex: '#13204d', loop: 9.0, price: 6000,
      desc: 'Midnight cloth that glints with passing constellations.',
      params: { palette: ['#0a1838', '#13204d', '#3a5bbf', '#dbe8ff', '#3a5bbf', '#13204d'], flow: 1, shimmer: 0.85, sharp: 12, glow: '#7fa8ff' },
    },
    {
      id: 'frostbite', name: 'Frostbite Regalia', tier: 'legendary', scope: 'all', kind: 'cloth',
      baseHex: '#0e4a57', loop: 6.0, price: 6000,
      desc: 'Living glacier-silk with a sweeping crystalline glint.',
      params: { palette: ['#0e4a57', '#2a8fb0', '#66e0ff', '#eaffff', '#66e0ff', '#2a8fb0'], flow: 1, shimmer: 0.9, sharp: 11, glow: '#9fe8ff' },
    },
    // ---- Mythic: reactive cloths (flow + shimmer respond to motion) + edge glow ----
    {
      id: 'molten', name: 'Molten Sovereign', tier: 'mythic', scope: 'all', kind: 'cloth',
      baseHex: '#2a1410', loop: 4.0, price: 12000,
      desc: 'Forged lava-cloth that flows faster the harder you run.',
      params: { palette: ['#3a0a02', '#7a1505', '#c01505', '#ff7a18', '#ffd27a', '#ff7a18', '#c01505', '#7a1505'], flow: 2, shimmer: 0.8, sharp: 9, glow: '#ff5a1a', reactive: true },
    },
    {
      id: 'aurora', name: 'Aurora Veil', tier: 'mythic', scope: 'all', kind: 'cloth',
      baseHex: '#101a3a', loop: 7.0, price: 12000,
      desc: 'Flowing aurora-silk that streams brighter at speed.',
      params: { hue: true, hueBase: 120, s: 0.72, l: 0.6, spread: 220, flow: 1, shimmer: 0.6, sharp: 8, glow: '#4dffb0', reactive: true },
    },
    {
      id: 'glitch', name: 'Glitch Runes', tier: 'mythic', scope: 'all', kind: 'cloth',
      baseHex: '#160a2a', loop: 3.0, price: 12000,
      desc: 'Datastream weave that scrambles into RGB when airborne.',
      params: { palette: ['#160a2a', '#ff2a6d', '#2af0ff', '#e6b3ff', '#2af0ff', '#ff2a6d'], flow: 2, shimmer: 0.7, sharp: 10, glow: '#b46bff', reactive: true, glitch: true },
    },
  ];

  // 'cloth' = animated gradient fabric (resolvePaint). Rare kinds use resolveHex.
  const GRADIENT_KINDS = { cloth: true };
  function isGradient(skin) { return !!(skin && GRADIENT_KINDS[skin.kind]); }
  function hasOverlay() { return false; } // legacy zone-overlay system retired
  // edge-glow colour for premium (legendary/mythic) cloths, or null
  function glowColor(skin) { return (skin && skin.params && skin.params.glow) || null; }

  const _byId = {};
  for (const s of REGISTRY) _byId[s.id] = s;
  function byId(id) { return id ? (_byId[id] || null) : null; }
  function list() { return REGISTRY; }

  // Does this skin apply to the given slot ('body' | 'hat' | 'clothes')?
  function scopeIncludes(skin, slot) {
    if (!skin) return false;
    return skin.scope === 'all' || skin.scope === slot;
  }

  // Skins available for a given slot.
  function forSlot(slot) { return REGISTRY.filter(s => scopeIncludes(s, slot)); }

  // ---- Tier A: resolve a time-varying #rrggbb for a skin ----
  // t is seconds. Returns null if skin is falsy.
  function resolveHex(skin, t) {
    if (!skin) return null;
    const loop = skin.loop || 3;
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    const ang = ph * Math.PI * 2;
    const pr = skin.params || {};
    switch (skin.kind) {
      case 'pulse': {
        const lo = pr.lo != null ? pr.lo : 0.75;
        const hi = pr.hi != null ? pr.hi : 1.3;
        const f = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(ang));
        return shadeHex(skin.baseHex, f);
      }
      case 'spectrum': {
        const s = pr.s != null ? pr.s : 0.85;
        const l = pr.l != null ? pr.l : 0.62;
        return hslToHex(ph * 360, s, l);
      }
      case 'ember': {
        const f = 0.5 + 0.5 * Math.sin(ang);
        return lerpHex(pr.a || '#ff3c1a', pr.b || '#ffd23c', f);
      }
      default:
        return skin.baseHex;
    }
  }

  // Sample a looping colour ramp from a palette array at position x (wraps 0..1).
  function samplePalette(pal, x) {
    x = ((x % 1) + 1) % 1;
    const f = x * pal.length;
    const i = Math.floor(f) % pal.length;
    const j = (i + 1) % pal.length;
    return lerpHex(pal[i], pal[j], f - Math.floor(f));
  }

  // ---- Cloth: resolve a flowing animated CanvasGradient ("the fabric") ----
  // The garment/hat-dome strokes & fills are painted with this gradient, so the
  // pattern flows WITHIN the clothing shape (animated cloth).
  // box = { x0, y0, x1, y1 } axis in the CURRENT ctx transform space.
  // motion = { speed, airborne, ... } drives reactive (Mythic) cloths. Optional.
  function resolvePaint(skin, t, ctx, box, motion) {
    if (!ctx || !isGradient(skin)) return null;
    const pr = skin.params || {};
    const loop = skin.loop || 3;
    // reactive cloths flow faster + shimmer harder with player speed
    let spd = 0, air = false;
    if (pr.reactive && motion) { spd = Math.min(1, Math.abs(motion.speed || 0) / 6); air = !!motion.airborne; }
    // flow MUST be an integer so the scrolling palette/hue lands exactly back on its
    // start when ph wraps (perfectly seamless loop). Reactive cloths speed up by adding
    // whole palette-cycles in speed bands, which keeps every band integer => no cut.
    const baseFlow = Math.max(1, Math.round(pr.flow != null ? pr.flow : 1));
    const flow = baseFlow + (pr.reactive ? Math.round(spd * 2) : 0);
    const shimmer = Math.min(1, (pr.shimmer != null ? pr.shimmer : 0.6) + spd * 0.3);
    const sharp = pr.sharp || 8;
    const hi = pr.hi || '#ffffff';
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    const { x0, y0, x1, y1 } = box;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    // glitch cloths jump the scroll offset in hard steps while airborne
    const jitter = (pr.glitch && air) ? ((Math.floor(t * 18) % 3) - 1) * 0.06 : 0;
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const o = i / n;
      let col;
      if (pr.hue) {
        col = hslToHex((pr.hueBase || 0) + ph * 360 * flow + o * (pr.spread || 300), pr.s != null ? pr.s : 0.8, pr.l != null ? pr.l : 0.62);
      } else {
        col = samplePalette(pr.palette, o - ph * flow + jitter);
      }
      // a narrow bright band sweeps along the cloth once per loop (signature glint)
      if (shimmer > 0) {
        let d = Math.abs((((o - ph) % 1) + 1) % 1);
        d = Math.min(d, 1 - d);
        const band = Math.pow(Math.max(0, 1 - d * sharp), 2);
        if (band > 0) col = lerpHex(col, hi, band * shimmer);
      }
      g.addColorStop(o, col);
    }
    return g;
  }

  // Public: legacy overlay entry — retired. Cloth skins render via resolvePaint, so
  // this is a no-op kept only for call-site compatibility.
  function drawOverlay() { /* retired in favour of the flowing-cloth model */ }

  // Compact swatch chip: render the flowing cloth (gradient) or flowing colour (hex).
  function drawSwatch(skin, ctx, size, t) {
    ctx.clearRect(0, 0, size, size);
    const paint = resolvePaint(skin, t, ctx, { x0: 0, y0: 0, x1: size, y1: size });
    ctx.fillStyle = paint || resolveHex(skin, t) || skin.baseHex;
    ctx.fillRect(0, 0, size, size);
  }

  // Static representative colour (for non-animated contexts / fallbacks).
  function previewHex(skin) { return skin ? skin.baseHex : null; }

  return { REGISTRY, byId, list, forSlot, scopeIncludes, isGradient, hasOverlay, glowColor, resolveHex, resolvePaint, drawOverlay, drawSwatch, previewHex, shadeHex, lerpHex, hslToHex };
})();
