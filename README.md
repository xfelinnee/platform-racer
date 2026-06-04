# Platform Racer

A fast, neon platformer built with HTML5 Canvas and vanilla JavaScript. Features a polished animated main menu, a settings screen, and a bold stickman hero with a procedural skeletal run cycle.

## Features

- **Polished main menu** — animated grid floor, neon glows, shimmering title, hover-glow buttons.
  - Single Player
  - Settings (music/SFX volume, difficulty, particles)
  - Quit Game
- **Bold stickman character** — procedurally animated skeleton with run cycle, jump/fall poses, squash & stretch, lean, and a glowing eye.
- **Endless procedural platforming** — generated platforms, gaps, coins, and spikes that scale with difficulty.
- **Juice** — parallax stars & mountains, run dust, coin/death bursts, screen vignette, camera look-ahead.
- **Persistent best score** saved to `localStorage`.

## Controls

| Action | Keys |
| ------ | ---- |
| Move   | `A` / `D` or `←` / `→` |
| Jump   | `Space`, `W`, or `↑` (hold for higher) |
| Sprint | `Shift` |
| Pause  | `Esc` or `P` |

Goal: race as far as possible without falling into a gap or landing on spikes.

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
    ├── level.js      # procedural platforms, coins, spikes, collision
    ├── game.js       # loop, camera, particles, parallax, render
    ├── menu.js       # settings persistence + screen switching
    └── main.js       # wiring: menu, HUD, pause/game-over
```
