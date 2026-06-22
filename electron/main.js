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

  // Load the bundled game (works fully offline).
  win.loadFile(path.join(__dirname, '..', 'index.html'));

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

// ---- Auto-update via electron-updater ----
let updater = null;

function initAutoUpdate() {
  if (!app.isPackaged) return;
  try {
    ({ autoUpdater: updater } = require('electron-updater'));
  } catch (e) {
    return;
  }

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  // Check for updates shortly after launch
  setTimeout(() => {
    updater.checkForUpdatesAndNotify().catch(() => {});
  }, 3000);

  updater.on('checking-for-update', () => {
    if (win) win.webContents.send('update-status', { state: 'checking' });
  });
  updater.on('update-available', (info) => {
    if (win) win.webContents.send('update-status', { state: 'available', version: info.version });
  });
  updater.on('update-not-available', () => {
    if (win) win.webContents.send('update-status', { state: 'up-to-date' });
  });
  updater.on('download-progress', (prog) => {
    if (win) win.webContents.send('update-status', { state: 'downloading', percent: Math.round(prog.percent) });
  });
  updater.on('update-downloaded', () => {
    if (win) win.webContents.send('update-status', { state: 'ready' });
  });
  updater.on('error', (err) => {
    const msg = err == null ? 'Unknown error' : (err.message || err.toString());
    console.error('Auto-update error:', msg);
    if (win) win.webContents.send('update-status', { state: 'error', message: msg });
  });
}

// Renderer asks to check for updates
ipcMain.handle('check-for-update', async () => {
  if (!updater) return { state: 'not-available', message: 'Desktop only' };
  try {
    const result = await updater.checkForUpdates();
    return { state: 'ok' };
  } catch (e) {
    return { state: 'error', message: e.message || 'Check failed' };
  }
});

// Renderer asks to download the update
ipcMain.handle('download-update', async () => {
  if (!updater) return { state: 'error' };
  try {
    await updater.downloadUpdate();
    return { state: 'ok' };
  } catch (e) {
    return { state: 'error', message: e.message || 'Download failed' };
  }
});

// Renderer asks to quit and install
ipcMain.on('install-update', () => {
  if (updater) updater.quitAndInstall();
});

// Renderer asks for the real app version (sourced from package.json at build time).
// Synchronous so the UI can stamp it immediately on load.
ipcMain.on('app:get-version', (event) => {
  event.returnValue = app.getVersion();
});

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
