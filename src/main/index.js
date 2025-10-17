import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

// --- Variáveis de Ambiente e Configuração ---
const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false, // Mostra a janela apenas quando estiver pronta
    autoHideMenuBar: true,
    webPreferences: {
      // O preload é a ponte segura entre o frontend (React) e o backend (Node.js)
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Mostra a janela quando o conteúdo estiver pronto para ser exibido
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Carrega a URL do servidor de desenvolvimento Vite ou o arquivo HTML de produção
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

// --- Ciclo de Vida da Aplicação ---
app.whenReady().then(() => {
  // ===================================================================
  // AQUI É A MÁGICA: Carregamos todos os nossos módulos de IPC.
  // Cada arquivo 'require' vai registrar seus próprios handlers no ipcMain.
  // ===================================================================
  require('./ipc/authHandlers');
  require('./ipc/clientesHandlers');
  require('./ipc/produtosHandlers');
  // ... adicione outros handlers aqui (servicos, animais, etc.)

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});