// Dev launcher: ensures Electron runs as a GUI app, not in Node mode.
// Some IDE terminals (VS Code / Windsurf) export ELECTRON_RUN_AS_NODE=1,
// which makes the `electron` binary behave like plain Node. We clear it,
// then spawn the real Electron executable pointing at this project.
const { spawn } = require('child_process');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// require('electron') from a normal Node process returns the path to the binary.
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env });
child.on('close', (code) => process.exit(code == null ? 0 : code));
