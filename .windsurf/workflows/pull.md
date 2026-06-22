---
description: Pull the latest code from origin master
---

Fetch and merge the latest changes from `origin master`.

## Steps
1. Run `git status` to check for uncommitted changes.
2. If there are uncommitted changes, stash them with `git stash`.
3. Run `git pull origin master`.
4. If changes were stashed, restore them with `git stash pop`.
5. Report the result (up-to-date, merged, or conflicts).

## Error Handling
- If there are merge conflicts after the pull, notify the user and list the conflicting files.
- If the pull fails due to network issues, retry once then report the error.
- If `git stash pop` causes conflicts, notify the user immediately.
