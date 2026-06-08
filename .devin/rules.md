# Platform Racer — Project Rules

## Versioning

- **Always** bump the version in both `package.json` AND `index.html` footer when making a release or significant changes.
- Use semantic versioning: `MAJOR.MINOR.PATCH` (e.g. `1.2.0`).
- Patch: bug fixes, small tweaks.
- Minor: new features, obstacles, or gameplay changes.
- Major: breaking changes or full rewrites.

## Code Style

- No TypeScript, no build step — vanilla JavaScript only.
- Keep all game logic in the `js/` folder.
- Electron-specific code goes in `electron/`.
- Do NOT add comments or documentation unless explicitly asked.
- Do NOT add emojis to code or UI unless explicitly asked.

## Architecture

- `level.js` — procedural generation, obstacles, hazards, collision, drawing.
- `player.js` — player physics, input, animation.
- `game.js` — game loop, camera, particles, state management.
- `main.js` — wiring between UI screens and game logic.
- `menu.js` — shop, customize, profile, settings UI.
- `profiles.js` — profile system, XP, stats, persistence.
- `electron/main.js` — Electron main process, window, IPC, updates.
- `electron/preload.js` — secure bridge between renderer and main process.

## Obstacles & Hazards

- Never spawn spikes on elevator or crumbling platforms.
- Never spawn two laser platforms consecutively (use `_lastLaser` flag).
- Homing drones are **removed** — do not re-add them.
- Bounce pads are **removed** — do not re-add them.
- Daily challenge is **removed** — do not re-add it.

## Building & Releases

- Build EXE with: `npx electron-builder --win portable --config.forceCodeSigning=false --config.win.signAndEditExecutable=false`
- Always push to `master` branch (not `main`).
- Create GitHub releases with `gh release create vX.Y.Z "dist\Platform Racer X.Y.Z.exe"`.
- The Update Game button in the EXE pulls from `https://github.com/xfelinnee/platform-racer.git`.

## Git Workflow

- Commit with descriptive messages summarizing what changed.
- Push to `origin master`.
- Tag releases with `vX.Y.Z` format.

## Player Physics (do not change without explicit request)

- Gravity: 0.62 (rising), 0.70 (falling)
- Jump velocity: 14.5
- These constants are tuned — do not adjust casually.

## Testing

- No formal test suite. Verify by running the game locally at `http://localhost:8000`.
- For Electron: `npm start` to run in dev mode.
