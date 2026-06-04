// Bold stickman with procedural skeletal animation
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 26;
    this.h = 64;
    this.vx = 0;
    this.vy = 0;
    this.dir = 1;            // facing: 1 right, -1 left
    this.onGround = false;
    this.runPhase = 0;       // animation cycle
    this.coyote = 0;         // coyote time
    this.jumpBuffer = 0;
    this.squash = 1;         // squash/stretch scale
    this.landTimer = 0;
    this.justJumped = false;
    this.justLanded = false;

    // upgrades
    this.speedMult = 1;      // x1.5 speed boost
    this.maxJumps = 1;       // 2 with double-jump upgrade
    this.jumpsUsed = 0;

    // tuning
    this.accel = 0.9;
    this.maxRun = 5.2;
    this.maxSprint = 7.8;
    this.friction = 0.82;
    this.gravity = 0.62;       // rising gravity (locked-60Hz)
    this.fallGravity = 0.7;    // pull when falling
    this.jumpVel = 14.5;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get feet() { return this.y + this.h; }

  update(dt, level) {
    this.justJumped = false;
    this.justLanded = false;
    const left = Input.held('left');
    const right = Input.held('right');
    const sprint = Input.held('run');
    const maxSpeed = (sprint ? this.maxSprint : this.maxRun) * this.speedMult;
    const accel = this.accel * this.speedMult;

    // horizontal movement
    if (left && !right) { this.vx -= accel; this.dir = -1; }
    else if (right && !left) { this.vx += accel; this.dir = 1; }
    else { this.vx *= this.friction; if (Math.abs(this.vx) < 0.05) this.vx = 0; }
    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));

    // jump (with coyote + buffer)
    if (Input.justPressed('jump')) this.jumpBuffer = 8;
    if (this.jumpBuffer > 0) this.jumpBuffer--;
    if (this.coyote > 0) this.coyote--;

    const canGround = this.onGround || this.coyote > 0;
    const canAir = !this.onGround && this.jumpsUsed < this.maxJumps;
    if (this.jumpBuffer > 0 && (canGround || canAir)) {
      // first jump from ground resets the counter to 1; air jumps increment
      this.jumpsUsed = canGround ? 1 : this.jumpsUsed + 1;
      this.vy = -this.jumpVel;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = 0.7; // stretch on takeoff
      this.justJumped = true;
    }
    // variable jump height
    if (!Input.held('jump') && this.vy < -4) this.vy *= 0.86;

    // asymmetric gravity: lighter going up, slightly more coming down for a smooth arc
    this.vy += (this.vy < 0 ? this.gravity : this.fallGravity);
    if (this.vy > 15) this.vy = 15;

    const wasAir = !this.onGround;

    // integrate + collide
    this.x += this.vx;
    level.collideX(this);
    const impactVy = this.vy; // capture before vertical collision zeroes it
    this.y += this.vy;
    const landed = level.collideY(this);

    if (wasAir && landed) {
      this.squash = Math.min(1.4, 1 + Math.abs(impactVy) * 0.02 + 0.25);
      this.landTimer = 12;
      if (impactVy > 3) this.justLanded = true; // only sound real falls
    }
    if (landed) { this.coyote = 6; this.jumpsUsed = 0; }

    // animation phase driven by speed
    const speed = Math.abs(this.vx);
    if (this.onGround) {
      this.runPhase += speed * 0.045 + 0.012;
    } else {
      this.runPhase += 0.04;
    }

    // squash recovery
    this.squash += (1 - this.squash) * 0.2;
    if (this.landTimer > 0) this.landTimer--;
  }

  // ---- STICKMAN RENDER ----
  draw(ctx) {
    const speed = Math.abs(this.vx);
    const running = this.onGround && speed > 0.4;
    const airborne = !this.onGround;

    // anchor at feet center
    const baseX = this.cx;
    const baseY = this.feet;

    // body bob
    const bob = running ? Math.sin(this.runPhase * 2) * 3 : (this.onGround ? Math.sin(this.runPhase * 0.6) * 1.2 : 0);

    ctx.save();
    ctx.translate(baseX, baseY);

    // squash & stretch
    const sx = (2 - this.squash);
    const sy = this.squash;
    ctx.scale(this.dir * sx, sy);

    // shadow on ground
    ctx.restore();
    this._drawShadow(ctx, baseX, baseY, speed);

    ctx.save();
    ctx.translate(baseX, baseY - 0 + bob);
    ctx.scale(this.dir * (2 - this.squash), this.squash);

    // proportions
    const hipY = -34;        // hip joint
    const shoulderY = -56;   // shoulder
    const neckY = -60;
    const headR = 9;
    const legLen = 18;
    const armLen = 15;

    // lean forward with speed
    const lean = running ? Math.min(0.32, speed * 0.04) : (airborne ? 0.12 : 0);
    ctx.rotate(lean);

    const p = this.runPhase;
    let lThigh, rThigh, lShin, rShin, lArm, rArm, lFore, rFore;

    if (running) {
      // RUN CYCLE — opposing legs & arms
      const a = Math.sin(p * 2);
      const b = Math.sin(p * 2 + Math.PI);
      lThigh = a * 0.9;
      rThigh = b * 0.9;
      lShin = Math.max(0, Math.sin(p * 2 + 1.1)) * 1.3 + 0.2;
      rShin = Math.max(0, Math.sin(p * 2 + 1.1 + Math.PI)) * 1.3 + 0.2;
      lArm = b * 0.95;
      rArm = a * 0.95;
      lFore = 0.5 + Math.max(0, b) * 0.6;
      rFore = 0.5 + Math.max(0, a) * 0.6;
    } else if (airborne) {
      // JUMP / FALL pose
      const rising = this.vy < 0;
      lThigh = rising ? -0.5 : 0.4;
      rThigh = rising ? -0.2 : 0.7;
      lShin = rising ? 0.9 : 0.3;
      rShin = rising ? 1.2 : 0.5;
      lArm = rising ? -1.6 : -0.9;
      rArm = rising ? -1.3 : -0.6;
      lFore = 0.4; rFore = 0.4;
    } else {
      // IDLE — subtle breathing
      const idle = Math.sin(p * 0.6) * 0.08;
      lThigh = 0.06; rThigh = -0.06;
      lShin = 0.12; rShin = 0.12;
      lArm = 0.18 + idle; rArm = 0.18 - idle;
      lFore = 0.25; rFore = 0.25;
    }

    const hip = { x: 0, y: hipY };
    const shoulder = { x: 0, y: shoulderY };

    // --- compute joints ---
    const knL = joint(hip, lThigh, legLen);
    const ftL = joint(knL, lThigh + lShin, legLen);
    const knR = joint(hip, rThigh, legLen);
    const ftR = joint(knR, rThigh + rShin, legLen);

    const elL = jointArm(shoulder, lArm, armLen);
    const haL = jointArm(elL, lArm + lFore, armLen);
    const elR = jointArm(shoulder, rArm, armLen);
    const haR = jointArm(elR, rArm + rFore, armLen);

    // --- DRAW (back limbs first for depth) ---
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // back leg + arm (slightly dimmer/thinner)
    this._limb(ctx, hip, knR, ftR, 7, '#1f8fff');
    this._limb(ctx, shoulder, elR, haR, 6, '#1f8fff');

    // torso (bold)
    ctx.strokeStyle = '#0a3a8c';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.stroke();
    // torso highlight
    ctx.strokeStyle = '#2ee6ff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.stroke();

    // front leg + arm (bold, bright)
    this._limb(ctx, hip, knL, ftL, 9, '#2ee6ff');
    this._limb(ctx, shoulder, elL, haL, 7, '#2ee6ff');

    // head with neck
    ctx.strokeStyle = '#2ee6ff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(0, neckY);
    ctx.stroke();

    // head fill
    const headY = neckY - headR + 1;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = '#0a3a8c';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2ee6ff';
    ctx.stroke();
    // glow eye
    ctx.beginPath();
    ctx.arc(headR * 0.35, headY - 1, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  _limb(ctx, a, b, c, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    // joint dots
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(b.x, b.y, width * 0.42, 0, Math.PI * 2); ctx.fill();
  }

  _drawShadow(ctx, x, y, speed) {
    if (!this.onGround) return;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// angle measured so 0 = straight down
function joint(from, angle, len) {
  return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}
// arms hang down too but swing; reuse same convention
function jointArm(from, angle, len) {
  return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}
