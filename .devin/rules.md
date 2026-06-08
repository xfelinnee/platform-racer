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

### CRITICAL RULES — never break these:
- **ALWAYS use NSIS target** (`--win nsis`). NEVER use `--win portable`. electron-updater only supports NSIS on Windows. Portable builds break auto-update for all players.
- **ALWAYS push code BEFORE building.** The EXE bundles whatever code is on disk at build time. If you build before pushing, the EXE will have stale code.
- **ALWAYS bump version** in BOTH `package.json` AND `index.html` footer BEFORE building.
- **ALWAYS verify** the release has all 3 files: `Platform-Racer-Setup-X.Y.Z.exe`, `latest.yml`, `.blockmap`.
- **NEVER change the build target** (NSIS → portable or vice versa). This breaks the update chain for all existing players.
- **NEVER disable autoDownload or remove checkForUpdatesAndNotify()** from `electron/main.js`. Players depend on auto-update at boot.

### Release checklist:
1. Bump version in `package.json` and `index.html` footer
2. Commit and push to master
3. Delete old release if same version: `gh release delete vX.Y.Z --yes --cleanup-tag`
4. Build & publish:
   ```
   $env:GH_TOKEN = (gh auth token); npx electron-builder --win nsis --config.win.signAndEditExecutable=false --config.forceCodeSigning=false --publish always
   ```
5. Publish the draft: `gh release edit vX.Y.Z --draft=false --title "Platform Racer vX.Y.Z" --notes "changelog"`
6. Verify: `gh release view vX.Y.Z --json assets --jq ".assets[].name"` — must show Setup EXE + latest.yml + blockmap

### Auto-update flow (do not modify):
- `electron/main.js` has `autoDownload = true` and `checkForUpdatesAndNotify()` 3s after launch
- `electron-updater` reads `latest.yml` from the **Latest** (non-draft, non-prerelease) GitHub release
- `package.json` has `build.publish` pointing to `provider: github`, `owner: xfelinnee`, `repo: platform-racer` — do NOT change this
- **Player experience on old versions (v1.1.x):** boot → auto-download in background → installs silently when player quits → next launch is the new version
- **Player experience on v1.2.0+:** boot → auto-download → shows "Restarting..." → quits, installs, relaunches automatically
- Update Game button in the menu is a manual backup — triggers the same check/download/install cycle
- Repo: `https://github.com/xfelinnee/platform-racer`
- Always push to `master` branch (not `main`)

### What NOT to do:
- Do NOT switch from NSIS to portable — this breaks the update chain permanently
- Do NOT set `autoDownload = false` — players won't get updates
- Do NOT remove `checkForUpdatesAndNotify()` — no boot check = no auto-update
- Do NOT change the `build.publish` config in `package.json`
- Do NOT publish a release as draft or prerelease — `electron-updater` skips those

## Git Workflow

- Commit with descriptive messages summarizing what changed.
- Push to `origin master`.
- Tags are created automatically by `electron-builder --publish always` (format `vX.Y.Z`).
- **ALWAYS push code BEFORE building.** This is the #1 cause of stale releases.

## Player Physics (do not change without explicit request)

- Gravity: 0.62 (rising), 0.70 (falling)
- Jump velocity: 14.5
- These constants are tuned — do not adjust casually.

## Testing

- No formal test suite. Verify by running the game locally at `http://localhost:8000`.
- For Electron: `npm start` to run in dev mode.
