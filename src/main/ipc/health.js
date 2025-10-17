// src/main/ipc/health.js
const { ipcMain } = require('electron');

ipcMain.handle('health:ping', async () => {
  return { ok: true, where: 'main', ts: Date.now() };
});
