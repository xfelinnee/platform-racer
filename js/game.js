// Core game: loop, camera, particles, parallax, state
class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.settings = settings;
    this.state = 'idle'; // idle | playing | paused | dead
    this.particles = [];
    this.stars = [];
    this.cam = { x: 0, y: 0 };
    this.startX = 80;
    this.onDeath = null;

    this._initStars();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random(), y: Math.random() * 0.7,
        z: 0.2 + Math.random() * 0.8,
        r: Math.random() * 1.8 + 0.4,
      });
    }
  }

  start() {
    this.resize();
    // build the ability loadout so the level can spawn ability-gated bonus coins
    const loadout = { doubleJump: false, highJump: false, hover: false };
    if (typeof Profiles !== 'undefined' && Profiles.current()) {
      loadout.doubleJump = Profiles.buffActive('doubleJump');
      const b = Profiles.equippedHatBuff();
      loadout.highJump = b === 'highJump';
      loadout.hover = b === 'hover';
    }
    this.level = new Level(this.settings.difficulty, loadout);
    this.player = new Player(this.startX, 300);
    this.cam = { x: 0, y: 0 };
    this.particles = [];
    this.time = 0;
    this.coins = 0;
    this.maxDist = 0;
    this.dustTimer = 0;

    // apply purchased upgrades from the active profile
    this.coinMult = 1;
    this.revivesLeft = 0;
    this.reviveStock = 0;       // single-use Extra Revive consumables available this run
    this.coinDoublerActive = false;
    this.invuln = 0;
    this.lastSafe = { x: this.startX, y: 300 };
    if (typeof Profiles !== 'undefined' && Profiles.current()) {
      if (Profiles.buffActive('speed')) this.player.speedMult = 1.5;
      if (Profiles.buffActive('coins')) this.coinMult = 1.5;
      if (Profiles.buffActive('doubleJump')) this.player.maxJumps = 2;
      if (Profiles.buffActive('secondChance')) this.revivesLeft = 1;

      // consumables: Extra Revive stock is spent only when used; Coin Doubler is spent now
      this.reviveStock = Profiles.consumableCount('revive');
      if (Profiles.coinDoublerArmed()) {
        Profiles.useConsumable('coinDoubler');
        this.coinDoublerActive = true;
        this.coinMult *= 5;
      }

      // equipped cosmetics + their buffs
      this.player.hat = Profiles.equipped('hat');
      this.player.clothes = Profiles.equipped('clothes');
      this.player.trail = Profiles.equippedTrail();
      // colours: body scheme + per-item recolours
      this.player.bodyColor = Profiles.bodyColorHex();
      this.player.hatTint = this.player.hat ? Profiles.itemColorHex('hat', this.player.hat) : null;
      this.player.clothesTint = this.player.clothes ? Profiles.itemColorHex('clothes', this.player.clothes) : null;
      const buff = Profiles.equippedHatBuff();
      if (buff === 'highJump') this.player.jumpVel = 16.8;     // higher leap (default 14.5)
      if (buff === 'hover') this.player.canHover = true;        // hold jump in air to slow-fall
      if (buff === 'revive') this.player.hatReviveAvailable = true; // golden cowboy: 1 free revive
    }

    this.state = 'playing';
  }

  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }

  _loop(now) {
    if (!this.last) this.last = now;
    let frame = now - this.last;
    this.last = now;
    if (frame > 250) frame = 250; // avoid spiral after tab refocus

    const STEP = 1000 / 60; // fixed 60Hz physics step
    if (this.state === 'playing') {
      this._acc = (this._acc || 0) + frame;
      let steps = 0;
      while (this._acc >= STEP && steps < 5) {
        this.time += STEP;
        this._update(1, now); // dt = 1 fixed step, frame-rate independent
        this._acc -= STEP;
        steps++;
      }
    } else {
      this._acc = 0;
    }
    this._render(now);
    requestAnimationFrame(this._loop);
  }

  _update(dt, now) {
    const p = this.player;
    p.update(dt, this.level);

    if (this.invuln > 0) this.invuln -= dt;

    // remember the last safe spot for 2nd-chance revives
    if (p.onGround) { this.lastSafe = { x: p.x, y: p.y - 4 }; }

    // movement sfx
    if (p.justJumped) Audio2.sfx.jump();
    if (p.justLanded) Audio2.sfx.land();

    // camera follows with look-ahead
    const targetX = p.x - this.vw * 0.34 + p.vx * 10;
    const targetY = p.y - this.vh * 0.55;
    this.cam.x += (targetX - this.cam.x) * 0.12;
    this.cam.y += (targetY - this.cam.y) * 0.08;
    if (this.cam.y > 120) this.cam.y = 120;

    this.level.ensureAhead(this.cam.x + this.vw);

    // interactions
    const res = this.level.checkInteractions(p);
    if (res.collected) {
      this.coins += Math.round(res.collected * this.coinMult);
      // burst scales with the NUMBER of coins (capped), not their value
      const n = Math.min(40, (res.count || 1) * 6);
      const burstColor = res.bonusKind === 'risky' ? '#ff4dd2'
        : res.bonusKind === 'bonus' ? '#2ee6ff' : '#ffd23c';
      this._burst(p.cx, p.cy, burstColor, res.bonusKind ? 36 : n);
      Audio2.sfx.coin();
      if (res.bonusKind) Audio2.sfx.coin(); // double-chime for a special pickup
    }

    // run dust
    if (this.settings.particles && p.onGround && Math.abs(p.vx) > 3) {
      this.dustTimer += dt;
      if (this.dustTimer > 2) {
        this.dustTimer = 0;
        this.particles.push({
          x: p.cx - p.dir * 10, y: p.feet - 2,
          vx: -p.dir * (1 + Math.random()), vy: -Math.random() * 1.5,
          life: 24, max: 24, r: 3 + Math.random() * 3, c: '#6fa8ff',
        });
      }
    }

    // equipped trail effect (premium vanity) — only while actually moving
    const moving = Math.abs(p.vx) > 0.6 || !p.onGround;
    if (this.player.trail && this.settings.particles && moving) {
      this._trailTimer = (this._trailTimer || 0) + dt;
      if (this._trailTimer >= 1.5) { this._trailTimer = 0; this._emitTrail(); }
    }

    // death: fell or spike
    const fellOff = p.y > (this.level.groundY + 600);
    if ((res.dead || fellOff) && this.invuln <= 0) {
      if (this.revivesLeft > 0) { this.revivesLeft--; this._revive(); }
      else if (this.player.hatReviveAvailable) { this.player.hatReviveAvailable = false; this._revive(); } // golden cowboy hat turns brown
      else if (this.reviveStock > 0) { this.reviveStock--; Profiles.useConsumable('revive'); this._revive(); } // spend an Extra Revive
      else { this._die(); return; }
    }

    // distance / hud
    const dist = Math.max(0, Math.floor((p.x - this.startX) / 30));
    this.maxDist = Math.max(this.maxDist, dist);
    this._updateHud(dist);

    this._updateParticles(dt);
  }

  _revive() {
    const p = this.player;
    p.x = this.lastSafe.x;
    p.y = this.lastSafe.y - 40;
    p.vx = 0; p.vy = -6;
    p.jumpsUsed = 0;
    this.invuln = 90; // ~1.5s grace
    this._burst(p.cx, p.cy, '#2ee6ff', 30);
    Audio2.sfx.coin();
  }

  _die() {
    this.state = 'dead';
    Audio2.sfx.death();
    Audio2.stopMusic();
    this._burst(this.player.cx, this.player.cy, '#ff3c6c', 30);
    // bank the coins earned this run
    if (typeof Profiles !== 'undefined' && Profiles.current() && this.coins > 0) {
      Profiles.addCoins(this.coins);
    }
    if (this.onDeath) this.onDeath(this.maxDist, this.coins);
  }

  _emitTrail() {
    const p = this.player;
    const id = p.trail;
    const back = -(p.dir || 1);
    let c, g = 0.04, r = 2.5 + Math.random() * 2.5, life = 22 + Math.random() * 10;
    if (id === 'rainbow') { c = `hsl(${Math.floor(this.time * 0.18) % 360}, 90%, 62%)`; }
    else if (id === 'flame') { c = Math.random() < 0.5 ? '#ff7a1a' : '#ffd23c'; g = -0.04; }
    else if (id === 'bubble') { c = '#9fdcff'; g = -0.06; r = 2 + Math.random() * 3; }
    else if (id === 'shadow') { c = '#7a4dff'; g = 0.02; }
    else { c = '#2ee6ff'; } // spark
    this.particles.push({
      x: p.cx + back * 6 + (Math.random() - 0.5) * 6,
      y: p.cy + 4 + (Math.random() - 0.5) * 8,
      vx: back * (0.4 + Math.random() * 0.8), vy: -0.3 + Math.random() * -0.8,
      life, max: life, r, c, g,
    });
  }

  _burst(x, y, color, n) {
    if (!this.settings.particles) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 5;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
        life: 30 + Math.random() * 20, max: 50, r: 2 + Math.random() * 3, c: color, g: 0.18,
      });
    }
  }

  _updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.g || 0.05) * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _updateHud(dist) {
    const el = (id) => document.getElementById(id);
    el('hudTime').textContent = (this.time / 1000).toFixed(1);
    el('hudDist').textContent = dist;
    el('hudCoins').textContent = this.coins;
  }

  // ---------- RENDER ----------
  _render(now) {
    const ctx = this.ctx;
    const w = this.vw, h = this.vh;

    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1233');
    sky.addColorStop(0.6, '#0a1f4a');
    sky.addColorStop(1, '#071129');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // parallax stars
    for (const s of this.stars) {
      const px = (s.x * w - this.cam.x * s.z * 0.15) % w;
      const x = (px + w) % w;
      const y = s.y * h - this.cam.y * s.z * 0.1;
      ctx.globalAlpha = 0.4 + s.z * 0.5;
      ctx.fillStyle = '#bcd4ff';
      ctx.fillRect(x, y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // distant neon mountains (parallax)
    this._mountains(ctx, w, h, this.cam.x * 0.25, '#16204f', h * 0.62, 0.5);
    this._mountains(ctx, w, h, this.cam.x * 0.45, '#1d2c66', h * 0.7, 0.9);

    if (this.level) {
      this.level.draw(ctx, this.cam, now);
    }

    // particles (behind player if dust)
    if (this.player) {
      ctx.save();
      ctx.translate(-this.cam.x, -this.cam.y);
      // blink while invulnerable after a revive
      if (this.invuln > 0 && Math.floor(now / 80) % 2 === 0) ctx.globalAlpha = 0.35;
      this.player.draw(ctx);
      ctx.restore();
    }

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.c;
      ctx.beginPath();
      ctx.arc(pt.x - this.cam.x, pt.y - this.cam.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // vignette
    const vg = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, h*0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  _mountains(ctx, w, h, offset, color, baseY, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const step = 140;
    // Index peaks by a stable WORLD index so each keeps its shape and only
    // slides smoothly as the camera moves (no shimmer, no snap-back).
    const startI = Math.floor((offset - step) / step);
    const endI = Math.ceil((offset + w + step) / step);
    ctx.beginPath();
    ctx.moveTo(startI * step - offset, h);
    for (let i = startI; i <= endI; i++) {
      const screenX = i * step - offset;
      // height is a fixed function of the world index (baseY seeds layer variety)
      const peak = baseY - (Math.sin(i * 0.9 + baseY) * 0.5 + 0.5) * 80 - 60;
      ctx.lineTo(screenX, peak);
      ctx.lineTo(screenX + step / 2, baseY);
    }
    ctx.lineTo(endI * step - offset, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
