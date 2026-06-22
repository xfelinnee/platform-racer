---
description: Push committed changes to origin master
---

Push local commits to `origin master`.

## Prerequisites
- All changes must be committed before pushing.
- `/push` does NOT bump the version. To ship a versioned build that reaches
  installed apps via auto-update, use `/release` instead (it runs `npm version`
  + `node scripts/release.js`).
- The in-app footer version is now stamped automatically from `package.json`
  (via Electron `app.getVersion()`), so you do NOT need to hand-edit the
  `index.html` footer on the desktop build.

## Steps
1. Run `git status` to verify the working tree is clean (no uncommitted changes).
2. If there are uncommitted changes, STOP and ask the user whether to commit them first.
3. Run `git log --oneline -3` to show what will be pushed.
4. Run `git pull origin master` first to ensure we are up-to-date (avoid push rejections).
5. Run `git push origin master`.
6. Report success or failure.

## Safety Rules
- NEVER force push (`--force` or `-f`) unless the user explicitly requests it.
- NEVER push if there are uncommitted changes — ask the user first.
- ALWAYS pull before pushing to avoid rejected pushes.
- If the push is rejected due to diverged history, notify the user and suggest pulling first.

## Error Handling
- If the push is rejected (non-fast-forward), run `git pull origin master` and retry once.
- If there are merge conflicts after pull, notify the user and list the conflicting files.
- If authentication fails, ask the user to check their credentials.
