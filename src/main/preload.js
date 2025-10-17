// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Mesmo com nodeIntegration:true/contextIsolation:false (compat),
// manter este preload é útil para futura migração segura.
try {
  contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
      invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
      on: (channel, listener) => ipcRenderer.on(channel, (evt, ...a) => listener(...a)),
      removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    }
  });
} catch {
  // Em contextIsolation:false, contextBridge pode não estar ativo; ignore.
}
