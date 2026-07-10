# Animated Skins — Architecture & Roadmap

> Goal: animated cosmetic "skins" that sit ABOVE the existing solid-colour palette.
> Solid colours stay exactly as they are. A **Skins** toggle in the hat/clothes
> colour rows reveals premium animated materials (a recurring gold sink).
>
> Quality bar: no shortcuts. Build a reusable material pipeline, then add skins
> easiest → hardest on top of it.

---

## 0. CURRENT MODEL (v1.6.0) — "flowing cloth" ✅ SHIPPED

The zone-overlay/emblem approach (Sections 3–4 below, kept for history) was **scrapped**:
detached emblems, halos and particles floated around the stick figure and read as
clip-art rather than clothing. The shipped model is **flowing animated cloth**:

- A skin is an animated **`CanvasGradient`** painted as the `strokeStyle`/`fillStyle` of the
  garment + hat dome, so the pattern flows *inside the clothing shape*. The body keeps its
  solid colour (**scope = clothes + hat dome only**).
- `Skins.resolvePaint(skin, t, ctx, box, motion)` builds the gradient via a single generic
  builder (`samplePalette` + scrolling palette/hue + a once-per-loop shimmer band).
  - **Rare** (Pulse/Ember/Spectrum): flowing solid colour via `resolveHex` (unchanged).
  - **Epic+** (`kind:'cloth'`): flowing gradient with a `params` palette (or `hue` mode).
- **Seamless loops:** the scroll rate `flow` is forced to an **integer**, so palette/hue
  return exactly to the start when `ph` wraps. Reactive cloths add whole palette-cycles in
  speed bands (`+round(spd*2)`), staying integer (seamless) at any constant speed.
- **Edge glow** (`params.glow`) on Legendary/Mythic via `ctx.shadowColor/Blur`, applied to the
  fabric only. `_drawHat` clears the shadow before the propeller so the **spinner is never lit**.
- **Reactive Mythics** read live `motion` from `player._skinMotion = {speed, airborne, ...}`:
  faster flow + stronger shimmer at speed; *Glitch Runes* jitters while airborne.
- `Skins.drawOverlay()` is now a **no-op** (kept for call-site compatibility); the old overlay
  helper functions remain as dead code pending a cleanup pass. `player._anchors()`/`_hatTopY()`
  are unused.

Touch-points: `js/skins.js` (registry + `resolvePaint`/`samplePalette` + `glowColor`),
`js/player.js` (`draw()` paints clothes/hat with the gradient + glow; body stays solid),
`js/menu.js` (Body card is colours-only; previews show the live fabric).

---

## 1. How the current system works (ground truth)

Touch-points discovered in the codebase:

- **`js/player.js`**
  - `draw(ctx)` — renders the stickman. **No time argument.** Animation uses `this.runPhase`.
  - Colour inputs are plain hex strings: `this.bodyColor`, `this.hatTint`, `this.clothesTint`.
  - Depth tones come from `shade(hex, factor)` — **hex only**, cannot take a gradient.
  - `_drawHat(ctx, headY, headR)` — `topHat`, `propHat`, `goldCowboy`.
    - **Propeller**: stalk + blades + hub are SEPARATE geometry. A cap skin must
      paint ONLY the dome, never the spinner.
  - `_drawClothes(ctx, j)` — `suit`, `cowboy`, `street`, `formalDress`, `weddingDress`.
  - Body/torso/limbs drawn as **strokes** (round caps), not closed fills.
- **`js/game.js`**
  - `_render(now)` has `now` available; currently calls `this.player.draw(ctx)` with NO time.
  - Equip wiring in `start()`: sets `player.bodyColor`, `player.hatTint`, `player.clothesTint`
    from `Profiles.bodyColorHex()` / `Profiles.itemColorHex('hat'|'clothes', id)`.
- **`js/profiles.js`**
  - Solid colours: `COLORS[]` (`{id,name,hex,price}`), `colorHex(id)`.
  - Ownership/equip: `bodyColor` (id), `colorsOwned{}`, `hatColor{itemId:colorId}`, `clothesColor{itemId:colorId}`.
  - Accessors: `bodyColorHex()`, `itemColorHex(type,id)`, `setBodyColor`, `setItemColor`, `buyColor`.
- **`js/menu.js`**
  - `makeSwatch(hex, active, locked, onClick, price)` — colour button.
  - `renderColorsTab` — body palette (now preview-then-buy).
  - Item colour rows in the hat/clothes shop cards.
  - `drawCosmeticPreview(canvas, opts)` — **static one-shot** render.

### The core problem
A skin is not a colour — it is a **material that changes over time**. Two blockers:
1. No clock reaches `draw()`.
2. `shade()` needs a hex, so animated fills can't simply replace the tint everywhere.

---

## 2. Target architecture

### 2.1 Animation clock
- Add a global seconds clock and pass it down:
  - `player.draw(ctx, t)` where `t = now / 1000`.
  - `game._render(now)` → `player.draw(ctx, now/1000)`.
  - `drawCosmeticPreview` gains an internal `requestAnimationFrame` ticker so shop /
    menu previews animate (registry of active preview canvases; cap to ~30fps).
- Skins loop seamlessly via `phase = (t / loopSeconds) % 1`.

### 2.2 Skin = material descriptor
New module **`js/skins.js`**:
```
Skins.REGISTRY = [{
  id, name, tier,            // 'rare' | 'epic' | 'legendary' | 'mythic'
  price,
  scope,                     // 'body' | 'hat' | 'clothes' | 'all'
  kind,                      // renderer key: 'pulse' | 'chrome' | 'galaxy' | ...
  baseHex,                   // used by shade() for depth + as static fallback
  loop,                      // seconds
  params,                    // palette, speed, etc. per renderer
}]
Skins.byId(id)
Skins.resolveHex(skin, t)            // Phase-1 procedural-hex skins
Skins.paint[kind](octx, bounds, t, params)  // Phase-3+ texture renderers
```

### 2.3 Two rendering tiers (this is the key design)
A skinned slot keeps its normal silhouette + shading; the skin is layered on:

- **Tier A — procedural hex (cheap, no refactor):**
  The skin returns a time-varying hex via `Skins.resolveHex`. Feed it straight into the
  existing `bodyColor` / `hatTint` / `clothesTint`. `shade()` still works. Covers Pulse /
  Spectrum / Ember-breathe. **Validates the whole feature end-to-end with minimal risk.**

- **Tier B — gradient paint (medium):**
  Canvas accepts a `CanvasGradient` as `strokeStyle`/`fillStyle`. Build a scrolling
  gradient in the player's local transform space for the torso/limbs/cloth fills.
  Depth still uses `baseHex` via `shade()`. Covers Liquid Chrome / Holographic.

- **Tier C — silhouette-mask overlay (heavy, fully general):**
  For textured skins where strokes can't be clipped:
  1. Draw the slot normally with `baseHex`.
  2. To an offscreen buffer (sized to the player's local bounds):
     a. paint the animated material full-rect (`Skins.paint[kind]`),
     b. `globalCompositeOperation='destination-in'`, draw the slot **silhouette**
        (same geometry, single flat fill) → material is clipped to the slot shape,
     c. blit the buffer back over the slot (`'lighter'` for glow, `'source-atop'` for opaque).
  - Requires a **silhouette mode** for `_drawHat` / `_drawClothes` / body: same paths,
    flat fill, no shading. The propeller is excluded from the hat silhouette so cap
    skins never touch the spinner.
  - Pre-bake static parts (circuit traces, starfields) to a cached offscreen once.

### 2.4 Data model + migration (`profiles.js`)
- Add: `skinsOwned{}`, `bodySkin` (id|null), `hatSkin{itemId:skinId}`, `clothesSkin{itemId:skinId}`.
- `ensure()` defaults all of these for existing saves.
- Rules: setting a skin clears that slot's solid colour override at draw time
  (skin wins); picking a solid colour clears the skin. Never both.
- Accessors mirroring colours: `ownsSkin`, `buySkin`, `setBodySkin`, `setItemSkin`,
  `bodySkinId`, `itemSkinId`, and resolve helpers used by `game.start()`.

### 2.5 UI (`menu.js` + `css/style.css`)
- In each colour row (body card + hat/clothes item cards) add a small **toggle**:
  `Colours | Skins`. Default = Colours (unchanged behaviour).
- Skins view = grid of **animated mini-preview swatches** (tiny ticking canvases),
  with price tag + locked state. Reuse the **preview-then-buy** flow we already built.
- Equipping a skin updates the live menu character + preview.

### 2.6 Performance
- Offscreen buffers cached per slot; re-rendered per frame only when an animated skin
  is equipped and on-screen.
- Pre-baked static texture layers; only offsets/alpha animate.
- Preview canvases share one rAF ticker, throttled (~30fps).

---

## 3. Roadmap — easiest → hardest

### Phase 0 — Foundation (no visible skins yet)  ✅ DONE
- [x] Plumb clock: `player.draw(ctx, t)`, update `game._render`, all `drawCosmeticPreview` callers.
- [x] Animated preview ticker (registry + rAF, throttled ~30fps).
- [x] `js/skins.js` registry + `resolveHex` + `byId`.
- [x] Profile schema: `skinsOwned`, `bodySkin`, `hatSkin`, `clothesSkin` + `ensure()` migration.
- [x] `game.start()` resolves skin → paint precedence over solid colour.

### Phase 1 — Tier A: procedural-hex skins (Rare)  ✅ DONE
Implemented purely as time-varying hex; zero render refactor. Pricing CONFIRMED
("not anything special", 300–500g):
- [x] **Pulse** — brightness breathes. loop 2s. **300g**
- [x] **Ember** — warm flicker orange↔gold. loop 1.4s. **400g**
- [x] **Spectrum** — slow full-hue cycle. loop 6s. **500g**
- [x] Shop **Colours | Skins** toggle (body + hat/clothes cards) + animated swatches + preview-then-buy.

### Phase 2 — Tier B: gradient skins (Epic)  ✅ DONE (pricing TBD)
- [x] Gradient-paint path: `Skins.resolvePaint()` builds a CanvasGradient in the
      player's local transformed space; used for body bright pieces + hat/clothes fills.
- [x] **Liquid Chrome** — sliding specular mirror band. loop 3s. scope all. *placeholder 1500g*
- [x] **Holographic** — diagonal iridescent rainbow foil. loop 4s. scope all. *placeholder 1800g*
- Note: depth accents (shade()-derived) stay solid under a gradient — acceptable; revisit if needed.

### Phase 3 — Tier C: ~~texture skins~~ → ~~ZONE-OVERLAY skins~~ (Epic/Legendary)  ⚠️ SUPERSEDED by §0 cloth model
**Texture/pattern approach was scrapped** — full-surface noise reads as mud on a tiny
2D figure and details vanish on small hat/clothes shapes. Replaced with a
**zone-overlay system**: themed base colour + crisp focal art on named zones.
- [x] `player._anchors()` exposes chest / shoulders / hip / crown / hatTop / hem in local space.
- [x] `Skins.drawOverlay(skin, slot, ctx, t, anchors)` draws per-slot focal art; `drawSwatch()` for chips.
- [x] **Propeller safety** preserved — spinner uses hardcoded colours; overlay only touches cap.
- [x] **Neon Circuit** (epic) — hex emblem + pulse racing the ring. loop 2s. *4000g*
- [x] **Event Horizon** (legendary) — accretion-disc emblem, orbit halo, plasma trim, star pulled in/loop. loop 8s. *6000g*
- [x] **Starlight** (legendary) — constellation crest, crescent emblem, shooting star/loop. loop 9s. *6000g*
- [x] **Frostbite Regalia** (legendary, NEW) — faceted crystal, sweeping glint, frost burst/loop. loop 6s. *6000g*
- Design rule locked: one focal point, large clean shapes, one signature once-per-loop moment.

### Phase 4 — Mythic: ~~reactive FX-stacked overlays~~ → reactive cloths  ⚠️ SUPERSEDED by §0 (reactivity now lives in the cloth gradient)
Built on the zone-overlay system; `player` passes live motion via `anchors.motion`
(`{ speed, airborne, vy, grounded }`) so overlays react in real time. Procedural,
stateless particles (derived from `t`) — no per-frame allocation.
- [x] Motion threaded into overlays; reactive draws read `A.motion`.
- [x] **Molten Sovereign** — lava core + radiating cracks; **embers rise faster/more with speed, extra burst airborne**; flare ring/loop. loop 4s. *12000g*
- [x] **Aurora Veil** — 3 flowing ribbons + drifting sparkle dust; **ribbon amplitude grows with speed**; bright sweep up the ribbons/loop. loop 7s. *12000g*
- [x] **Glitch Runes** — rune frame + cycling glyph; **RGB chromatic-aberration split when airborne** + once-per-loop glitch burst. loop 3s. *12000g*
- Note: shop preview is idle (no motion), so speed/jump reactivity is only visible in-run.

---

## 4. Risks / decisions to lock before coding
- **Preview animation cost** — throttle + only tick visible canvases.
- **Skin vs colour precedence** — skin always wins for its slot; selecting one clears the other.
- **Propeller safety** — cap skins must use a dome-only silhouette; add a regression check.
- **Save migration** — must default cleanly for existing profiles (test on the main account).
- **Tiered pricing** — Rare ~ 2–4k, Epic ~ 5–8k, Legendary ~ 10–15k, Mythic ~ 20k+ (tune as gold sink).

---

## 5. Suggested first PR
Phase 0 + Phase 1 together: a vertical slice that delivers 3 Rare hex-skins for the
**body**, fully wired through the shop toggle and preview-then-buy, animating in-run and
in previews. Lowest risk, proves every layer, then Phases 2–4 only add renderers.
