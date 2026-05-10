// Preload: safely expose a minimal IPC surface to renderer code.
// contextIsolation is on, so the renderer never sees ipcRenderer directly —
// it only sees the promises on window.electronAPI.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // First-run setup window → main process
  saveSetup: (cfg) => ipcRenderer.invoke('setup:save', cfg),

  // Runtime config access (used by future in-app settings panel)
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (updates) => ipcRenderer.invoke('config:set', updates),

  // Ask the main process to restart the whole app (needed after changing
  // API key / base URL, since server.js reads them at startup via env vars)
  restartApp: () => ipcRenderer.invoke('app:restart')
})
