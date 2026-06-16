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

    // cosmetics + their buffs
    this.hat = null;             // equipped hat id
    this.clothes = null;         // equipped clothes id
    this.canHover = false;       // propeller hat
    this.hovering = false;
    this.hatReviveAvailable = false; // golden cowboy hat
    this.propSpin = 0;           // propeller animation
    this.trail = null;           // equipped trail effect id

    // colours
    this.bodyColor = '#2ee6ff';  // body colour scheme (bright tone)
    this.clothesTint = null;     // recolour override for clothes (hex) or null
    this.hatTint = null;         // recolour override for hat (hex) or null

    // animated skins (override the solid colour/tint for their slot while equipped)
    this.bodySkin = null;        // body skin id or null
    this.hatSkin = null;         // hat skin id or null
    this.clothesSkin = null;     // clothes skin id or null

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
    const accel = this.accel * this.speedMult;

    // horizontal movement — ice platforms greatly reduce traction but boost top speed
    const onIce = this.standingOn && this.standingOn.ice;
    const maxSpeed = (sprint ? this.maxSprint : this.maxRun) * this.speedMult * (onIce ? 1.35 : 1);
    const effectiveFriction = onIce ? 0.988 : this.friction;
    const effectiveAccel   = onIce ? accel * 0.3  : accel;
    if (left && !right) { this.vx -= effectiveAccel; this.dir = -1; }
    else if (right && !left) { this.vx += effectiveAccel; this.dir = 1; }
    else { this.vx *= effectiveFriction; if (Math.abs(this.vx) < 0.05) this.vx = 0; }
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

    // propeller hat: hold Jump (W) in the air while falling to hover / slow-fall
    this.hovering = false;
    if (this.canHover && !this.onGround && this.vy > 0 && Input.held('jump')) {
      this.vy = Math.min(this.vy, 1.8);
      this.hovering = true;
    }
    // spin the propeller (faster while hovering)
    this.propSpin += this.hovering ? 0.9 : 0.3;

    // pin to elevator before gravity so platform can't separate from player
    const ridingElevator = this.standingOn && this.standingOn.elevator && this.vy >= 0;
    if (ridingElevator) {
      this.y = this.standingOn.y - this.h + 1; // +1 keeps AABB overlap so collideY re-detects
      this.vy = 1; // tiny downward so collideY treats it as landing
    }

    const wasAir = !this.onGround;

    // integrate + collide
    this.x += this.vx;
    level.collideX(this);
    const impactVy = this.vy; // capture before vertical collision zeroes it
    this.y += this.vy;
    const landed = level.collideY(this);

    // ride moving platforms
    if (this.standingOn && this.standingOn.vx) {
      this.x += this.standingOn.vx;
    }
    // conveyor belt push
    if (this.standingOn && this.standingOn.conveyorPush) {
      this.vx += this.standingOn.conveyorPush * 0.25;
    }
    // elevator vertical carry — keep pinned after collision too
    if (this.standingOn && this.standingOn.elevator) {
      this.y = this.standingOn.y - this.h;
      this.vy = 0;
    }

    if (wasAir && landed && !(this.standingOn && this.standingOn.elevator)) {
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
  // t is the animation clock in seconds (drives animated skins). Optional.
  draw(ctx, t) {
    t = t || 0;
    // resolve animated skins → effective colours (skin wins over the solid colour/tint)
    const S = (typeof Skins !== 'undefined') ? Skins : null;
    this._effBody = (S && this.bodySkin) ? (S.resolveHex(S.byId(this.bodySkin), t) || this.bodyColor) : this.bodyColor;
    this._effHatTint = (S && this.hatSkin) ? (S.resolveHex(S.byId(this.hatSkin), t) || this.hatTint) : this.hatTint;
    this._effClothesTint = (S && this.clothesSkin) ? (S.resolveHex(S.byId(this.clothesSkin), t) || this.clothesTint) : this.clothesTint;
    this._skinTime = t;
    this._S = S;

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

    // head centre (hoisted so skin overlays can anchor to it)
    const headY = neckY - headR + 1;
    // shared anchor set for skin zone overlays (+ live motion for reactive skins)
    const skinA = this._anchors(shoulder, hip, headY, headR, neckY);
    skinA.motion = { speed, airborne, vy: this.vy, grounded: this.onGround };
    // body colour scheme (derive mid & dark tones from the bright base)
    const baseHex = this._effBody || this.bodyColor;
    const mid = shade(baseHex, 0.62);
    const dark = shade(baseHex, 0.4);
    // gradient ("paint") skins override the bright front pieces with a CanvasGradient
    // built in THIS transformed space (head ~ -82, feet ~ 0).
    const bodyPaint = (this._S && this.bodySkin)
      ? this._S.resolvePaint(this._S.byId(this.bodySkin), this._skinTime, ctx, { x0: -16, y0: -82, x1: 16, y1: 2 })
      : null;
    const bright = bodyPaint || baseHex;

    // --- DRAW (back limbs first for depth) ---
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // back leg + arm (slightly dimmer/thinner)
    this._limb(ctx, hip, knR, ftR, 7, mid);
    this._limb(ctx, shoulder, elR, haR, 6, mid);

    // torso (bold)
    ctx.strokeStyle = dark;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.stroke();
    // torso highlight
    ctx.strokeStyle = bright;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.stroke();

    // front leg + arm (bold, bright)
    this._limb(ctx, hip, knL, ftL, 9, bright);
    this._limb(ctx, shoulder, elL, haL, 7, bright);

    // equipped clothes — drawn AFTER the limbs so trousers/skirts cover the legs & hip
    if (this.clothes) {
      const clothesPaint = (this._S && this.clothesSkin)
        ? this._S.resolvePaint(this._S.byId(this.clothesSkin), this._skinTime, ctx, { x0: -14, y0: -58, x1: 14, y1: 2 })
        : null;
      this._drawClothes(ctx, { hip, shoulder, knL, ftL, knR, ftR, elL, haL, elR, haR }, clothesPaint || this._effClothesTint);
    }

    // legendary/epic zone overlay for the CLOTHES slot (crisp focal art on top)
    if (this._S && this.clothes && this.clothesSkin) {
      this._S.drawOverlay(this._S.byId(this.clothesSkin), 'clothes', ctx, this._skinTime, skinA);
    }

    // head with neck
    ctx.strokeStyle = bright;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(0, neckY);
    ctx.stroke();

    // head fill
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = bright;
    ctx.stroke();
    // glow eye
    ctx.beginPath();
    ctx.arc(headR * 0.35, headY - 1, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // body-slot zone overlay (core identity art on the bare figure)
    if (this._S && this.bodySkin) {
      this._S.drawOverlay(this._S.byId(this.bodySkin), 'body', ctx, this._skinTime, skinA);
    }

    // equipped hat
    if (this.hat) {
      const hatPaint = (this._S && this.hatSkin)
        ? this._S.resolvePaint(this._S.byId(this.hatSkin), this._skinTime, ctx, { x0: -14, y0: -86, x1: 14, y1: -56 })
        : null;
      this._drawHat(ctx, headY, headR, hatPaint || this._effHatTint);
      // hat-slot zone overlay (band emblem + floating halo) on top of the hat
      if (this._S && this.hatSkin) {
        skinA.hatTopY = this._hatTopY(headY, headR);
        this._S.drawOverlay(this._S.byId(this.hatSkin), 'hat', ctx, this._skinTime, skinA);
      }
    }

    ctx.restore();
  }

  // Named anchor points (player local space) for skin zone overlays.
  _anchors(shoulder, hip, headY, headR, neckY) {
    return {
      chest: { x: 0, y: (shoulder.y + hip.y) / 2 },
      shoulder: { x: shoulder.x, y: shoulder.y },
      shoulderL: { x: -5, y: shoulder.y + 1 },
      shoulderR: { x: 5, y: shoulder.y + 1 },
      hip: { x: hip.x, y: hip.y },
      headY, headR, neckY,
      crownY: headY - headR,
      hatTopY: headY - headR - 2,
      hemY: -12,
    };
  }

  // Topmost y of the equipped hat (where a floating halo should sit above it).
  _hatTopY(headY, headR) {
    const crownY = headY - headR;
    if (this.hat === 'topHat') return crownY - 16;
    if (this.hat === 'propHat') return crownY - 9;
    if (this.hat === 'goldCowboy') return crownY - 2;
    return crownY - 2;
  }

  // ---- COSMETIC: HATS ----
  _drawHat(ctx, headY, headR, tint) {
    const topY = headY - headR; // crown of the head
    tint = (tint !== undefined) ? tint : this.hatTint;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (this.hat === 'topHat') {
      const c = tint || '#1a1a22';
      // brim
      ctx.fillStyle = c;
      ctx.fillRect(-headR - 3, topY - 1, (headR + 3) * 2, 3);
      // stovepipe
      ctx.fillRect(-headR + 2, topY - 16, (headR - 2) * 2, 16);
      // band
      ctx.fillStyle = shade(c, 1.6);
      ctx.fillRect(-headR + 2, topY - 5, (headR - 2) * 2, 3);
    } else if (this.hat === 'propHat') {
      const cap = tint || '#e23b3b';        // helmet/cap colour
      const capDark = shade(cap, 0.7);
      // rounded cap dome
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.arc(0, topY + 2, headR + 1, Math.PI, 0);
      ctx.fill();
      // panel seams
      ctx.strokeStyle = capDark; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, topY + 2); ctx.lineTo(0, topY - headR + 1); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, topY + 2, (headR + 1) * 0.55, Math.PI, 0); ctx.stroke();
      // front brim
      ctx.fillStyle = capDark;
      ctx.beginPath();
      ctx.ellipse(headR * 0.55, topY + 2, headR * 0.7, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // stalk + hub
      const hubY = topY - headR - 4;
      ctx.strokeStyle = '#2a2f3a'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, topY - headR + 1); ctx.lineTo(0, hubY + 1); ctx.stroke();
      // spinning 2-blade propeller
      ctx.save();
      ctx.translate(0, hubY);
      ctx.rotate(this.propSpin);
      const blade = (col, a) => {
        ctx.save(); ctx.rotate(a);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(8.5, 0, 9, 2.6, 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      // motion-blur ghost
      ctx.globalAlpha = 0.25; blade('#9fb4d8', 0.5); blade('#9fb4d8', Math.PI + 0.5);
      ctx.globalAlpha = 1;    blade('#3a7bd5', 0);   blade('#3a7bd5', Math.PI);
      ctx.restore();
      // hub cap
      ctx.beginPath(); ctx.arc(0, hubY, 2.4, 0, Math.PI * 2); ctx.fillStyle = '#ffd23c'; ctx.fill();
    } else if (this.hat === 'goldCowboy') {
      // gold while the revive is available, brown once it has been used
      const c = this.hatReviveAvailable ? (tint || '#ffd23c') : '#7a5230';
      const c2 = this.hatReviveAvailable ? shade(c, 0.7) : '#5a3a22';
      // wide brim
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, topY + 1, headR + 6, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // crown
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-headR + 2, topY + 1);
      ctx.quadraticCurveTo(-headR + 2, topY - 12, 0, topY - 12);
      ctx.quadraticCurveTo(headR - 2, topY - 12, headR - 2, topY + 1);
      ctx.fill();
      // band
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-headR + 2, topY - 3); ctx.lineTo(headR - 2, topY - 3); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- COSMETIC: CLOTHES (no buffs) ----
  // j = { hip, shoulder, knL, ftL, knR, ftR, elL, haL, elR, haR }
  _drawClothes(ctx, j, tint) {
    const { hip, shoulder, knL, ftL, knR, ftR, elL, haL, elR, haR } = j;
    tint = (tint !== undefined) ? tint : this.clothesTint;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const torso = (color, w) => {
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(shoulder.x, shoulder.y); ctx.stroke();
    };
    const oneLeg = (kn, ft, color, w) => {
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(kn.x, kn.y); ctx.lineTo(ft.x, ft.y); ctx.stroke();
    };
    // trousers cover BOTH legs (back leg slightly darker for depth)
    const pants = (color, w) => { oneLeg(knR, ftR, shade(color, 0.78), w - 1); oneLeg(knL, ftL, color, w); };
    const oneSleeve = (el, ha, color, w) => {
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(el.x, el.y); ctx.lineTo(ha.x, ha.y); ctx.stroke();
    };
    const sleeves = (color, w) => { oneSleeve(elR, haR, shade(color, 0.78), w - 1); oneSleeve(elL, haL, color, w); };
    // rounded hip/pelvis piece so the waist is never bare
    const hipPad = (color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(hip.x, hip.y + 1, r, 0, Math.PI * 2); ctx.fill(); };
    const skirt = (color, halfW, toY) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(hip.x - 5, hip.y - 2);
      ctx.quadraticCurveTo(hip.x - halfW, (hip.y + toY) / 2, hip.x - halfW, toY);
      ctx.lineTo(hip.x + halfW, toY);
      ctx.quadraticCurveTo(hip.x + halfW, (hip.y + toY) / 2, hip.x + 5, hip.y - 2);
      ctx.closePath(); ctx.fill();
      // centre fold shading
      ctx.strokeStyle = shade(color, 0.85); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(hip.x, toY); ctx.stroke();
    };
    const footY = Math.max(ftL.y, ftR.y); // lowest point = ground level

    switch (this.clothes) {
      case 'suit': {
        const c = tint || '#242c46';
        pants(c, 9);
        hipPad(c, 6);
        sleeves(c, 8);
        torso(c, 13);
        // white shirt placket
        ctx.strokeStyle = '#eef2ff'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(0, shoulder.y + 3); ctx.lineTo(0, hip.y - 5); ctx.stroke();
        // collar
        ctx.strokeStyle = '#eef2ff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-3.5, shoulder.y + 1); ctx.lineTo(0, shoulder.y + 6); ctx.lineTo(3.5, shoulder.y + 1); ctx.stroke();
        // tie
        ctx.strokeStyle = '#e23b5b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, shoulder.y + 6); ctx.lineTo(0, hip.y - 7); ctx.stroke();
        break;
      }
      case 'cowboy': {
        const c = tint || '#9a5a2b';
        // blue jeans + belt
        pants('#3f5f93', 9);
        hipPad('#3f5f93', 5);
        ctx.strokeStyle = '#caa24a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hip.x - 6, hip.y); ctx.lineTo(hip.x + 6, hip.y); ctx.stroke();
        ctx.fillStyle = '#e8c24a'; ctx.fillRect(-1.5, hip.y - 1.5, 3, 3); // buckle
        // light shirt sleeves
        sleeves('#dcc9a3', 7);
        // vest
        torso(c, 12);
        ctx.strokeStyle = shade(c, 0.7); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, shoulder.y + 1); ctx.lineTo(0, hip.y); ctx.stroke();
        // bandana
        ctx.strokeStyle = '#e23b4b'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(shoulder.x - 4, shoulder.y + 1); ctx.lineTo(shoulder.x + 4, shoulder.y + 1); ctx.stroke();
        break;
      }
      case 'street': {
        const c = tint || '#2f9f5b';
        // grey joggers
        pants('#39414f', 9);
        hipPad('#39414f', 5);
        // drawstring waist
        ctx.strokeStyle = shade('#39414f', 1.4); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(hip.x - 5, hip.y - 1); ctx.lineTo(hip.x + 5, hip.y - 1); ctx.stroke();
        // hoodie body + sleeves
        sleeves(c, 8);
        torso(c, 13);
        // hood
        ctx.fillStyle = shade(c, 0.8);
        ctx.beginPath(); ctx.arc(0, shoulder.y + 1, 5, 0, Math.PI * 2); ctx.fill();
        // kangaroo pocket
        ctx.strokeStyle = shade(c, 0.7); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0, hip.y - 7, 5.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        break;
      }
      case 'formalDress': {
        const c = tint || '#8a2bb0';
        // full-length gown
        skirt(c, 15, footY);
        hipPad(c, 6);
        torso(c, 11);
        // shoulder straps
        ctx.strokeStyle = shade(c, 1.2); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-3, shoulder.y + 1); ctx.lineTo(0, shoulder.y + 5); ctx.lineTo(3, shoulder.y + 1); ctx.stroke();
        break;
      }
      case 'weddingDress': {
        const c = tint || '#f4f4ff';
        // flowing gown
        skirt(c, 18, footY);
        hipPad(c, 6);
        torso(c, 11);
        // bodice sheen
        ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-4, shoulder.y + 4); ctx.lineTo(4, shoulder.y + 4); ctx.stroke();
        // veil falling from the head
        ctx.fillStyle = 'rgba(230,238,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(-6, shoulder.y - 2);
        ctx.quadraticCurveTo(-12, hip.y, -8, hip.y + 6);
        ctx.lineTo(8, hip.y + 6);
        ctx.quadraticCurveTo(12, hip.y, 6, shoulder.y - 2);
        ctx.closePath(); ctx.fill();
        break;
      }
    }
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

// Lighten (f>1) or darken (f<1) a #rrggbb colour, returning an rgb() string.
function shade(hex, f) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; }
  else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
  const c = v => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

// angle measured so 0 = straight down
function joint(from, angle, len) {
  return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}
// arms hang down too but swing; reuse same convention
function jointArm(from, angle, len) {
  return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}
