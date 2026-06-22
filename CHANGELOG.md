# Changelog

All notable changes to **Platform Racer** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and the
project follows [Semantic Versioning](https://semver.org/).

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
