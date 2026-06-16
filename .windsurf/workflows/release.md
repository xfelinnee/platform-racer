---
description: How to push & release Platform Racer (MUST follow on every push)
---

Every push that ships code changes MUST go through a versioned release so the
installed app's auto-update reaches users. Never just `git push` source alone.

## Steps

1. Make sure the working tree is clean and all intended changes are committed.
// turbo
2. Confirm current version and recent history:
   `git status; git log -n 3 --oneline; node -p "require('./package.json').version"`

3. Choose the version bump:
   - **patch** (`1.3.0` -> `1.3.1`): bug fixes / tweaks.
   - **minor** (`1.3.0` -> `1.4.0`): new features (e.g. new skins, obstacles, modes).
   - **major**: breaking changes.

4. Bump the version. This creates a version commit AND a `vX.Y.Z` git tag:
   `npm version patch`   (or `minor` / `major`)

5. Build the installer and publish the GitHub release (pushes source + tags,
   builds with electron-builder, uploads, and marks the release "latest"):
   `node scripts/release.js`
   - Requires a GitHub token via `GH_TOKEN` or `gh auth token` (handled by the script).
   - Equivalent shortcuts exist: `npm run release:patch` / `npm run release:minor`.

6. Verify the release is live:
   `https://github.com/xfelinnee/platform-racer/releases/tag/vX.Y.Z`

## Commit message convention

Use a versioned summary line, e.g. `v1.4.0: cosmetic skins system (zone overlays + reactive mythics)`.

## Do NOT

- Do NOT push feature source to `master` without a version bump + release.
- Do NOT skip `node scripts/release.js` — source-only pushes leave users without the build.
