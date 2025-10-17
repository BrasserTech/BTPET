// src/main/ipc/auth.js
// Autenticação simples (SEM hash) usando tabela public.usuarios.
// Regras:
// - Ao logar, marca o usuário como ativo=3 e derruba quaisquer outros ativo=3.
// - Sessão (session_token, session_expira_em, user_agent, ip) gravada na própria tabela.
// - Exponho IPCs: auth:signin, auth:signup, auth:me, auth:active, auth:logout.

const { ipcMain } = require('electron');
const db = require('./db');

/* ============ Helpers ============ */
const norm       = (s) => (s || '').trim();
const normEmail  = (e) => norm(e).toLowerCase();

async function qOne(sql, params) {
  const r = await db.query(sql, params);
  return (r && r.rows && r.rows[0]) ? r.rows[0] : null;
}
function makeToken(userKey) {
  return `${userKey}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function nowPlusHours(h) {
  const d = new Date();
  d.setHours(d.getHours() + (h || 12));
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/* ============ DAO ============ */
async function getUserByEmail(email) {
  return await qOne(
    `SELECT
       chave, ativo, nome, email, cpf_cnpj, senha, perfil,
       session_token, session_expira_em, session_user_agent, session_ip,
       datahoracad, datahoraalt
     FROM public.usuarios
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [normEmail(email)]
  );
}

async function setUserSession({ chave, token, expiraEm, userAgent, ip }) {
  await db.query(
    `UPDATE public.usuarios
        SET session_token      = $1,
            session_expira_em  = $2,
            session_user_agent = $3,
            session_ip         = $4,
            datahoraalt        = NOW()
      WHERE chave = $5`,
    [token, expiraEm, userAgent || null, ip || null, chave]
  );
}

async function createUser({ nome, email, senha, cpf_cnpj }) {
  return await qOne(
    `INSERT INTO public.usuarios
       (ativo, nome, email, cpf_cnpj, senha, perfil, datahoracad, datahoraalt)
     VALUES
       (1, $1, $2, $3, $4, 'operador', NOW(), NOW())
     RETURNING chave, nome, email, cpf_cnpj, perfil`,
    [norm(nome), normEmail(email), norm(cpf_cnpj), String(senha)]
  );
}

async function getUserByToken(token) {
  return await qOne(
    `SELECT chave, nome, email, cpf_cnpj, perfil
       FROM public.usuarios
      WHERE session_token = $1
        AND (session_expira_em IS NULL OR session_expira_em >= NOW())
      LIMIT 1`,
    [token]
  );
}

async function getActiveUser() {
  return await qOne(
    `SELECT chave, ativo, nome, email, cpf_cnpj, perfil
       FROM public.usuarios
      WHERE ativo = 3
      ORDER BY datahoraalt DESC NULLS LAST
      LIMIT 1`,
    []
  );
}

async function markOnlyThisActive(userId) {
  // derruba quaisquer outros ativo=3
  await db.query(
    `UPDATE public.usuarios SET ativo = 1 WHERE ativo = 3 AND chave <> $1`,
    [userId]
  );
  // marca este como ativo=3
  await db.query(
    `UPDATE public.usuarios SET ativo = 3, datahoraalt = NOW() WHERE chave = $1`,
    [userId]
  );
}

async function clearActiveAndSessionById(userId) {
  await db.query(
    `UPDATE public.usuarios
        SET ativo = 1,
            session_token = NULL,
            session_expira_em = NULL,
            session_user_agent = NULL,
            session_ip = NULL,
            datahoraalt = NOW()
      WHERE chave = $1`,
    [userId]
  );
}

async function clearAllActiveAndSessions() {
  await db.query(
    `UPDATE public.usuarios
        SET ativo = 1,
            session_token = NULL,
            session_expira_em = NULL,
            session_user_agent = NULL,
            session_ip = NULL,
            datahoraalt = NOW()
      WHERE ativo = 3`,
    []
  );
}

/* ============ Use Cases ============ */
async function doSignin({ email, senha, user_agent, session_ip }) {
  if (!email || !senha) throw new Error('Informe e-mail e senha.');

  const u = await getUserByEmail(email);
  if (!u) throw new Error('Usuário não encontrado.');
  if (String(u.ativo) === '0') throw new Error('Usuário inativo.');
  if (String(senha) !== String(u.senha)) throw new Error('Senha incorreta.');

  const token  = makeToken(u.chave);
  const expira = nowPlusHours(12);

  await setUserSession({
    chave     : u.chave,
    token     : token,
    expiraEm  : expira,
    userAgent : user_agent,
    ip        : session_ip
  });

  // Regras de "usuário logado"
  await markOnlyThisActive(u.chave);

  return {
    ok: true,
    token,
    user: {
      id: u.chave,
      nome: u.nome,
      email: u.email,
      cpf_cnpj: u.cpf_cnpj || null,
      perfil: u.perfil || 'operador'
    }
  };
}

async function doSignup({ nome, email, senha, cpf_cnpj, user_agent, session_ip }) {
  if (!nome || !email || !senha) throw new Error('Preencha nome, e-mail e senha.');

  const exists = await getUserByEmail(email);
  if (exists) throw new Error('E-mail já cadastrado.');

  const ins = await createUser({ nome, email, senha, cpf_cnpj });

  const token  = makeToken(ins.chave);
  const expira = nowPlusHours(12);

  await setUserSession({
    chave     : ins.chave,
    token     : token,
    expiraEm  : expira,
    userAgent : user_agent,
    ip        : session_ip
  });

  // Já entra logado
  await markOnlyThisActive(ins.chave);

  return { ok: true, token, user: ins };
}

async function getMe(token) {
  if (!token) return null;
  return await getUserByToken(token);
}

async function doLogout() {
  // Volta todos os ativo=3 para 1 e limpa sessões correspondentes
  await clearAllActiveAndSessions();
  return { ok: true };
}

/* ============ IPCs ============ */
ipcMain.handle('auth:signin', async (_e, payload = {}) => {
  try { return await doSignin(payload); }
  catch (err) { console.error('[auth:signin] erro:', err); return { ok: false, error: err.message }; }
});

ipcMain.handle('auth:signup', async (_e, payload = {}) => {
  try { return await doSignup(payload); }
  catch (err) { console.error('[auth:signup] erro:', err); return { ok: false, error: err.message }; }
});

ipcMain.handle('auth:me', async (_e, token) => {
  try {
    const u = await getMe(token);
    if (!u) return { ok: false, error: 'Sessão inválida.' };
    return { ok: true, user: { id: u.chave, nome: u.nome, email: u.email, cpf_cnpj: u.cpf_cnpj || null, perfil: u.perfil || 'operador' } };
  } catch (err) {
    console.error('[auth:me] erro:', err);
    return { ok: false, error: err.message };
  }
});

// Retorna o usuário com ativo=3 (para telas que não usam token)
ipcMain.handle('auth:active', async () => {
  try {
    const u = await getActiveUser();
    if (!u) return { ok: false, error: 'Nenhum usuário ativo.' };
    return { ok: true, user: { id: u.chave, nome: u.nome, email: u.email, cpf_cnpj: u.cpf_cnpj || null, perfil: u.perfil || 'operador' } };
  } catch (err) {
    console.error('[auth:active] erro:', err);
    return { ok: false, error: err.message };
  }
});

// Logout via IPC (além do tratamento no main, se quiser chamar direto aqui)
ipcMain.handle('auth:logout', async () => {
  try { return await doLogout(); }
  catch (err) { console.error('[auth:logout] erro:', err); return { ok: false, error: err.message }; }
});

// Aliases opcionais
ipcMain.handle('auth:login',    (_e, p) => ipcMain.invoke('auth:signin',  p));
ipcMain.handle('auth:register', (_e, p) => ipcMain.invoke('auth:signup',  p));

module.exports = {
  doSignin,
  doSignup,
  getMe
};
