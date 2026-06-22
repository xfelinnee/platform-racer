// Preload: safe bridge between the game (renderer) and Electron (main).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  // Real app version (from package.json), so the UI never shows a stale hardcoded number.
  appVersion: ipcRenderer.sendSync('app:get-version'),
  // Auto-update: check, download, install, and listen for status
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_e, data) => cb(data)),
  // Persistent save file (survives updates/relaunches). Load is synchronous.
  storageLoad: () => ipcRenderer.sendSync('storage:load'),
  storageSave: (data) => ipcRenderer.send('storage:save', data),
});
