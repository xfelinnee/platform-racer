// Preload: safe bridge between the game (renderer) and Electron (main).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  // Renderer can listen for when an update has been downloaded...
  onUpdateReady: (cb) => ipcRenderer.on('update-ready', cb),
  // ...and ask the app to restart & install it.
  installUpdate: () => ipcRenderer.send('install-update'),
  // Persistent save file (survives updates/relaunches). Load is synchronous.
  storageLoad: () => ipcRenderer.sendSync('storage:load'),
  storageSave: (data) => ipcRenderer.send('storage:save', data),
});
