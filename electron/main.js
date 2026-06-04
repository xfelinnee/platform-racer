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
    },
  });

  // Remove the default application menu (File/Edit/etc.) for a clean game window.
  Menu.setApplicationMenu(null);

  // Load the bundled game (works fully offline).
  win.loadFile(path.join(__dirname, '..', 'index.html'));

  // F11 toggles fullscreen; Ctrl+Shift+I opens devtools (handy while developing).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F11') {
        win.setFullScreen(!win.isFullScreen());
      } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        win.webContents.toggleDevTools();
      }
    }
  });

  win.on('closed', () => { win = null; });
}

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
