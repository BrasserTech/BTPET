// src/main/main.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const db = require('./ipc/db'); // importante para poder atualizar o banco

const isDev = process.env.NODE_ENV === 'development';

let mainWin = null;
let loginWin = null;

/* ------------------ helpers ------------------ */
function appBase() {
  // Em DEV: .../src/main
  // Empacotado: .../resources/app.asar
  try { return app.getAppPath(); } catch { return path.resolve(__dirname); }
}

function firstExisting(candidates) {
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

// Resolve arquivos dentro de src/renderer para DEV e BUILD/ASAR
function resolveFromRenderer(relPath) {
  const base = appBase();
  // Candidatos em ordem de probabilidade
  const candidates = [
    path.join(base, 'src', 'renderer', relPath),      // empacotado (app.asar/src/renderer/relPath) e também funciona no dev
    path.join(__dirname, '..', '..', 'src', 'renderer', relPath), // dev (fallback)
    path.join(process.cwd(), 'src', 'renderer', relPath),         // dev (fallback 2)
  ];
  return firstExisting(candidates);
}

function resolveIndexPath() {
  // Caso você ainda tenha um index.html na raiz (não recomendado), ele entra como fallback.
  return (
    resolveFromRenderer('index.html') ||
    firstExisting([
      path.join(appBase(), 'index.html'),
      path.join(process.cwd(), 'index.html'),
    ])
  );
}

function resolveLoginPath() {
  return (
    resolveFromRenderer('login.html') ||
    firstExisting([
      path.join(appBase(), 'login.html'),
      path.join(process.cwd(), 'login.html'),
    ])
  );
}

/* ------------------ funções de controle de sessão ------------------ */
async function resetActiveUsers() {
  try {
    await db.query(
      `UPDATE public.usuarios
          SET ativo = 1,
              session_token = NULL,
              session_expira_em = NULL,
              session_user_agent = NULL,
              session_ip = NULL,
              datahoraalt = NOW()
        WHERE ativo = 3`
    );
    console.log('[main] Todos os usuários ativos (3) foram redefinidos para 1.');
  } catch (err) {
    console.error('[main] Falha ao redefinir usuários ativos:', err.message);
  }
}

/* ------------------ janelas ------------------ */
function createLoginWindow() {
  const loginPath = resolveLoginPath();
  console.log('[login] carregar:', loginPath, '| existe:', fs.existsSync(loginPath));

  loginWin = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    minimizable: false,
    maximizable: false,
    modal: false,
    frame: true,
    show: true,
    backgroundColor: '#f6f8fc',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    }
  });

  loginWin.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[login] did-fail-load:', code, desc, url);
    dialog.showErrorBox('Falha ao carregar login.html',
      `Caminho: ${loginPath}\nExiste: ${fs.existsSync(loginPath)}\nErro: ${code} ${desc}`);
  });

  loginWin.loadFile(loginPath);
  if (isDev) loginWin.webContents.openDevTools({ mode: 'detach' });

  loginWin.on('closed', () => { loginWin = null; });
}

function createMainWindowAndShow({ token, user }) {
  const indexPath = resolveIndexPath();
  console.log('[main] carregar index:', indexPath, '| existe:', fs.existsSync(indexPath));

  mainWin = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,                 // mostramos quando estiver pronto
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,       // oculta a barra de menu (pode alternar com Alt)
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    }
  });

  // Quando o renderer estiver pronto, maximiza e exibe
  mainWin.once('ready-to-show', () => {
    try { mainWin.maximize(); } catch (_) {}
    mainWin.show();
  });

  // Envia token ao renderer assim que terminar de carregar
  mainWin.webContents.once('did-finish-load', () => {
    try { mainWin.webContents.send('auth:token', { token, user: user || null }); }
    catch (e) { console.error('[main] falha ao enviar token ao renderer:', e); }
  });

  // Atalhos: F11 alterna fullscreen; Esc sai do fullscreen
  mainWin.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key.toLowerCase() === 'f11') {
      mainWin.setFullScreen(!mainWin.isFullScreen());
    }
    if (input.type === 'keyDown' && input.key.toLowerCase() === 'escape' && mainWin.isFullScreen()) {
      mainWin.setFullScreen(false);
    }
  });

  mainWin.loadFile(indexPath);
  if (isDev) mainWin.webContents.openDevTools({ mode: 'detach' });

  mainWin.on('closed', async () => {
    console.log('[main] janela principal fechada, redefinindo ativo=1...');
    await resetActiveUsers();
    mainWin = null;
  });
}

/* ------------------ IPC bridge ------------------ */
// Recebe do popup de login
ipcMain.on('auth:login:success', (_e, payload) => {
  if (!payload?.token) return;
  createMainWindowAndShow({ token: payload.token, user: payload.user || null });
  if (loginWin) { loginWin.close(); loginWin = null; }
});

// Redimensiona a janela de login sob demanda (Entrar x Cadastrar)
ipcMain.on('login:resize', (_e, { width, height }) => {
  if (loginWin && typeof width === 'number' && typeof height === 'number') {
    loginWin.setSize(Math.round(width), Math.round(height), true);
    loginWin.center();
  }
});

// Logout vindo do renderer principal
ipcMain.on('auth:logout', async () => {
  console.log('[main] logout solicitado - redefinindo ativo=1 e voltando à tela de login...');
  await resetActiveUsers();
  if (mainWin) { mainWin.close(); mainWin = null; }
  if (!loginWin) createLoginWindow();
});

/* ------------------ boot ------------------ */
process.on('uncaughtException', (err) => console.error('[main][uncaughtException]', err));
process.on('unhandledRejection', (reason) => console.error('[main][unhandledRejection]', reason));

app.whenReady().then(async () => {
  try { require('./ipc/db'); } catch (e) { console.warn('[main] db warn:', e?.message || e); }
  require('./ipc/health');
  require('./ipc/auth');
  require('./ipc/configuracoes');
  require('./ipc/produtos');
  require('./ipc/dashboard');
  require('./ipc/monitorpedidos');
  require('./ipc/clientes');
  require('./ipc/pedidos');
  require('./ipc/perfil');
  require('./ipc/sheets-sync');
  require('./ipc/cardapio');

  // Relatórios
  require('./ipc/relfaturamento'); // canal 'faturamento:listar'
  require('./ipc/relfatcliente');  // canais 'relfatcliente:*'

  // Ao iniciar, garante que ninguém fique "preso" como ativo=3
  await resetActiveUsers();

  createLoginWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
});

app.on('window-all-closed', async () => {
  await resetActiveUsers(); // <-- redefine todos para ativo=1 antes de sair
  if (process.platform !== 'darwin') app.quit();
});
