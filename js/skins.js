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
  const REGISTRY = [
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
    // ---- Epic: gradient ("paint") skins — resolved via resolvePaint() ----
    {
      id: 'chrome', name: 'Liquid Chrome', tier: 'epic', scope: 'all', kind: 'chrome',
      baseHex: '#9aa3b8', loop: 3.0, price: 1500, // PLACEHOLDER price
      desc: 'A mirror-metal sheen that slides across you.',
      params: { lo: '#2c3140', base: '#9aa3b8', hi: '#ffffff', cycles: 2, sharp: 3 },
    },
    {
      id: 'holo', name: 'Holographic', tier: 'epic', scope: 'all', kind: 'holo',
      baseHex: '#b06cff', loop: 4.0, price: 1800, // PLACEHOLDER price
      desc: 'Iridescent foil that shifts through the spectrum.',
      params: { s: 0.82, l: 0.62, spread: 300 },
    },
    // ---- Epic: zone-overlay skin (themed base colour + crisp accents) ----
    {
      id: 'circuit', name: 'Neon Circuit', tier: 'epic', scope: 'all', kind: 'circuitfx',
      baseHex: '#0a3a24', loop: 2.0, price: 4000, // PLACEHOLDER price
      desc: 'A glowing emblem with a pulse that races around its ring.',
    },
    // ---- Legendary: premium animated outfit identities (zone overlays) ----
    {
      id: 'eventhorizon', name: 'Event Horizon', tier: 'legendary', scope: 'all', kind: 'cosmic',
      baseHex: '#2a1458', loop: 8.0, price: 6000, // PLACEHOLDER price
      desc: 'A worn singularity: orbit halo, plasma trim, a star pulled in each loop.',
    },
    {
      id: 'starlight', name: 'Starlight', tier: 'legendary', scope: 'all', kind: 'celestial',
      baseHex: '#13204d', loop: 9.0, price: 6000, // PLACEHOLDER price
      desc: 'Constellation crest, crescent emblem, a shooting star each loop.',
    },
    {
      id: 'frostbite', name: 'Frostbite Regalia', tier: 'legendary', scope: 'all', kind: 'glacier',
      baseHex: '#0e4a57', loop: 6.0, price: 6000, // PLACEHOLDER price
      desc: 'A living gemstone: faceted crystal with a sweeping glint and frost burst.',
    },
    // ---- Mythic: reactive FX-stacked skins (zone overlays + live motion) ----
    {
      id: 'molten', name: 'Molten Sovereign', tier: 'mythic', scope: 'all', kind: 'molten',
      baseHex: '#2a1410', loop: 4.0, price: 12000, // PLACEHOLDER price
      desc: 'A lava core with rising embers that erupt as you pick up speed.',
    },
    {
      id: 'aurora', name: 'Aurora Veil', tier: 'mythic', scope: 'all', kind: 'aurora',
      baseHex: '#101a3a', loop: 7.0, price: 12000, // PLACEHOLDER price
      desc: 'Flowing aurora ribbons and sparkle dust that stream when you run.',
    },
    {
      id: 'glitch', name: 'Glitch Runes', tier: 'mythic', scope: 'all', kind: 'glitch',
      baseHex: '#160a2a', loop: 3.0, price: 12000, // PLACEHOLDER price
      desc: 'Cycling runes that glitch and split into RGB when you jump.',
    },
  ];

  // kinds whose look is a CanvasGradient (need resolvePaint), not a flat hex.
  const GRADIENT_KINDS = { chrome: true, holo: true };
  // kinds that paint crisp decorative elements on named zones via drawOverlay().
  const OVERLAY_KINDS = { circuitfx: true, cosmic: true, celestial: true, glacier: true, molten: true, aurora: true, glitch: true };
  function isGradient(skin) { return !!(skin && GRADIENT_KINDS[skin.kind]); }
  function hasOverlay(skin) { return !!(skin && OVERLAY_KINDS[skin.kind]); }

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

  // ---- Tier B: resolve a CanvasGradient ("paint") for gradient skins ----
  // box = { x0, y0, x1, y1 } gradient axis in the CURRENT ctx transform space.
  // Returns a CanvasGradient, or null if this skin is not a gradient kind.
  function resolvePaint(skin, t, ctx, box) {
    if (!ctx || !isGradient(skin)) return null;
    const loop = skin.loop || 3;
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    const pr = skin.params || {};
    const { x0, y0, x1, y1 } = box;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    if (skin.kind === 'chrome') {
      const lo = pr.lo || '#2c3140';
      const base = pr.base || '#9aa3b8';
      const hi = pr.hi || '#ffffff';
      // Number of specular highlights travelling along the axis. Integer cycles +
      // a periodic cos() make the loop perfectly seamless (no clamped band edges).
      const cycles = pr.cycles || 2;
      const sharp = pr.sharp || 3;
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const o = i / n;
        // periodic in both o and ph; shifting ph by 1 shifts by `cycles` whole waves
        const wave = 0.5 + 0.5 * Math.cos((o - ph) * cycles * Math.PI * 2);
        const spec = Math.pow(wave, sharp); // 0 = shadow, 0.5 = base, 1 = highlight
        const col = spec > 0.5
          ? lerpHex(base, hi, (spec - 0.5) * 2)
          : lerpHex(lo, base, spec * 2);
        g.addColorStop(o, col);
      }
    } else if (skin.kind === 'holo') {
      const s = pr.s != null ? pr.s : 0.82;
      const l = pr.l != null ? pr.l : 0.62;
      const spread = pr.spread != null ? pr.spread : 300;
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const o = i / n;
        g.addColorStop(o, hslToHex(ph * 360 + o * spread, s, l));
      }
    }
    return g;
  }

  // ============================================================================
  // ZONE-OVERLAY SYSTEM (Epic/Legendary)
  // Instead of painting the whole figure, we draw crisp focal art onto named
  // zones supplied by the player: chest emblem, shoulders, hem (clothes/body),
  // band emblem + floating halo (hat). Reads instantly at gameplay distance.
  // anchors A = { chest, shoulder, shoulderL, shoulderR, hip, headY, headR,
  //               crownY, hatTopY, hemY }   (all in the player's local space)
  // ============================================================================

  // small shared drawing helpers ------------------------------------------------
  function glowDot(ctx, x, y, r, col, blur) {
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = blur || 6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 4-point sparkle (a soft star)
  function sparkle(ctx, x, y, r, col, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;
    ctx.shadowColor = col; ctx.shadowBlur = 6;
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a + Math.PI / 4) * r * 0.32, y + Math.sin(a + Math.PI / 4) * r * 0.32);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // tilted orbit ring with one travelling particle
  function orbitRing(ctx, x, y, rx, ry, t, col) {
    ctx.save();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    const a = t * 1.7;
    glowDot(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * ry, 1.7, col, 7);
    ctx.restore();
  }
  function tri01(x) { x = ((x % 1) + 1) % 1; return x < 0.5 ? x * 2 : 2 - x * 2; } // 0..1..0

  // ---- Event Horizon (cosmic) -------------------------------------------------
  function cosmicEmblem(ctx, x, y, r, t, ph) {
    ctx.save();
    // dark accretion disc with magenta rim
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, '#05010f'); rg.addColorStop(0.62, '#1a0b3a'); rg.addColorStop(1, '#d62b9c');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // glowing rim
    ctx.shadowColor = '#d62b9c'; ctx.shadowBlur = 7;
    ctx.strokeStyle = '#ff8ad6'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // rotating cyan highlight arc
    ctx.strokeStyle = '#9be8ff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r * 0.74, t * 2, t * 2 + 1.1); ctx.stroke();
    // signature: a star streak spirals in + flash (first 18% of loop)
    if (ph < 0.18) {
      const p = ph / 0.18;
      const a = p * Math.PI * 3;
      const rr = r * (2.4 - 2.0 * p);
      const sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr;
      glowDot(ctx, sx, sy, 1.6 * (1 - p) + 0.6, '#9be8ff', 6);
      ctx.globalAlpha = (1 - p) * 0.9;
      sparkle(ctx, x, y, r * (1 + p * 1.6), '#ffffff', (1 - p));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawCosmic(ctx, slot, A, t, loop) {
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    if (slot === 'hat') {
      orbitRing(ctx, 0, A.hatTopY - 5, A.headR + 3, (A.headR + 3) * 0.42, t, '#2bb8ff');
      cosmicEmblem(ctx, 0, A.crownY + 3, 3.2, t, ph);
    } else if (slot === 'clothes') {
      // plasma side trim along the torso
      ctx.save();
      ctx.strokeStyle = '#d62b9c'; ctx.shadowColor = '#d62b9c'; ctx.shadowBlur = 5;
      ctx.lineWidth = 1.4; ctx.globalAlpha = 0.5 + 0.4 * tri01(t / 1.6);
      ctx.beginPath(); ctx.moveTo(-3.5, A.hip.y); ctx.lineTo(-3.5, A.shoulder.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3.5, A.hip.y); ctx.lineTo(3.5, A.shoulder.y); ctx.stroke();
      ctx.restore();
      glowDot(ctx, A.shoulderL.x, A.shoulderL.y, 1.3, '#2bb8ff', 5);
      glowDot(ctx, A.shoulderR.x, A.shoulderR.y, 1.3, '#2bb8ff', 5);
      cosmicEmblem(ctx, A.chest.x, A.chest.y, 4.6, t, ph);
    } else { // body
      cosmicEmblem(ctx, A.chest.x, A.chest.y, 4.0, t, ph);
      orbitRing(ctx, 0, A.headY, A.headR + 3, (A.headR + 3) * 0.4, t, '#2bb8ff');
    }
  }

  // ---- Starlight (celestial) --------------------------------------------------
  const CONSTELLATION = [ // diamond + tail, normalised around chest
    { x: 0, y: -7, big: true }, { x: -5, y: -1 }, { x: 5, y: -1 },
    { x: 0, y: 5 }, { x: 0, y: -1.5 },
  ];
  function crescent(ctx, x, y, r, col) {
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x + r * 0.5, y - r * 0.35, r * 0.92, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function shootingStar(ctx, ph, x0, y0, dx, dy) {
    if (ph >= 0.2) return;
    const p = ph / 0.2;
    const x = x0 + dx * p, y = y0 + dy * p;
    ctx.save();
    ctx.globalAlpha = Math.sin(p * Math.PI);
    ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.shadowColor = '#cfe6ff'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * 0.12, y - dy * 0.12); ctx.stroke();
    glowDot(ctx, x, y, 1.3, '#ffffff', 6);
    ctx.restore();
  }
  function drawCelestial(ctx, slot, A, t, loop) {
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    const tw = (i) => 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6 - i * 0.9));
    if (slot === 'hat') {
      crescent(ctx, 0, A.crownY + 2, 3.0, '#ffd98a');
      const stars = [{ x: -A.headR * 0.7, y: A.hatTopY }, { x: A.headR * 0.7, y: A.hatTopY - 1 }, { x: 0, y: A.hatTopY - 4 }];
      stars.forEach((s, i) => sparkle(ctx, s.x, s.y, 2.1, '#eaf2ff', tw(i)));
      shootingStar(ctx, ph, -A.headR - 6, A.hatTopY - 2, (A.headR + 6) * 2, 4);
    } else if (slot === 'clothes' || slot === 'body') {
      const cx = A.chest.x, cy = A.chest.y;
      // connector lines
      ctx.save();
      ctx.strokeStyle = 'rgba(150,190,255,0.5)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + CONSTELLATION[1].x, cy + CONSTELLATION[1].y);
      ctx.lineTo(cx + CONSTELLATION[0].x, cy + CONSTELLATION[0].y);
      ctx.lineTo(cx + CONSTELLATION[2].x, cy + CONSTELLATION[2].y);
      ctx.lineTo(cx + CONSTELLATION[3].x, cy + CONSTELLATION[3].y);
      ctx.lineTo(cx + CONSTELLATION[1].x, cy + CONSTELLATION[1].y);
      ctx.stroke(); ctx.restore();
      CONSTELLATION.forEach((s, i) => sparkle(ctx, cx + s.x, cy + s.y, s.big ? 2.8 : 1.8, s.big ? '#ffd98a' : '#eaf2ff', tw(i)));
      shootingStar(ctx, ph, -10, A.shoulder.y - 2, 20, 8);
    }
  }

  // ---- Frostbite Regalia (glacier) -------------------------------------------
  // a faceted crystal with a sweeping internal glint
  function crystal(ctx, x, y, r, t, ph, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    const pts = [[0, -r], [r * 0.72, -r * 0.2], [r * 0.5, r], [-r * 0.5, r], [-r * 0.72, -r * 0.2]];
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#66e0ff'); g.addColorStop(0.5, '#bfeefc'); g.addColorStop(1, '#2a8fb0');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#e6f9ff'; ctx.lineWidth = 1; ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = 6; ctx.stroke();
    ctx.shadowBlur = 0;
    // facet seams
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.moveTo(-r * 0.72, -r * 0.2); ctx.lineTo(r * 0.72, -r * 0.2); ctx.stroke();
    // sweeping glint (clipped to crystal)
    ctx.clip();
    const gx = -r + 2 * r * tri01(t / 1.5);
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(gx - 1.5, -r * 1.2); ctx.lineTo(gx + 1.5, r * 1.2); ctx.stroke();
    ctx.restore();
    // signature: frost ring burst + sparkle (first 20%)
    if (ph < 0.2) {
      const p = ph / 0.2;
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = '#cffaff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, r + p * r * 1.8, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      sparkle(ctx, x - r * 0.3, y - r * 0.4, r * 0.6 * (1 - p) + 1, '#ffffff', 1 - p);
    }
  }
  function drawGlacier(ctx, slot, A, t, loop) {
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    if (slot === 'hat') {
      crystal(ctx, 0, A.crownY + 3, 3.2, t, ph, 0);
      crystal(ctx, -A.headR * 0.62, A.hatTopY + 1, 2.0, t, ph, -0.3);
      crystal(ctx, A.headR * 0.62, A.hatTopY, 2.0, t, ph, 0.3);
    } else if (slot === 'clothes' || slot === 'body') {
      // shoulder shards
      crystal(ctx, A.shoulderL.x - 0.5, A.shoulderL.y, 1.8, t, ph, -0.4);
      crystal(ctx, A.shoulderR.x + 0.5, A.shoulderR.y, 1.8, t, ph, 0.4);
      // big rotating chest crystal
      crystal(ctx, A.chest.x, A.chest.y, 5.0, t, ph, Math.sin(t * 0.5) * 0.18);
    }
  }

  // ---- Neon Circuit (circuitfx, Epic) ----------------------------------------
  function circuitEmblem(ctx, x, y, r, t, ph) {
    ctx.save();
    // hexring
    ctx.strokeStyle = '#0bd47a'; ctx.lineWidth = 1.4; ctx.shadowColor = '#0bd47a'; ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2; const fn = i ? 'lineTo' : 'moveTo'; ctx[fn](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.stroke();
    // inner cross traces
    ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x + r * 0.6, y);
    ctx.moveTo(x, y - r * 0.6); ctx.lineTo(x, y + r * 0.6); ctx.stroke();
    ctx.shadowBlur = 0;
    // node + travelling pulse around the ring
    glowDot(ctx, x, y, 1.4, '#aeffd9', 6);
    const a = ph * Math.PI * 2 - Math.PI / 2;
    glowDot(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.6, '#aeffd9', 7);
    ctx.restore();
  }
  function drawCircuitfx(ctx, slot, A, t, loop) {
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    if (slot === 'hat') {
      circuitEmblem(ctx, 0, A.crownY + 3, 3.0, t, ph);
    } else if (slot === 'clothes' || slot === 'body') {
      circuitEmblem(ctx, A.chest.x, A.chest.y, 4.4, t, ph);
    }
  }

  // ---- Molten Sovereign (molten, Mythic — speed-reactive embers) -------------
  function moltenCore(ctx, x, y, r, t, ph) {
    ctx.save();
    const pulse = 0.85 + 0.15 * Math.sin(t * 4);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r * pulse);
    rg.addColorStop(0, '#fff2b0'); rg.addColorStop(0.4, '#ff7a18'); rg.addColorStop(0.8, '#c01505'); rg.addColorStop(1, '#3a0a02');
    ctx.fillStyle = rg; ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // radiating cracks
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + t * 0.2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
      ctx.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // signature: flare ring once per loop
    if (ph < 0.16) { const p = ph / 0.16; ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r + p * r * 2.2, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function embers(ctx, x, y, r, t, spd, air) {
    ctx.save();
    const n = 5 + Math.round(spd * 7) + (air ? 4 : 0);
    const rise = r * (2.4 + spd * 3.5);
    for (let i = 0; i < n; i++) {
      const seed = i * 1.713;
      const life = ((t * (0.45 + spd * 1.3) + seed) % 1 + 1) % 1;
      const ex = x + Math.sin(seed * 5 + t * 2) * r * 0.9;
      const ey = y - life * rise;
      const a = (1 - life);
      ctx.globalAlpha = a;
      ctx.fillStyle = life < 0.5 ? '#ffd27a' : '#ff6a1a';
      ctx.beginPath(); ctx.arc(ex, ey, 1.3 * (1 - life) + 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function drawMolten(ctx, slot, A, t, loop) {
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    const m = A.motion || {}; const spd = Math.min(1, Math.abs(m.speed || 0) / 6); const air = !!m.airborne;
    if (slot === 'hat') {
      embers(ctx, 0, A.crownY + 2, 2.6, t, spd, air);
      moltenCore(ctx, 0, A.crownY + 3, 2.6, t, ph);
    } else { // clothes / body
      embers(ctx, A.chest.x, A.chest.y, 4.6, t, spd, air);
      moltenCore(ctx, A.chest.x, A.chest.y, 4.6, t, ph);
    }
  }

  // ---- Aurora Veil (aurora, Mythic — speed-reactive ribbons) ------------------
  function ribbon(ctx, x0, yTop, yBot, t, phase, col, amp) {
    ctx.save();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.75; ctx.lineWidth = 1.7;
    ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = yTop; y <= yBot; y += 1.5) {
      const xx = x0 + Math.sin(y * 0.45 + t * 2 + phase) * amp;
      if (y === yTop) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
    }
    ctx.stroke(); ctx.restore();
  }
  function drawAurora(ctx, slot, A, t, loop) {
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    const m = A.motion || {}; const spd = Math.min(1, Math.abs(m.speed || 0) / 6);
    const amp = 1.6 + spd * 3.2;
    const cols = ['#4dffb0', '#45d0ff', '#b06cff'];
    if (slot === 'hat') {
      cols.forEach((c, i) => ribbon(ctx, (i - 1) * 4, A.hatTopY - 4, A.crownY, t, i * 1.5, c, amp * 0.7));
      sparkle(ctx, 0, A.crownY + 2, 2.0, '#eaffff', 0.5 + 0.5 * Math.sin(t * 3));
    } else { // clothes / body
      const yTop = A.shoulder.y, yBot = A.hip.y + 2;
      cols.forEach((c, i) => ribbon(ctx, (i - 1) * 4, yTop, yBot, t, i * 1.5, c, amp));
      // drifting sparkle dust
      for (let i = 0; i < 4; i++) {
        const sy = yBot - (((t * 0.5 + i * 0.27) % 1)) * (yBot - yTop);
        sparkle(ctx, ((i % 2) ? 5 : -5), sy, 1.4, '#eaffff', 0.6);
      }
      // signature: bright sweep travels up the ribbons once per loop
      if (ph < 0.25) { const yy = yBot - (ph / 0.25) * (yBot - yTop); glowDot(ctx, 0, yy, 2.2, '#ffffff', 9); }
    }
  }

  // ---- Glitch Runes (glitch, Mythic — jump-reactive RGB split) ----------------
  const GLYPHS = [
    [[-1, -1], [1, -1], [0, 1]], [[-1, 0], [1, 0], [0, -1], [0, 1]],
    [[-1, -1], [1, 1]], [[-1, 1], [1, -1], [-1, -1], [1, 1]], [[0, -1], [0, 1], [-1, 0]],
  ];
  function runeFrame(ctx, x, y, r, t, ph, col, jit) {
    ctx.save();
    ctx.translate(x + (jit ? (Math.random() - 0.5) * jit : 0), y);
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.shadowColor = col; ctx.shadowBlur = 4;
    // square frame
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    // cycling glyph
    const gi = Math.floor(t * 4) % GLYPHS.length;
    const g = GLYPHS[gi];
    ctx.beginPath();
    g.forEach((p, i) => { const px = p[0] * r * 0.5, py = p[1] * r * 0.5; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.restore();
  }
  function drawGlitch(ctx, slot, A, t, loop) {
    const ph = (((t || 0) / loop) % 1 + 1) % 1;
    const m = A.motion || {}; const air = !!m.airborne;
    const burst = (ph < 0.12) ? (1 - ph / 0.12) : 0;       // once-per-loop glitch
    const split = (air ? 2.2 : 0) + burst * 2.6;            // chromatic aberration amount
    const jit = burst * 1.6;
    const x = (slot === 'hat') ? 0 : A.chest.x;
    const y = (slot === 'hat') ? A.crownY + 3 : A.chest.y;
    const r = (slot === 'hat') ? 2.6 : 4.2;
    ctx.save();
    if (split > 0.05) {
      ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'lighter';
      runeFrame(ctx, x - split, y, r, t, ph, '#ff2a6d', jit);
      runeFrame(ctx, x + split, y, r, t, ph, '#2af0ff', jit);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    runeFrame(ctx, x, y, r, t, ph, '#e6b3ff', jit);
    ctx.restore();
  }

  const OVERLAY_FNS = {
    cosmic: drawCosmic, celestial: drawCelestial, glacier: drawGlacier, circuitfx: drawCircuitfx,
    molten: drawMolten, aurora: drawAurora, glitch: drawGlitch,
  };

  // Public: draw a skin's zone overlay for the given slot. No-op for non-overlay skins.
  function drawOverlay(skin, slot, ctx, t, anchors) {
    if (!skin || !ctx || !OVERLAY_FNS[skin.kind]) return;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    OVERLAY_FNS[skin.kind](ctx, slot, anchors, t || 0, skin.loop || 6);
    ctx.restore();
  }

  // Compact representation for a small selector swatch.
  // Overlay skins draw a themed background + centred focal emblem.
  function drawSwatch(skin, ctx, size, t) {
    ctx.clearRect(0, 0, size, size);
    if (hasOverlay(skin)) {
      ctx.fillStyle = skin.baseHex; ctx.fillRect(0, 0, size, size);
      // draw the clothes focal art in centred local units, scaled to fill the chip
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(size / 20, size / 20);
      const A = {
        chest: { x: 0, y: 0 }, shoulder: { x: 0, y: -7 }, hip: { x: 0, y: 7 },
        shoulderL: { x: -6, y: -6 }, shoulderR: { x: 6, y: -6 },
        headY: 0, headR: 6, crownY: 0, hatTopY: -7, hemY: 8.5,
      };
      OVERLAY_FNS[skin.kind](ctx, 'clothes', A, t || 0, skin.loop || 6);
      ctx.restore();
      return;
    }
    const paint = resolvePaint(skin, t, ctx, { x0: 0, y0: 0, x1: size, y1: size });
    ctx.fillStyle = paint || resolveHex(skin, t) || skin.baseHex;
    ctx.fillRect(0, 0, size, size);
  }

  // Static representative colour (for non-animated contexts / fallbacks).
  function previewHex(skin) { return skin ? skin.baseHex : null; }

  return { REGISTRY, byId, list, forSlot, scopeIncludes, isGradient, hasOverlay, resolveHex, resolvePaint, drawOverlay, drawSwatch, previewHex, shadeHex, lerpHex, hslToHex };
})();
