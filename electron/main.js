// Electron main process — wraps the offline game and handles auto-updates.
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;

// ---- Persistent save file (survives updates & relaunches) ----
// file:// localStorage is not reliably persisted in Electron, so the game's
// save data is written to a real JSON file in the app's userData directory.
function saveFilePath() {
  return path.join(app.getPath('userData'), 'platform-racer-save.json');
}

function initStorage() {
  // Synchronous load so the renderer can read it during startup.
  ipcMain.on('storage:load', (event) => {
    let data = null;
    try {
      if (fs.existsSync(saveFilePath())) data = fs.readFileSync(saveFilePath(), 'utf8');
    } catch (e) { /* ignore */ }
    event.returnValue = data;
  });

  // Atomic save: write to a temp file then rename, so a crash can't corrupt it.
  ipcMain.on('storage:save', (event, data) => {
    try {
      const tmp = saveFilePath() + '.tmp';
      fs.writeFileSync(tmp, data, 'utf8');
      fs.renameSync(tmp, saveFilePath());
    } catch (e) { /* ignore */ }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#070b18',
    title: 'Platform Racer',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged, // no devtools in released builds
    },
  });

  // Remove the default application menu (File/Edit/etc.) for a clean game window.
  Menu.setApplicationMenu(null);

  // Load from updated source if available, otherwise bundled game.
  const updatedIndex = path.join(app.getPath('userData'), 'game-source', 'index.html');
  if (app.isPackaged && fs.existsSync(updatedIndex)) {
    win.loadFile(updatedIndex);
  } else {
    win.loadFile(path.join(__dirname, '..', 'index.html'));
  }

  // F11 toggles fullscreen. DevTools (Ctrl+Shift+I) is only available in dev
  // builds — disabled in packaged releases so playtesters can't open it.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F11') {
        win.setFullScreen(!win.isFullScreen());
      } else if (!app.isPackaged && input.control && input.shift && input.key.toLowerCase() === 'i') {
        win.webContents.toggleDevTools();
      }
    }
  });

  // Belt-and-suspenders: block any attempt to open devtools in packaged builds
  // (menu accelerators, programmatic calls, etc.).
  if (app.isPackaged) {
    win.webContents.on('devtools-opened', () => win.webContents.closeDevTools());
  }

  win.on('closed', () => { win = null; });
}

// ---- Manual git-pull update ----
ipcMain.handle('git-pull-update', async () => {
  const { execSync } = require('child_process');
  const repoUrl = 'https://github.com/xfelinnee/platform-racer.git';

  // In dev mode, use the project directory. In packaged mode, use userData.
  let repoDir;
  if (!app.isPackaged) {
    repoDir = path.join(__dirname, '..');
  } else {
    repoDir = path.join(app.getPath('userData'), 'game-source');
  }

  try {
    // If game-source doesn't exist yet (first update in packaged mode), clone it
    if (app.isPackaged && !fs.existsSync(path.join(repoDir, '.git'))) {
      fs.mkdirSync(repoDir, { recursive: true });
      execSync(`git clone ${repoUrl} "${repoDir}"`, { encoding: 'utf8', timeout: 60000 });
    } else {
      execSync('git pull origin master', { cwd: repoDir, encoding: 'utf8', timeout: 30000 });
    }

    // In packaged mode, load from the pulled source
    if (app.isPackaged && win) {
      win.loadFile(path.join(repoDir, 'index.html'));
    } else if (win) {
      win.webContents.reloadIgnoringCache();
    }
    return { success: true, message: 'Updated successfully' };
  } catch (e) {
    return { success: false, message: e.stderr || e.message || 'Update failed' };
  }
});

// ---- Auto-update (only in packaged builds) ----
function initAutoUpdate() {
  if (!app.isPackaged) return; // skip during local dev
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    return; // electron-updater not installed yet
  }

  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', () => {
    if (win) win.webContents.send('update-ready');
  });
  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err == null ? 'unknown' : (err.stack || err).toString());
  });

  // Let the renderer trigger the install/restart once an update is ready.
  ipcMain.on('install-update', () => autoUpdater.quitAndInstall());

  // Check shortly after launch.
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 3000);
}

// Only allow one running instance so it doesn't fight over the save/cache files.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    initStorage();
    createWindow();
    initAutoUpdate();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
