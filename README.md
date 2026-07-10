# Platform Racer

A fast, neon platformer built with HTML5 Canvas and vanilla JavaScript. Features a polished animated main menu, profile system, shop with unlockable cosmetics, and a bold stickman hero with a procedural skeletal run cycle.

## Features

- **Polished main menu** — animated grid floor, neon glows, shimmering title, hover-glow buttons.
  - Single Player
  - Shop (skins, hats, trails, loadout items)
  - Profile (stats, leaderboard, XP/level progression)
  - Customize (quick equip screen)
  - Settings (music/SFX volume, difficulty, particles)
  - Quit Game
- **Profile & progression system** — multiple profiles, XP leveling, prestige system, persistent stats. The profile screen is split into **Overview / Achievements / Collection** tabs.
- **Achievements** — 16 launch achievements in a data-driven registry: distance milestones, coins-in-one-run tiers, first death, and collection completions. Unlocks award coins + XP and pop as slide-in toasts (including live mid-run).
- **Shop & cosmetics** — unlockable **flowing-cloth skins**, hats (propeller hat enables hover), trails, and gameplay loadout items (double jump, high jump, magnet, etc.).
- **Flowing-cloth skins** — Rare / Epic / Legendary / Mythic tiers rendered as an animated gradient that flows *within* the clothes + hat dome. Seamless loops, with Mythic cloths reacting to player speed and airborne state.
- **Bold stickman character** — procedurally animated skeleton with run cycle, jump/fall poses, a crouch/duck, a **fast drop** slam, squash & stretch, lean, and a glowing eye.
- **Endless procedural platforming** — generated platforms, gaps, coins, and spikes that scale with difficulty.

### Obstacles & Hazards

- **Spikes** — static hazards on platform surfaces.
- **Saw blades** — spinning blades that orbit around platforms.
- **Moving platforms** — horizontally oscillating platforms.
- **Crumbling platforms** — collapse shortly after the player lands on them.
- **Ice platforms** — reduced friction with a speed boost and drifting snowflake particles.
- **Conveyor belts** — push the player left or right with animated directional arrows.
- **Laser beams** — toggle on/off between two posts on a platform; lethal when active.
- **Elevator platforms** — move vertically with independent up/down speeds; no spikes spawn on them.
- **Turrets** — mounted at the top of the screen, fire tracking darts downward on a timer.
- **Tracking darts** — red projectiles that home toward the player but can be outrun.
- **Bounce pads** — spring-green platforms that launch the player up and gently forward, carrying them across roughly two platforms. No spikes spawn on them.

### Polish & Juice

- **Parallax stars & mountains**, run dust, coin/death bursts, screen vignette, camera look-ahead.
- **Ghost replay** — race against your previous best run.
- **Second-chance revive** system on death.
- **Persistent scores & stats** saved to `localStorage`.

## Controls

| Action | Keys |
| ------ | ---- |
| Move   | `A` / `D` or `←` / `→` |
| Jump   | `Space`, `W`, or `↑` (hold for higher) |
| Duck   | `S` or `↓` (crouch to slide under hazards) |
| Fast drop | `S` or `↓` while airborne (slam down faster) |
| Sprint | `Shift` |
| Hover  | Hold `Jump` while falling (requires propeller hat) |
| Pause  | `Esc` or `P` |

Goal: race as far as possible without falling into a gap or hitting a hazard.

## Difficulty

Three difficulty tiers scale obstacle frequency, gap size, and coin value:

- **Easy** — wider platforms, fewer hazards, no turrets or lasers.
- **Normal** — balanced mix of all obstacles.
- **Hard** — narrow platforms, dense hazards, double coin value, death penalty.

All obstacles ramp up progressively as you travel further in a run.

## Run it

No build step required. Serve the folder over a local server (needed so the browser loads the JS files):

```bash
# Python 3
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Project structure

```
platform-racer/
├── index.html        # markup: menus, HUD, overlay, canvas
├── css/style.css     # all UI + menu styling
└── js/
    ├── input.js      # keyboard manager
    ├── player.js     # bold stickman + skeletal animation + physics
    ├── level.js      # procedural platforms, obstacles, coins, collision
    ├── game.js       # loop, camera, particles, parallax, render
    ├── menu.js       # shop, customize, settings, screen switching
    ├── profiles.js   # profile system, XP, stats, leaderboard, achievements store
    ├── skins.js      # flowing-cloth skin registry + gradient rendering
    ├── achievements.js # data-driven achievements registry + evaluation
    ├── audio.js      # music & sound effects
    └── main.js       # wiring: menu, HUD, pause/game-over
```
