// Per-difficulty tuning. Normal is intentionally meaty (the old "hard"),
// Easy is a relaxed cruise, and Hard is a high-risk / high-reward gamble.
const DIFFICULTY = {
  easy: {
    gapMin: 60, gapMax: 110, dropChance: 0.22,
    emptyChance: 0.60,      // lots of breather platforms, few coins
    coinValue: 1,
    specialEnabled: false,  // no risky/secret/bonus coins
    bonusChance: 0,
    spikeChance: 0.10, spikeAnywhere: false, spikeMax: 1,
    deathPenalty: 0,
  },
  normal: {
    gapMin: 95, gapMax: 175, dropChance: 0.40,
    emptyChance: 0.42,
    coinValue: 1,
    specialEnabled: true,
    bonusChance: 0.10,
    spikeChance: 0.40, spikeAnywhere: false, spikeMax: 1,
    deathPenalty: 0,
  },
  hard: {
    gapMin: 115, gapMax: 205, dropChance: 0.52,
    emptyChance: 0.28,      // denser coin layouts
    coinValue: 2,           // standard coins are worth double
    specialEnabled: true,
    bonusChance: 0.22,      // more frequent high-value placements
    spikeChance: 0.7, spikeAnywhere: true, spikeMax: 3,
    deathPenalty: 500,      // die and you lose 500 from your balance
  },
};

// Procedural platformer level with AABB collision
class Level {
  // loadout describes the player's active abilities so we can spawn
  // ability-gated bonus coins: { doubleJump, highJump, hover }
  constructor(difficulty = 'normal', loadout = {}) {
    this.platforms = [];
    this.coins = [];
    this.spikes = [];
    this.groundY = 520;
    this.nextX = 0;
    this.difficulty = difficulty;
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.deathPenalty = this.cfg.deathPenalty;
    this.loadout = {
      doubleJump: !!loadout.doubleJump,
      highJump: !!loadout.highJump,
      hover: !!loadout.hover,
    };
    this._specialCd = 4; // platforms to wait before the next special coin

    this.gapMin = this.cfg.gapMin;
    this.gapMax = this.cfg.gapMax;
    this.dropChance = this.cfg.dropChance;

    this._seed();
  }

  _seed() {
    // solid starting pad
    this.platforms.push({ x: -120, y: this.groundY, w: 520, h: 200 });
    this.nextX = 400;
    this.lastY = this.groundY;
    for (let i = 0; i < 14; i++) this._spawnNext();
  }

  _spawnNext() {
    // ---- platform width: mostly standard, sometimes long, sometimes a small hop ----
    const lr = Math.random();
    let w, kind;
    if (lr < 0.20)      { w = rand(340, 580); kind = 'long'; }     // long sprint platform
    else if (lr < 0.32) { w = rand(85, 125);  kind = 'small'; }    // tight hop pad
    else                { w = rand(150, 280); kind = 'standard'; }

    // ---- height change ----
    let gap = rand(this.gapMin, this.gapMax);
    let y = this.lastY;
    const r = Math.random();
    if (r < this.dropChance) y += rand(40, 110);
    else if (r < this.dropChance + 0.35) y -= rand(40, 120);
    y = clamp(y, 250, 560);

    // ---- decide an ability-gated special coin (rate-limited) ----
    // The risky/secret coins WIDEN the gap into a real chasm, so resolve them
    // before placing the platform.
    const rateMul = this.difficulty === 'hard' ? 1.7 : 1; // hard spawns specials more often
    let special = null;
    if (this.cfg.specialEnabled && this._specialCd <= 0 && kind !== 'small') {
      if (this.loadout.hover && Math.random() < 0.16 * rateMul) { gap = rand(240, 320); special = 'risky'; }
      else if (this.loadout.doubleJump && this.loadout.highJump && Math.random() < 0.14 * rateMul) { gap = rand(210, 290); special = 'secret'; }
    }
    if (this.cfg.specialEnabled && !special && this._specialCd <= 0 &&
        (this.loadout.doubleJump || this.loadout.highJump) && Math.random() < this.cfg.bonusChance) {
      // hard mode mixes in a mid-tier "+50" leap coin alongside the basic "+20"
      special = (this.difficulty === 'hard' && Math.random() < 0.5) ? 'leap' : 'bonus';
    }

    const x = this.nextX + gap;
    this.platforms.push({ x, y, w, h: 220 });

    // ---- coin layout for this platform ----
    const pattern = this._spawnCoins(x, y, w, kind);

    // ---- place the special coin (values scale a little on hard) ----
    const vmul = this.difficulty === 'hard' ? 1.5 : 1;
    if (special === 'risky') {
      // big reward sitting low in the chasm: leap in, hover across, land the far edge
      this.coins.push({ x: x - gap * 0.5, y: y + 78, got: false, value: Math.round(200 * vmul), kind: 'risky' });
      this._specialCd = 11;
    } else if (special === 'secret') {
      // high in the air over the chasm: needs the leap + double jump, with a long fall waiting below
      const topY = Math.min(y, this.lastY);
      this.coins.push({ x: x - gap * 0.5, y: topY - 150, got: false, value: Math.round(100 * vmul), kind: 'secret' });
      this._specialCd = 10;
    } else if (special === 'leap') {
      // mid bonus arcing above the platform — needs a committed jump
      this.coins.push({ x: x + w * 0.5, y: y - 150, got: false, value: 50, kind: 'leap' });
      this._specialCd = 7;
    } else if (special === 'bonus') {
      // lighter bonus for a single mobility buff
      this.coins.push({ x: x + w * 0.5, y: y - 116, got: false, value: 20, kind: 'bonus' });
      this._specialCd = 8;
    }
    if (this._specialCd > 0) this._specialCd--;

    // ---- spikes ----
    this._spawnSpikes(x, y, w, pattern);

    this.nextX = x + w;
    this.lastY = y;
  }

  // Spikes. Easy/Normal place a single spike in the middle of wide platforms.
  // Hard scatters 1-3 spikes anywhere across the platform (a real minefield).
  _spawnSpikes(x, y, w, pattern) {
    const cfg = this.cfg;
    // flat freebie rows stay safe on non-hard so they aren't cheap traps
    if (!cfg.spikeAnywhere && (pattern === 'line' || pattern === 'hop')) return;

    if (cfg.spikeAnywhere) {
      if (w < 110 || Math.random() > cfg.spikeChance) return;
      const count = 1 + (Math.random() * cfg.spikeMax | 0);
      const placed = [];
      for (let i = 0; i < count; i++) {
        // keep spikes off the very edges so platforms remain landable
        const sx = x + rand(28, w - 28);
        if (placed.some(px => Math.abs(px - sx) < 46)) continue; // avoid overlap
        placed.push(sx);
        this.spikes.push({ x: sx, y, w: 30 });
      }
    } else {
      if (w > 180 && Math.random() < cfg.spikeChance) {
        this.spikes.push({ x: x + w * 0.5, y, w: 30 });
      }
    }
  }

  // Lay out the standard coins on a platform. Returns the pattern name.
  // Coin value scales with difficulty (hard coins are worth more).
  _spawnCoins(x, y, w, kind) {
    const cy = y - 34;                 // run height (player torso while standing)
    const val = this.cfg.coinValue;
    const add = (cx, cyy) => this.coins.push({ x: cx, y: cyy, got: false, value: val });

    // Many platforms carry NO coins — they should feel earned, not paved.
    const empty = this.cfg.emptyChance;
    let roll = Math.random();
    if (kind === 'long') roll = 0.1 + roll * 0.9;  // long pads slightly favour having coins
    if (kind === 'small') roll *= 0.85;            // small pads lean empty/short

    if (roll < empty) return 'none';               // empty platform — breather

    // Remap the remaining probability into [0,1] so the pattern mix stays
    // consistent regardless of how empty each difficulty is.
    const t = (roll - empty) / (1 - empty);

    if (t < 0.28) {
      // short straight run, sparse spacing
      const n = clamp(Math.round(w / 70), 2, 6);
      for (let i = 0; i < n; i++) add(x + (w / (n + 1)) * (i + 1), cy);
      return 'line';
    } else if (t < 0.56) {
      // "3-4 flat then a hop" — one or two groups, not wall-to-wall
      let cx = x + 26;
      const step = 30;
      const groups = 1 + (Math.random() * 2 | 0);
      for (let g = 0; g < groups && cx < x + w - 20; g++) {
        const run = 3 + (Math.random() * 2 | 0);
        for (let i = 0; i < run && cx < x + w - 20; i++) { add(cx, cy); cx += step; }
        if (cx < x + w - 20) { add(cx, cy - 54); cx += step + 20; } // the hop
      }
      return 'hop';
    } else if (t < 0.82) {
      // jump arc — middle coins rise into the air
      const n = 3 + (Math.random() * 2 | 0);
      const arc = rand(60, 100);
      for (let i = 0; i < n; i++) {
        add(x + (w / (n + 1)) * (i + 1), cy - Math.sin((i / (n - 1)) * Math.PI) * arc);
      }
      return 'arc';
    } else {
      // staircase climbing up across the platform
      const n = 4 + (Math.random() * 2 | 0);
      for (let i = 0; i < n; i++) add(x + (w / (n + 1)) * (i + 1), cy - i * 24);
      return 'stairs';
    }
  }

  ensureAhead(camRight) {
    while (this.nextX < camRight + 1200) this._spawnNext();
    // cull behind
    const left = camRight - 2200;
    this.platforms = this.platforms.filter(p => p.x + p.w > left);
    this.coins = this.coins.filter(c => c.x > left);
    this.spikes = this.spikes.filter(s => s.x > left);
  }

  collideX(p) {
    for (const pl of this.platforms) {
      if (this._aabb(p, pl)) {
        if (p.vx > 0) p.x = pl.x - p.w;
        else if (p.vx < 0) p.x = pl.x + pl.w;
        p.vx = 0;
      }
    }
  }

  collideY(p) {
    let landed = false;
    p.onGround = false;
    for (const pl of this.platforms) {
      if (this._aabb(p, pl)) {
        if (p.vy > 0) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
          landed = true;
        } else if (p.vy < 0) {
          p.y = pl.y + pl.h;
          p.vy = 0;
        }
      }
    }
    return landed;
  }

  _aabb(p, pl) {
    return p.x < pl.x + pl.w && p.x + p.w > pl.x &&
           p.y < pl.y + pl.h && p.y + p.h > pl.y;
  }

  // returns coin value collected, number of pickups, the best special kind, & 'dead'
  checkInteractions(p) {
    let collected = 0;   // total coin VALUE this frame
    let count = 0;       // number of coins picked up (for particle burst)
    let bonusKind = null; // 'bonus' | 'secret' | 'risky' if a special was grabbed
    const rank = { bonus: 1, leap: 2, secret: 3, risky: 4 };
    for (const c of this.coins) {
      if (c.got) continue;
      const dx = (p.x + p.w / 2) - c.x;
      const dy = (p.y + p.h / 2) - c.y;
      // special coins have a slightly larger pickup radius
      const reach = c.kind ? 30 : 26;
      if (dx * dx + dy * dy < reach * reach) {
        c.got = true;
        collected += c.value || 1;
        count++;
        if (c.kind && (!bonusKind || rank[c.kind] > rank[bonusKind])) bonusKind = c.kind;
      }
    }
    let dead = false;
    for (const s of this.spikes) {
      if (p.x + p.w > s.x - s.w / 2 && p.x < s.x + s.w / 2 &&
          p.feet > s.y - 16 && p.feet < s.y + 8) {
        dead = true;
      }
    }
    return { collected, count, bonusKind, dead };
  }

  draw(ctx, cam, t) {
    // platforms
    for (const pl of this.platforms) {
      const x = pl.x - cam.x;
      const y = pl.y - cam.y;
      if (x > ctx.canvas.width || x + pl.w < 0) continue;

      // body
      const grad = ctx.createLinearGradient(0, y, 0, y + 60);
      grad.addColorStop(0, '#243a72');
      grad.addColorStop(1, '#101a3a');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, pl.w, pl.h);

      // neon top edge
      ctx.fillStyle = '#2ee6ff';
      ctx.fillRect(x, y - 4, pl.w, 4);
      ctx.save();
      ctx.shadowColor = '#2ee6ff';
      ctx.shadowBlur = 16;
      ctx.fillRect(x, y - 4, pl.w, 3);
      ctx.restore();
    }

    // spikes
    ctx.fillStyle = '#ff3c6c';
    for (const s of this.spikes) {
      const x = s.x - cam.x;
      const y = s.y - cam.y;
      ctx.save();
      ctx.shadowColor = '#ff3c6c';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const teeth = 3;
      const tw = s.w / teeth;
      for (let i = 0; i < teeth; i++) {
        const bx = x - s.w / 2 + i * tw;
        ctx.moveTo(bx, y);
        ctx.lineTo(bx + tw / 2, y - 16);
        ctx.lineTo(bx + tw, y);
      }
      ctx.fill();
      ctx.restore();
    }

    // coins
    for (const c of this.coins) {
      if (c.got) continue;
      const x = c.x - cam.x;
      if (x > ctx.canvas.width + 40 || x < -40) continue;
      const y = c.y - cam.y + Math.sin(t * 0.005 + c.x) * 4;
      const sq = Math.abs(Math.cos(t * 0.004 + c.x));

      if (c.kind) { this._drawSpecialCoin(ctx, x, y, t, c.kind); continue; }

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.4 + sq * 0.6, 1);
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd23c';
      ctx.shadowColor = '#ffd23c';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();
    }
  }

  // Bonus / secret / risky coins: bigger, glowing, with a pulsing ring + label.
  _drawSpecialCoin(ctx, x, y, t, kind) {
    const styles = {
      bonus:  { col: '#2ee6ff', r: 11, label: '+20' },
      leap:   { col: '#3cffb0', r: 13, label: '+50' },
      secret: { col: '#ffd23c', r: 14, label: '+100' },
      risky:  { col: '#ff4dd2', r: 15, label: '+200' },
    };
    const s = styles[kind] || styles.bonus;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.006 + x);
    ctx.save();
    ctx.translate(x, y);
    // outer pulsing ring
    ctx.strokeStyle = s.col;
    ctx.globalAlpha = 0.4 + pulse * 0.4;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s.r + 5 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    // coin body
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.col;
    ctx.shadowColor = s.col;
    ctx.shadowBlur = 18;
    ctx.fill();
    // inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(-s.r * 0.3, -s.r * 0.3, s.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    // value label
    ctx.fillStyle = '#07101f';
    ctx.font = `700 ${Math.round(s.r * 0.8)}px Rajdhani, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, 0, 1);
    ctx.restore();
  }
}

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
