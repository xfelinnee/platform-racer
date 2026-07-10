# Changelog

All notable changes to **Platform Racer** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and the
project follows [Semantic Versioning](https://semver.org/).

## [1.6.0] - 2026-07-09

### Changed
- **Skins reworked into a "flowing cloth" model.** Every Epic+ skin is now
  an animated `CanvasGradient` ("cloth") that flows *within* the garment + hat dome, instead
  of detached emblems/halos/particles floating around the figure. The pattern is a scrolling
  multi-colour palette plus a narrow bright shimmer band that sweeps across once per loop.
- **Scope is now Clothes + Hat dome only** — the body always keeps its solid colour. The
  shop's *Body Colour* card is colours-only again (cloth skins live on the Hat/Clothes cards).
- **Perfectly seamless loops** for every skin: palette/hue scroll uses an integer `flow`, so
  the pattern lands exactly back on its start when the loop wraps (no snap/cut). Reactive
  speed-ups add whole palette-cycles in speed bands so they stay seamless at any constant speed.
- Skin chips/previews render the live flowing fabric.

### Added
- **Achievements** — 16 launch achievements in a data-driven registry (`js/achievements.js`,
  mirroring the `Skins.REGISTRY` pattern so it can be server-validated for multiplayer later):
  distance milestones (100m–10,000m), coins-in-one-run tiers (500–10,000), first death, and
  six collection completions (hats / clothes / colours / buffs / trails / cloth skins).
  Unlocks award coins + XP, pop as slide-in toasts (including live mid-run), and show as
  badges with progress count on the profile screen. Existing profiles are granted anything
  they already qualify for on next login. New `stats.bestRunCoins` tracked per profile.
- **Profile tabs** — the profile screen is now split into Overview (stats + top runs),
  Achievements, and Collection tabs to reduce clutter. A new **Achievements** shortcut button
  under Customize on the main menu jumps straight to the achievements tab.
- **Fast drop** — hold `S` / `↓` while airborne to slam down faster (extra downward pull with a
  raised fall-speed cap: 15 → 24). Ground crouch is unaffected (crouch needs to be grounded).
- **Edge glow** on Legendary/Mythic cloths (subtle fabric bloom). Explicitly cleared before the
  propeller is drawn, so the spinner is never tinted or lit.
- **Reactive Mythic cloths** — flow speeds up and shimmer intensifies with player speed; *Glitch
  Runes* jitters/scrambles while airborne.
- Re-themed cloth palettes per skin: Liquid Chrome, Holographic, Neon Circuit, Event Horizon,
  Starlight, Frostbite Regalia, Molten Sovereign, Aurora Veil, Glitch Runes.

### Fixed
- Profile screen now shows a **Skins** unlock-progress card (owned / total); previously the
  breakdown listed Colors but omitted skins entirely.

### Removed
- Retired **and deleted** the zone-overlay emblem/halo/particle system: ~340 lines of unused
  renderers in `js/skins.js` (`drawCosmic`/`drawAurora`/`OVERLAY_FNS`/etc.) plus the now-dead
  `player._anchors()`/`_hatTopY()` helpers. `Skins.drawOverlay` is kept as a no-op for API
  compatibility. Rare skins (Pulse/Ember/Spectrum) keep their flowing solid-colour treatment,
  now applied to clothes + hat.

## [1.5.0] - 2026-06-22

### Added
- **Bounce pads** — spring-green platforms that launch the player up and gently
  forward, carrying them across roughly two platforms. Spawn frequency scales
  with difficulty (Easy 0.04 / Normal 0.05 / Hard 0.05) and ramps in with the
  rest of the hazards. No spikes spawn on a bounce pad.
- **Ducking / crouch** — hold `S` or `↓` on the ground to crouch. The collision
  hitbox shrinks (feet stay planted) so the player can slide under hazards such
  as laser beams. Smoothly eased in and out, with the figure visually matching
  the shrunken hitbox.

### Changed
- Bounce-pad launches use a fixed, deterministic velocity and are protected from
  the variable-jump-height cut, so every bounce reaches the same height
  regardless of input.
- Bounce detection is decoupled from `standingOn` (via a dedicated flag in
  collision), so consecutive/adjacent pads always fire.

## [1.4.0] - 2026-06-22

### Added
- **Animated cosmetic skins** — Rare / Epic / Legendary / Mythic tiers built on a
  zone-overlay rendering system, including motion-reactive effects on Mythic skins.
  Wired through the shop with a Colours | Skins toggle and animated preview-then-buy.
- Moving-platform coins, a laser charge-up telegraph, and turret tuning.

### Changed
- Version bumped to 1.4.0; added the release workflow doc.
