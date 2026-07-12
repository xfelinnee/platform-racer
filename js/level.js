// Per-difficulty tuning. Normal is intentionally meaty (the old "hard"),
// Easy is a relaxed cruise, and Hard is a high-risk / high-reward gamble.
const DIFFICULTY = {
  easy: {
    gapMin: 55, gapMax: 95, dropChance: 0.16,
    emptyChance: 0.78,      // zen cruise — mostly plain platforms, sparse coins
    coinValue: 1,
    specialEnabled: false,  // no risky/secret/bonus coins
    bonusChance: 0,
    spikeChance: 0, spikeAnywhere: false, spikeMax: 1,
    deathPenalty: 0,
    // no deadly traps and no crumbling — just a touch of gentle motion for variety
    movingChance: 0.05, crumbleChance: 0, sawChance: 0,
    iceChance: 0, conveyorChance: 0, laserChance: 0,
    elevatorChance: 0.05, turretChance: 0, bounceChance: 0.04,
  },
  normal: {
    gapMin: 95, gapMax: 175, dropChance: 0.40,
    emptyChance: 0.42,
    coinValue: 1,
    specialEnabled: true,
    bonusChance: 0.10,
    spikeChance: 0.40, spikeAnywhere: false, spikeMax: 1,
    deathPenalty: 0,
    movingChance: 0.18, crumbleChance: 0.12, sawChance: 0.10,
    iceChance: 0.12, conveyorChance: 0.10, laserChance: 0.08,
    elevatorChance: 0.08, turretChance: 0.06, bounceChance: 0.05,
  },
  hard: {
    gapMin: 115, gapMax: 205, dropChance: 0.52,
    emptyChance: 0.28,      // denser coin layouts
    coinValue: 2,           // standard coins are worth double
    specialEnabled: true,
    bonusChance: 0.22,      // more frequent high-value placements
    spikeChance: 0.7, spikeAnywhere: true, spikeMax: 3,
    deathPenalty: 500,      // die and you lose 500 from your balance
    movingChance: 0.32, crumbleChance: 0.22, sawChance: 0.22,
    iceChance: 0.18, conveyorChance: 0.14, laserChance: 0.14,
    elevatorChance: 0.12, turretChance: 0.10, bounceChance: 0.05,
  },
};

// Simple seeded PRNG (xorshift32)
function seededRng(seed) {
  let s = seed >>> 0;
  return function() {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return ((s >>> 0) / 0x100000000);
  };
}
function rrand(rng, a, b) { return a + rng() * (b - a); }

// Procedural platformer level with AABB collision
class Level {
  constructor(difficulty = 'normal', loadout = {}, rng) {
    this.platforms = [];
    this.coins = [];
    this.spikes = [];
    this.saws = [];
    this.lasers = [];
    this.turrets = [];
    this.darts = [];
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
    this._specialCd = 4;
    this._lastLaser = false;
    this._rng = rng || Math.random.bind(Math);
    this._seed();
  }

  // Interpolate from easy start values toward full difficulty over first 3000px
  _scaledCfg() {
    const RAMP_PX = 3000;
    const t = Math.min(1, Math.max(0, this.nextX / RAMP_PX));
    const lerp = (a, b) => a + (b - a) * t;
    const c = this.cfg;
    return {
      gapMin:        lerp(60,  c.gapMin),
      gapMax:        lerp(100, c.gapMax),
      dropChance:    lerp(0.10, c.dropChance),
      emptyChance:   lerp(0.70, c.emptyChance),
      coinValue:     c.coinValue,
      specialEnabled: t > 0.4 && c.specialEnabled,
      bonusChance:   lerp(0, c.bonusChance),
      spikeChance:   lerp(0, c.spikeChance),
      spikeAnywhere: t > 0.8 && c.spikeAnywhere,
      spikeMax:      Math.max(1, Math.round(lerp(1, c.spikeMax))),
      deathPenalty:  c.deathPenalty,
      movingChance:  lerp(0, c.movingChance),
      crumbleChance: lerp(0, c.crumbleChance),
      sawChance:     lerp(0, c.sawChance),
      iceChance:     lerp(0, c.iceChance || 0),
      conveyorChance: lerp(0, c.conveyorChance || 0),
      laserChance:   lerp(0, c.laserChance || 0),
      elevatorChance: lerp(0, c.elevatorChance || 0),
      turretChance:  lerp(0, c.turretChance || 0),
      bounceChance:  lerp(0, c.bounceChance || 0),
    };
  }

  _seed() {
    this.platforms.push({ x: -120, y: this.groundY, w: 520, h: 200 });
    this.nextX = 400;
    this.lastY = this.groundY;
    for (let i = 0; i < 14; i++) this._spawnNext();
  }

  _spawnNext() {
    const rng = this._rng;
    const cfg = this._scaledCfg();
    const lr = rng();
    let w, kind;
    if (lr < 0.20)      { w = rrand(rng, 340, 580); kind = 'long'; }
    else if (lr < 0.32) { w = rrand(rng, 85, 125);  kind = 'small'; }
    else                { w = rrand(rng, 150, 280); kind = 'standard'; }

    let gap = rrand(rng, cfg.gapMin, cfg.gapMax);
    let y = this.lastY;
    const r = rng();
    if (r < cfg.dropChance) y += rrand(rng, 40, 110);
    else if (r < cfg.dropChance + 0.35) y -= rrand(rng, 40, 120);
    y = clamp(y, 250, 560);

    const rateMul = this.difficulty === 'hard' ? 1.7 : 1;
    let special = null;
    if (cfg.specialEnabled && this._specialCd <= 0 && kind !== 'small') {
      if (this.loadout.hover && rng() < 0.16 * rateMul) { gap = rrand(rng, 240, 320); special = 'risky'; }
      else if (this.loadout.doubleJump && this.loadout.highJump && rng() < 0.14 * rateMul) { gap = rrand(rng, 210, 290); special = 'secret'; }
    }
    if (cfg.specialEnabled && !special && this._specialCd <= 0 &&
        (this.loadout.doubleJump || this.loadout.highJump) && rng() < cfg.bonusChance) {
      special = (this.difficulty === 'hard' && rng() < 0.5) ? 'leap' : 'bonus';
    }

    const x = this.nextX + gap;
    const pl = { x, y, w, h: 220 };
    this.platforms.push(pl);

    const pattern = this._spawnCoins(x, y, w, kind, cfg, pl);

    // attach a coin to a platform so it can ride along when the platform moves/elevates
    const addCoin = (coin) => { coin.plat = pl; coin.phase = coin.x; coin.offX = coin.x - pl.x; coin.offY = coin.y - pl.y; this.coins.push(coin); };

    const vmul = this.difficulty === 'hard' ? 1.5 : 1;
    if (special === 'risky') {
      addCoin({ x: x - gap * 0.5, y: y + 78, got: false, value: Math.round(200 * vmul), kind: 'risky' });
      this._specialCd = 11;
    } else if (special === 'secret') {
      const topY = Math.min(y, this.lastY);
      addCoin({ x: x + gap * 0.5, y: topY - 100, got: false, value: Math.round(100 * vmul), kind: 'secret' });
      this._specialCd = 11;
    } else if (special === 'leap') {
      addCoin({ x: x + w * 0.5, y: y - 116, got: false, value: Math.round(50 * vmul), kind: 'leap' });
      this._specialCd = 8;
    } else if (special === 'bonus') {
      addCoin({ x: x + w * 0.5, y: y - 116, got: false, value: 20, kind: 'bonus' });
      this._specialCd = 8;
    }
    if (this._specialCd > 0) this._specialCd--;

    // ---- hazards: moving, crumbling, saw, ice ----
    const hRoll = rng();
    let isCrumbling = false;
    if (kind !== 'small') {
      if (hRoll < cfg.movingChance) {
        const last = this.platforms[this.platforms.length - 1];
        last.moving = true;
        last.originX = x;
        last.range = rrand(rng, 40, 90);
        last.speed = (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.9);
        last.phase = rng() * Math.PI * 2;
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance) {
        const last = this.platforms[this.platforms.length - 1];
        last.w = Math.min(last.w, 180);
        last.crumble = true;
        last.crumbleTimer = 0;
        last.crumbling = false;
        last.fallen = false;
        isCrumbling = true;
        // Inject guaranteed escape platform immediately after — always reachable
        const escapeGap = rrand(rng, 30, 60);
        const escapeW   = rrand(rng, 200, 300);
        this.platforms.push({ x: last.x + last.w + escapeGap, y: last.y, w: escapeW, h: 220, _escapeTarget: true });
        this.nextX = last.x + last.w + escapeGap + escapeW;
        this.lastY  = last.y;
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance + cfg.sawChance && w > 160) {
        const parentPl = this.platforms[this.platforms.length - 1];
        const halfRange = Math.max(10, (w * 0.5 - 14) * 0.5);
        this.saws.push({
          platform: parentPl,
          localOffset: 0,
          halfRange,
          x: x + w * 0.5,
          y: y - 14,
          localSpeed: (rng() < 0.5 ? 1 : -1) * (1.2 + rng() * 1.0),
          r: 14,
          angle: 0,
        });
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance + cfg.sawChance + cfg.iceChance) {
        const last = this.platforms[this.platforms.length - 1];
        last.ice = true;
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance + cfg.sawChance + cfg.iceChance + cfg.conveyorChance) {
        const last = this.platforms[this.platforms.length - 1];
        last.conveyor = true;
        last.conveyorDir = rng() < 0.5 ? 1 : -1;
        last.conveyorSpeed = 1.8 + rng() * 1.4;
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance + cfg.sawChance + cfg.iceChance + cfg.conveyorChance + cfg.laserChance && w > 140 && !this._lastLaser) {
        // laser beam between two posts on the platform, toggles on/off
        const last = this.platforms[this.platforms.length - 1];
        this.lasers.push({
          platform: last,
          x1: x + 20,
          x2: x + w - 20,
          y: y - 28,
          onTime:  rrand(rng, 60, 90),
          offTime: rrand(rng, 120, 180),
          chargeTime: 48,        // telegraph window before the beam fires
          timer: 0,
          active: false,         // start idle so the first beam telegraphs in
          charging: false,
        });
        this._lastLaser = true;
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance + cfg.sawChance + cfg.iceChance + cfg.conveyorChance + cfg.laserChance + cfg.elevatorChance) {
        // elevator — moves vertically
        const last = this.platforms[this.platforms.length - 1];
        last.elevator = true;
        last.originY = y;
        last.elevRange = rrand(rng, 50, 120);
        last.elevSpeedUp   = 0.3 + rng() * 0.5;
        last.elevSpeedDown = 0.15 + rng() * 0.3;
        last.elevOffset = 0;
        last.elevDir = rng() < 0.5 ? 1 : -1;
        this._lastLaser = false;
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance + cfg.sawChance + cfg.iceChance + cfg.conveyorChance + cfg.laserChance + cfg.elevatorChance + cfg.turretChance && w > 120) {
        // turret mounted above this platform, fires tracking darts downward
        this.turrets.push({
          x: x + w * 0.5,
          y: y - 340,
          platformX: x,
          platformW: w,
          fireInterval: rrand(rng, 75, 130),
          timer: rrand(rng, 0, 60),
          flash: 0,
          aimAngle: Math.PI / 2,
          activated: false,
        });
        this._lastLaser = false;
      } else if (hRoll < cfg.movingChance + cfg.crumbleChance + cfg.sawChance + cfg.iceChance + cfg.conveyorChance + cfg.laserChance + cfg.elevatorChance + cfg.turretChance + cfg.bounceChance && w > 90) {
        // bounce pad — relaunches the player higher than a normal jump on contact
        const last = this.platforms[this.platforms.length - 1];
        last.bounce = true;
        last.bounceStrength = 20.5; // apex ~290px vs ~170px for a normal jump
        this._lastLaser = false;
      } else {
        this._lastLaser = false;
      }
    } else {
      this._lastLaser = false;
    }

    // ---- spikes (never on crumbling or elevator platforms) ----
    const lastPlat = this.platforms[this.platforms.length - 1];
    if (!isCrumbling && !lastPlat.elevator && !lastPlat.bounce) this._spawnSpikes(x, y, w, pattern, cfg);

    const lastPl = this.platforms[this.platforms.length - 1];
    if (!lastPl._escapeTarget) {
      this.nextX = x + w;
      this.lastY = y;
    }
  }

  _spawnSpikes(x, y, w, pattern, cfg) {
    cfg = cfg || this.cfg;
    const rng = this._rng;
    const pl = this.platforms[this.platforms.length - 1];
    // spikes on a moving platform ride along with it
    const pushSpike = (sx) => {
      const sp = { x: sx, y, w: 30 };
      if (pl && pl.moving) { sp.platform = pl; sp.offset = sx - pl.x; }
      this.spikes.push(sp);
    };
    if (!cfg.spikeAnywhere && (pattern === 'line' || pattern === 'hop')) return;
    if (cfg.spikeAnywhere) {
      if (w < 110 || rng() > cfg.spikeChance) return;
      const count = 1 + (rng() * cfg.spikeMax | 0);
      const placed = [];
      for (let i = 0; i < count; i++) {
        const sx = x + rrand(rng, 28, w - 28);
        if (placed.some(px => Math.abs(px - sx) < 46)) continue;
        placed.push(sx);
        pushSpike(sx);
      }
    } else {
      if (w > 180 && rng() < cfg.spikeChance) {
        pushSpike(x + w * 0.5);
      }
    }
  }

  _spawnCoins(x, y, w, kind, cfg, plat) {
    cfg = cfg || this.cfg;
    const rng = this._rng;
    const cy = y - 34;
    const val = cfg.coinValue;
    const add = (cx, cyy) => this.coins.push(
      plat ? { x: cx, y: cyy, got: false, value: val, phase: cx, plat, offX: cx - plat.x, offY: cyy - plat.y }
           : { x: cx, y: cyy, got: false, value: val, phase: cx }
    );
    const empty = cfg.emptyChance;
    let roll = rng();
    if (kind === 'long') roll = 0.1 + roll * 0.9;
    if (kind === 'small') roll *= 0.85;
    if (roll < empty) return 'none';
    const t = (roll - empty) / (1 - empty);
    if (t < 0.28) {
      const n = clamp(Math.round(w / 70), 2, 6);
      for (let i = 0; i < n; i++) add(x + (w / (n + 1)) * (i + 1), cy);
      return 'line';
    } else if (t < 0.56) {
      let cx = x + 26;
      const step = 30;
      const groups = 1 + (rng() * 2 | 0);
      for (let g = 0; g < groups && cx < x + w - 20; g++) {
        const run = 3 + (rng() * 2 | 0);
        for (let i = 0; i < run && cx < x + w - 20; i++) { add(cx, cy); cx += step; }
        if (cx < x + w - 20) { add(cx, cy - 54); cx += step + 20; }
      }
      return 'hop';
    } else if (t < 0.82) {
      const n = 3 + (rng() * 2 | 0);
      const arc = rrand(rng, 60, 100);
      for (let i = 0; i < n; i++) {
        add(x + (w / (n + 1)) * (i + 1), cy - Math.sin((i / (n - 1)) * Math.PI) * arc);
      }
      return 'arc';
    } else {
      const n = 4 + (rng() * 2 | 0);
      for (let i = 0; i < n; i++) add(x + (w / (n + 1)) * (i + 1), cy - i * 24);
      return 'stairs';
    }
  }

  update(dt, cam) {
    const now = Date.now();
    for (const pl of this.platforms) {
      if (!pl.moving) continue;
      const prevX = pl.x;
      pl.x = pl.originX + Math.sin(now * 0.001 * pl.speed + pl.phase) * pl.range;
      pl.vx = pl.x - prevX;
    }
    // spikes mounted on a moving platform follow it
    for (const s of this.spikes) {
      if (s.platform && s.platform.moving) s.x = s.platform.x + s.offset;
    }
    for (const pl of this.platforms) {
      if (!pl.crumbling || pl.fallen) continue;
      pl.crumbleTimer += dt;
      if (pl.crumbleTimer >= 28) pl.fallen = true;
    }
    for (const s of this.saws) {
      s.localOffset += s.localSpeed * dt;
      if (s.localOffset >  s.halfRange) { s.localOffset =  s.halfRange; s.localSpeed *= -1; }
      if (s.localOffset < -s.halfRange) { s.localOffset = -s.halfRange; s.localSpeed *= -1; }
      s.x = s.platform.x + s.platform.w * 0.5 + s.localOffset;
      s.y = s.platform.y - 14;
      s.angle += s.localSpeed * dt * 0.12;
    }
    // laser toggle
    for (const l of this.lasers) {
      l.timer += dt;
      const cycle = l.active ? l.onTime : l.offTime;
      if (l.timer >= cycle) { l.timer = 0; l.active = !l.active; }
      // telegraph: glow/flicker during the final stretch of the off-phase
      l.charging = (!l.active) && (l.timer >= l.offTime - (l.chargeTime || 48));
      // follow moving platform if applicable
      if (l.platform.moving) {
        const dx = l.platform.x - l.platform.originX;
        l.x1 = l.platform.x + 20;
        l.x2 = l.platform.x + l.platform.w - 20;
      }
      l.y = l.platform.y - 28;
    }
    // elevators — smooth linear up/down with different speeds
    for (const pl of this.platforms) {
      if (!pl.elevator) continue;
      const spd = pl.elevDir > 0 ? pl.elevSpeedDown : pl.elevSpeedUp;
      pl.elevOffset += pl.elevDir * spd * dt;
      if (pl.elevOffset > pl.elevRange)  { pl.elevOffset = pl.elevRange;  pl.elevDir = -1; }
      if (pl.elevOffset < -pl.elevRange) { pl.elevOffset = -pl.elevRange; pl.elevDir =  1; }
      pl.vy = pl.elevDir * spd;
      pl.y = pl.originY + pl.elevOffset;
    }
    // coins ride along with their moving / elevating platform so they stay collectable
    for (const c of this.coins) {
      const pl = c.plat;
      if (!pl || (!pl.moving && !pl.elevator)) continue;
      c.x = pl.x + c.offX;
      c.y = pl.y + c.offY;
    }
    // turrets fire darts from their muzzle (only when near/on screen)
    for (const tu of this.turrets) {
      if (tu.flash > 0) tu.flash -= dt;
      const onScreen = !cam || (tu.x > cam.x - 100 && tu.x < cam.x + 1400);
      if (!onScreen) continue;
      tu.timer += dt;
      if (tu.timer >= tu.fireInterval) {
        tu.timer = 0;
        tu.flash = 10;
        const a = (typeof tu.aimAngle === 'number') ? tu.aimAngle : Math.PI / 2;
        this.darts.push({
          x: tu.x + Math.cos(a) * 34, y: tu.y + Math.sin(a) * 34,
          vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5,
          speed: 4.5,
          age: 0,
          lifetime: 300,
          dead: false,
          r: 6,
        });
        if (typeof Audio2 !== 'undefined' && Audio2.sfx && Audio2.sfx.turret) Audio2.sfx.turret();
      }
    }
    // darts — slow tracking toward player (updated in checkInteractions where player pos is known)
    for (const d of this.darts) {
      if (d.dead) continue;
      d.age += dt;
      if (d.age >= d.lifetime) { d.dead = true; continue; }
      d.x += d.vx;
      d.y += d.vy;
    }
  }

  ensureAhead(camRight) {
    while (this.nextX < camRight + 1200) this._spawnNext();
    const left = camRight - 2200;
    this.platforms = this.platforms.filter(p => p.x + p.w > left);
    this.coins     = this.coins.filter(c => c.x > left);
    this.spikes    = this.spikes.filter(s => s.x > left);
    this.saws      = this.saws.filter(s => s.x + s.r > left);
    this.lasers    = this.lasers.filter(l => l.x2 > left);
    this.turrets   = this.turrets.filter(tu => tu.x > left);
    this.darts     = this.darts.filter(d => !d.dead && d.y < 800);
  }

  // nearest currently-existing solid platform to a world x — used for safe respawns
  // so a revive never drops the player onto a crumbled or culled platform
  findRespawnPlatform(x) {
    let best = null, bestDist = Infinity;
    for (const pl of this.platforms) {
      if (pl.fallen || pl.crumble) continue;
      const cx = pl.x + pl.w * 0.5;
      const d = Math.abs(cx - x);
      if (d < bestDist) { bestDist = d; best = pl; }
    }
    return best;
  }

  collideX(p) {
    for (const pl of this.platforms) {
      if (pl.fallen) continue;
      if (pl === p.standingOn) continue;
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
    p.standingOn = null;
    p.bouncePad = null;
    for (const pl of this.platforms) {
      if (pl.fallen) continue;
      if (this._aabb(p, pl)) {
        if (p.vy > 0) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
          landed = true;
          p.standingOn = pl;
          // flag bounce pads independently of standingOn so an adjacent/overlapping
          // normal platform can never suppress a launch
          if (pl.bounce) p.bouncePad = pl;
          if (pl.crumble && !pl.crumbling) { pl.crumbling = true; pl.crumbleTimer = 0; }
          if (pl.conveyor) { p.standingOn.conveyorPush = pl.conveyorDir * pl.conveyorSpeed; }
        } else if (p.vy < 0) {
          p.y = pl.y + pl.h;
          p.vy = 0;
        }
      }
    }
    return landed;
  }

  _aabb(p, pl) {
    if (pl.fallen) return false;
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
      // collision radius = coin's visual size + a little grace (specials are bigger)
      const coinR = c.kind ? 18 : 13;
      // closest point on the player's hitbox to the coin centre, so a coin grazing the
      // top of the head or the side of the body still counts as collected
      const nx = clamp(c.x, p.x, p.x + p.w);
      const ny = clamp(c.y, p.y, p.y + p.h);
      const cdx = c.x - nx, cdy = c.y - ny;
      if (cdx * cdx + cdy * cdy < coinR * coinR) {
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
    for (const s of this.saws) {
      const dx = (p.x + p.w * 0.5) - s.x;
      const dy = (p.y + p.h * 0.5) - s.y;
      if (dx * dx + dy * dy < (s.r + 10) * (s.r + 10)) dead = true;
    }
    // laser beams
    for (const l of this.lasers) {
      if (!l.active) continue;
      if (p.x + p.w > l.x1 && p.x < l.x2 &&
          p.y + p.h > l.y - 6 && p.y < l.y + 6) {
        dead = true;
      }
    }
    // turret darts — tracking toward player
    const pcx = p.x + p.w * 0.5;
    const pcy = p.y + p.h * 0.5;
    for (const d of this.darts) {
      if (d.dead) continue;
      const ddx = pcx - d.x;
      const ddy = pcy - d.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      // track toward player — fast enough to be threatening but outrunnable
      d.vx += (ddx / dist) * 0.25;
      d.vy += (ddy / dist) * 0.20;
      const spd = Math.sqrt(d.vx * d.vx + d.vy * d.vy) || 1;
      if (spd > d.speed) { d.vx = (d.vx / spd) * d.speed; d.vy = (d.vy / spd) * d.speed; }
      // kill on contact — circle vs player AABB so head & legs are covered
      const nx = clamp(d.x, p.x, p.x + p.w);
      const ny = clamp(d.y, p.y, p.y + p.h);
      const cdx = d.x - nx, cdy = d.y - ny;
      if (cdx * cdx + cdy * cdy < (d.r + 3) * (d.r + 3)) dead = true;
    }
    // turrets aim their barrel toward the player (kept pointing downward-ish)
    for (const tu of this.turrets) {
      let a = Math.atan2(pcy - tu.y, pcx - tu.x);
      const lo = 0.28, hi = Math.PI - 0.28;
      if (a < 0) a = (Math.cos(a) < 0) ? hi : lo;
      tu.aimAngle = clamp(a, lo, hi);
      // activation: as soon as the player enters range, prime a quick first shot so
      // a fast runner can't blow past before it ever fires
      const near = Math.abs(pcx - tu.x) < 620;
      if (near && !tu.activated) {
        tu.activated = true;
        const primed = tu.fireInterval - 12; // first shot ~0.2s after spotting
        if (tu.timer < primed) tu.timer = primed;
      } else if (!near) {
        tu.activated = false;
      }
    }
    return { collected, count, bonusKind, dead };
  }

  draw(ctx, cam, t) {
    // platforms
    for (const pl of this.platforms) {
      if (pl.fallen) continue;
      const shakeX = (pl.crumbling && !pl.fallen) ? (Math.sin(t * 0.6) * Math.min(pl.crumbleTimer * 0.25, 3)) : 0;
      const x = pl.x - cam.x + shakeX;
      const y = pl.y - cam.y;
      if (x > DESIGN_W + pl.w || x + pl.w < 0) continue;

      let alpha = 1;
      if (pl.crumbling) {
        const frac = Math.min(pl.crumbleTimer / 28, 1);
        alpha = (1 - frac * 0.85) * (frac > 0.6 ? (0.5 + 0.5 * Math.sin(t * 0.35)) : 1);
        alpha = Math.max(0.08, alpha);
      }
      ctx.save();
      ctx.globalAlpha = alpha;

      const edgeCol = pl.moving   ? '#ff8a3c'
                    : pl.crumble  ? '#ff4d4d'
                    : pl.ice      ? '#c8f8ff'
                    : pl.conveyor ? '#ffc832'
                    : pl.elevator ? '#a47cff'
                    : pl.bounce   ? '#39ff88'
                    : '#2ee6ff';

      const grad = ctx.createLinearGradient(0, y, 0, y + 60);
      grad.addColorStop(0, pl.moving   ? '#3a2010'
                         : pl.crumble  ? '#3a1010'
                         : pl.ice      ? '#0d2a3a'
                         : pl.conveyor ? '#2a2210'
                         : pl.elevator ? '#1a1030'
                         : pl.bounce   ? '#0d3a24'
                         : '#243a72');
      grad.addColorStop(1, '#101a3a');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, pl.w, pl.h);

      if (pl.ice) {
        ctx.fillStyle = 'rgba(180,240,255,0.13)';
        ctx.fillRect(x, y, pl.w, pl.h);
        // drifting snowflakes
        ctx.save();
        ctx.strokeStyle = 'rgba(200,245,255,0.7)';
        ctx.lineWidth = 1.2;
        const flakeCount = Math.max(3, Math.floor(pl.w / 55));
        for (let fi = 0; fi < flakeCount; fi++) {
          const seed = pl.x + fi * 137.5;
          const drift = (t * 0.9 + seed) % pl.w;
          const bob   = Math.sin(t * 0.04 + seed) * 5;
          const fx = x + (drift % pl.w);
          const fy = y - 10 + bob;
          const r  = 3.5 + Math.sin(seed) * 1.2;
          ctx.save();
          ctx.translate(fx, fy);
          for (let arm = 0; arm < 6; arm++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, r);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.restore();
      }

      // conveyor belt arrows
      if (pl.conveyor) {
        const arrowCount = Math.max(2, Math.floor(pl.w / 50));
        const arrowY = y + 8;
        const dir = pl.conveyorDir;
        const phase = (t * pl.conveyorSpeed * 0.3 * dir) % 40;
        ctx.strokeStyle = 'rgba(255,200,50,0.7)';
        ctx.lineWidth = 2;
        for (let ai = 0; ai < arrowCount + 2; ai++) {
          let ax = x + (ai * 40) + phase;
          if (ax < x || ax > x + pl.w - 10) continue;
          ctx.beginPath();
          ctx.moveTo(ax - dir * 5, arrowY - 4);
          ctx.lineTo(ax + dir * 5, arrowY);
          ctx.lineTo(ax - dir * 5, arrowY + 4);
          ctx.stroke();
        }
      }

      // elevator arrows
      if (pl.elevator) {
        ctx.save();
        ctx.strokeStyle = 'rgba(164,124,255,0.7)';
        ctx.lineWidth = 2;
        const mid = x + pl.w * 0.5;
        // up arrow
        ctx.beginPath();
        ctx.moveTo(mid - 5, y + 14);
        ctx.lineTo(mid, y + 6);
        ctx.lineTo(mid + 5, y + 14);
        ctx.stroke();
        // down arrow
        ctx.beginPath();
        ctx.moveTo(mid - 5, y + 18);
        ctx.lineTo(mid, y + 26);
        ctx.lineTo(mid + 5, y + 18);
        ctx.stroke();
        // vertical rail lines on sides
        ctx.strokeStyle = 'rgba(164,124,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, y); ctx.lineTo(x + 4, y + 50);
        ctx.moveTo(x + pl.w - 4, y); ctx.lineTo(x + pl.w - 4, y + 50);
        ctx.stroke();
        ctx.restore();
      }

      // bounce pad — fully static upward chevrons that read as "launch here" (no flashing)
      if (pl.bounce) {
        ctx.save();
        const chevW = 14, chevH = 9, gap = 26;
        const count = Math.max(1, Math.floor((pl.w - 16) / gap));
        const startX = x + (pl.w - (count - 1) * gap) / 2;
        ctx.strokeStyle = 'rgba(57,255,136,0.9)';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const cyp = y + 12; // fixed height, constant brightness — no movement or flicker
        for (let ci = 0; ci < count; ci++) {
          const cxp = startX + ci * gap;
          ctx.beginPath();
          ctx.moveTo(cxp - chevW / 2, cyp + chevH);
          ctx.lineTo(cxp, cyp);
          ctx.lineTo(cxp + chevW / 2, cyp + chevH);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.fillStyle = pl.conveyor ? '#ffc832' : edgeCol;
      ctx.fillRect(x, y - 4, pl.w, 4);
      ctx.shadowColor = pl.conveyor ? '#ffc832' : edgeCol;
      ctx.shadowBlur = 16;
      ctx.fillRect(x, y - 4, pl.w, 3);
      ctx.restore();
    }

    // saw blades
    for (const s of this.saws) {
      const sx = s.x - cam.x;
      const sy = s.y - cam.y;
      if (sx < -60 || sx > DESIGN_W + 60) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(s.angle);
      ctx.shadowColor = '#ff3c6c';
      ctx.shadowBlur = 12;
      const teeth = 10;
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * Math.PI * 2;
        const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
        const a2 = ((i + 1) / teeth) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a0) * s.r * 0.65, Math.sin(a0) * s.r * 0.65);
        ctx.lineTo(Math.cos(a1) * s.r, Math.sin(a1) * s.r);
        ctx.lineTo(Math.cos(a2) * s.r * 0.65, Math.sin(a2) * s.r * 0.65);
      }
      ctx.closePath();
      ctx.fillStyle = '#cc2244';
      ctx.fill();
      ctx.strokeStyle = '#ff3c6c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8090';
      ctx.shadowBlur = 0;
      ctx.fill();
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

    // laser beams — grounded emitter towers with a charge-up telegraph
    for (const l of this.lasers) {
      const lx1 = l.x1 - cam.x;
      const lx2 = l.x2 - cam.x;
      const ly  = l.y  - cam.y;
      if (lx2 < 0 || lx1 > DESIGN_W) continue;
      const baseY = (l.platform.y - cam.y); // platform surface — towers stand on this
      const active = !!l.active;
      const charging = !!l.charging;
      // charge ramps 0..1 over the telegraph window
      const chargeT = charging
        ? clamp((l.timer - (l.offTime - (l.chargeTime || 48))) / (l.chargeTime || 48), 0, 1)
        : 0;

      // two emitter towers, rooted on the platform so nothing floats
      for (const ex of [lx1, lx2]) {
        const towerTop = ly - 8;
        const pg = ctx.createLinearGradient(ex, towerTop, ex, baseY);
        pg.addColorStop(0, '#444b66');
        pg.addColorStop(1, '#191d2b');
        ctx.fillStyle = pg;
        ctx.fillRect(ex - 5, towerTop, 10, baseY - towerTop);
        // base plate flush with the platform
        ctx.fillStyle = '#0e1119';
        ctx.fillRect(ex - 8, baseY - 5, 16, 5);
        // emitter head
        ctx.fillStyle = '#2b3148';
        ctx.fillRect(ex - 8, ly - 9, 16, 13);
        ctx.fillStyle = '#0e1119';
        ctx.fillRect(ex - 8, ly - 9, 16, 3);
        // lens — colour and glow track the state
        const lensColor = active ? '#ff3030' : (charging ? '#ffb347' : '#5a2530');
        ctx.save();
        if (active || charging) {
          ctx.shadowColor = active ? '#ff2020' : '#ffaa30';
          ctx.shadowBlur = active ? 16 : (6 + chargeT * 12);
        }
        ctx.fillStyle = lensColor;
        ctx.beginPath();
        ctx.arc(ex, ly - 2, active ? 4.5 : (2.5 + chargeT * 1.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // beam / telegraph between the two heads (drawn at lens height)
      const by = ly - 2;
      if (active) {
        ctx.save();
        ctx.shadowColor = '#ff2020';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ff2020';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.3);
        ctx.beginPath();
        ctx.moveTo(lx1, by);
        ctx.lineTo(lx2, by);
        ctx.stroke();
        // bright core
        ctx.strokeStyle = '#ffd0d0';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(lx1, by);
        ctx.lineTo(lx2, by);
        ctx.stroke();
        ctx.restore();
      } else if (charging) {
        // pulsing dashed warning line that intensifies as the beam nears firing
        ctx.save();
        const blink = 0.25 + 0.5 * Math.abs(Math.sin(t * (0.3 + chargeT * 0.6)));
        ctx.strokeStyle = `rgba(255,170,50,${(0.3 + chargeT * 0.6) * blink})`;
        ctx.lineWidth = 1 + chargeT * 1.5;
        ctx.shadowColor = '#ffaa30';
        ctx.shadowBlur = 4 + chargeT * 8;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(lx1, by);
        ctx.lineTo(lx2, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else {
        // dim idle guide so the player can read where a beam will appear
        ctx.save();
        ctx.strokeStyle = 'rgba(255,80,80,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(lx1, by);
        ctx.lineTo(lx2, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // turrets — armored ceiling pod with an aiming cannon and a glowing red eye
    for (const tu of this.turrets) {
      const tx = tu.x - cam.x;
      const ty = tu.y - cam.y;
      if (tx < -50 || tx > DESIGN_W + 50) continue;
      const flashing = tu.flash > 0;
      const aim = (typeof tu.aimAngle === 'number') ? tu.aimAngle : Math.PI / 2;
      const recoil = flashing ? Math.min(5, tu.flash * 0.6) : 0;

      ctx.save();
      ctx.translate(tx, ty);

      // ceiling mounting stem
      ctx.fillStyle = '#262b40';
      ctx.fillRect(-3, -40, 6, 22);
      ctx.fillStyle = '#1a1e2c';
      ctx.fillRect(-9, -42, 18, 5);

      // rotating cannon barrel (drawn first so the housing overlaps its base)
      ctx.save();
      ctx.rotate(aim - Math.PI / 2);
      ctx.translate(0, -recoil);
      const bg = ctx.createLinearGradient(-6, 0, 6, 0);
      bg.addColorStop(0, '#5a627d');
      bg.addColorStop(0.5, '#3a4258');
      bg.addColorStop(1, '#23283a');
      ctx.fillStyle = bg;
      ctx.fillRect(-6, 6, 12, 28);
      // muzzle tip
      ctx.fillStyle = '#13161f';
      ctx.fillRect(-7, 30, 14, 7);
      if (flashing) {
        ctx.beginPath();
        ctx.arc(0, 40, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe27a';
        ctx.shadowColor = '#ffaa33';
        ctx.shadowBlur = 22;
        ctx.fill();
      }
      ctx.restore();

      // armored housing pod (octagon)
      const r = 17;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + i * Math.PI / 4;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const hg = ctx.createLinearGradient(0, -r, 0, r);
      hg.addColorStop(0, '#3b4364');
      hg.addColorStop(1, '#181b29');
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0e1119';
      ctx.stroke();

      // glowing red sensor eye (pulses; flares when firing)
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.12 + tu.x);
      const eyeR = flashing ? 6.5 : 4 + pulse * 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = flashing ? '#ff6b6b' : '#ff2a2a';
      ctx.shadowColor = '#ff2020';
      ctx.shadowBlur = flashing ? 22 : 10 + pulse * 8;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-1.6, -1.6, 1.4, 0, Math.PI * 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,210,210,0.9)';
      ctx.fill();

      ctx.restore();
    }

    // darts
    for (const d of this.darts) {
      if (d.dead) continue;
      const dx = d.x - cam.x;
      const dy = d.y - cam.y;
      if (dx < -20 || dx > DESIGN_W + 20 || dy < -20 || dy > DESIGN_H + 20) continue;
      ctx.save();
      ctx.translate(dx, dy);
      // rotate to face direction of travel
      const ang = Math.atan2(d.vy, d.vx);
      ctx.rotate(ang - Math.PI / 2);
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 10;
      // dart body (triangle pointing down)
      ctx.beginPath();
      ctx.moveTo(0, d.r);
      ctx.lineTo(-4, -d.r);
      ctx.lineTo(4, -d.r);
      ctx.closePath();
      ctx.fillStyle = '#dd2222';
      ctx.fill();
      // tail fins
      ctx.beginPath();
      ctx.moveTo(-4, -d.r);
      ctx.lineTo(-7, -d.r - 4);
      ctx.lineTo(0, -d.r);
      ctx.lineTo(7, -d.r - 4);
      ctx.lineTo(4, -d.r);
      ctx.fillStyle = '#aa1111';
      ctx.fill();
      ctx.restore();
    }

    // coins
    for (const c of this.coins) {
      if (c.got) continue;
      const x = c.x - cam.x;
      if (x > DESIGN_W + 40 || x < -40) continue;
      // animate with a frozen per-coin phase seed (not the live position) so coins on
      // moving platforms — and specials while the camera scrolls — don't jitter
      const ph = (c.phase != null) ? c.phase : c.x;
      const y = c.y - cam.y + Math.sin(t * 0.005 + ph) * 4;
      const sq = Math.abs(Math.cos(t * 0.004 + ph));

      if (c.kind) { this._drawSpecialCoin(ctx, x, y, t, c.kind, ph); continue; }

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
  _drawSpecialCoin(ctx, x, y, t, kind, phase) {
    const styles = {
      bonus:  { col: '#2ee6ff', r: 11, label: '+20' },
      leap:   { col: '#3cffb0', r: 13, label: '+50' },
      secret: { col: '#ffd23c', r: 14, label: '+100' },
      risky:  { col: '#ff4dd2', r: 15, label: '+200' },
    };
    const s = styles[kind] || styles.bonus;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.006 + (phase != null ? phase : x));
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

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
