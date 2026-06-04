// Procedural platformer level with AABB collision
class Level {
  constructor(difficulty = 'normal') {
    this.platforms = [];
    this.coins = [];
    this.spikes = [];
    this.groundY = 520;
    this.nextX = 0;
    this.difficulty = difficulty;

    const d = { easy: 0, normal: 1, hard: 2 }[difficulty] ?? 1;
    this.gapMin = 65 + d * 20;
    this.gapMax = 115 + d * 40;
    this.dropChance = 0.25 + d * 0.12;

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
    const gap = rand(this.gapMin, this.gapMax);
    let y = this.lastY;
    const r = Math.random();
    if (r < this.dropChance) y += rand(40, 110);
    else if (r < this.dropChance + 0.35) y -= rand(40, 120);
    y = clamp(y, 250, 560);

    const w = rand(120, 260);
    const x = this.nextX + gap;
    this.platforms.push({ x, y, w, h: 220 });

    // coins: 10% chance of a "freebie" straight line at run height (no jump),
    // otherwise the usual arc you have to jump for.
    const coinRoll = Math.random();
    const isFreebie = coinRoll < 0.10;
    if (isFreebie) {
      // collect these just by running through them
      const n = 4 + (Math.random() * 3 | 0);
      const cy = y - 36; // ~player torso height while standing on the platform
      for (let i = 0; i < n; i++) {
        this.coins.push({ x: x + (w / (n + 1)) * (i + 1), y: cy, got: false });
      }
    } else if (coinRoll < 0.10 + 0.7) {
      const n = 3 + (Math.random() * 3 | 0);
      const cy = y - 34;            // arc ends at run height — grab the first while running
      const arc = rand(60, 100);    // middle coins rise into a jump
      for (let i = 0; i < n; i++) {
        this.coins.push({ x: x + (w / (n + 1)) * (i + 1), y: cy - Math.sin((i / (n - 1)) * Math.PI) * arc, got: false });
      }
    }
    // occasional spikes on wide platforms — never on a freebie row (would be a trap)
    if (!isFreebie && w > 180 && Math.random() < 0.4 + (this.difficulty === 'hard' ? 0.2 : 0)) {
      const sx = x + w * 0.5;
      this.spikes.push({ x: sx, y: y, w: 30 });
    }

    this.nextX = x + w;
    this.lastY = y;
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

  // returns 'coin' counts collected & 'dead' if hit spike
  checkInteractions(p) {
    let collected = 0;
    for (const c of this.coins) {
      if (c.got) continue;
      const dx = (p.x + p.w / 2) - c.x;
      const dy = (p.y + p.h / 2) - c.y;
      if (dx * dx + dy * dy < 26 * 26) { c.got = true; collected++; }
    }
    let dead = false;
    for (const s of this.spikes) {
      if (p.x + p.w > s.x - s.w / 2 && p.x < s.x + s.w / 2 &&
          p.feet > s.y - 16 && p.feet < s.y + 8) {
        dead = true;
      }
    }
    return { collected, dead };
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
      const y = c.y - cam.y + Math.sin(t * 0.005 + c.x) * 4;
      const sq = Math.abs(Math.cos(t * 0.004 + c.x));
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
}

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
