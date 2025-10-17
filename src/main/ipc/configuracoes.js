// src/main/ipc/configuracoes.js
// Ajustado para resolver automaticamente o título exato da aba no range (acentos, mojibake, caixa).
// Placeholders atualizados para "IA!A2:N".

const { ipcMain } = require('electron');
const db = require('./db');

let google; // lazy

/* ======================== Persistência ======================== */
ipcMain.handle('apigs:config:list', async () => {
  try {
    const r = await db.query(
      `SELECT chave, google_sheet_id, google_sheet_range, client_email, project_id
         FROM apigs_config
        ORDER BY chave DESC`, []
    );
    return r.rows || [];
  } catch (err) {
    console.error('[IPC ERROR] in apigs:config:list:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('apigs:config:get', async (_e, chave) => {
  try {
    const r = await db.query(`SELECT * FROM apigs_config WHERE chave = $1`, [Number(chave)]);
    if (!r.rows[0]) throw new Error('Registro não encontrado.');
    return r.rows[0];
  } catch (err) {
    console.error('[IPC ERROR] in apigs:config:get:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('apigs:config:delete', async (_e, chave) => {
  try {
    await db.query(`DELETE FROM apigs_config WHERE chave = $1`, [Number(chave)]);
    return { ok: true };
  } catch (err) {
    console.error('[IPC ERROR] in apigs:config:delete:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('apigs:config:save', async (_e, payload = {}) => {
  try {
    validateSheetId(payload.google_sheet_id);
    if (payload.service_json) {
      try {
        const credentials = JSON.parse(payload.service_json);
        payload.project_id = credentials.project_id;
        payload.private_key = credentials.private_key;
        payload.client_email = credentials.client_email;
      } catch (e) {
        throw new Error('service_json inválido (JSON malformado).');
      }
    }
    const cols = ['google_sheet_id', 'google_sheet_range', 'project_id', 'private_key', 'client_email'];
    if (payload.chave) {
      const sets = [], values = []; let i = 1;
      for (const c of cols) {
        if (payload[c] !== undefined) {
          sets.push(`${c} = $${i++}`);
          values.push(payload[c]);
        }
      }
      if (!sets.length) return { ok: true, note: 'Nada a atualizar' };
      values.push(Number(payload.chave));
      await db.query(`UPDATE apigs_config SET ${sets.join(', ')}, updated_at = now() WHERE chave = $${i}`, values);
      return { ok: true, chave: payload.chave };
    }
    const colsIns = [], params = [], values = []; let i = 1;
    for (const c of cols) {
      if (payload[c] !== undefined) {
        colsIns.push(c); params.push(`$${i++}`); values.push(payload[c]);
      }
    }
    if (!colsIns.length) throw new Error('Payload sem dados.');
    const r = await db.query(
      `INSERT INTO apigs_config (${colsIns.join(',')})
         VALUES (${params.join(',')})
         RETURNING chave`,
      values
    );
    return { ok: true, chave: r.rows[0].chave };
  } catch (err) {
    console.error('[IPC ERROR] in apigs:config:save:', err);
    throw new Error(err.message);
  }
});

/* ======================== Google Sheets ======================== */
function ensureGoogle() {
  try { google = google || require('googleapis').google; }
  catch { throw new Error('Dependência ausente. Instale: npm i googleapis'); }
}

function validateSheetId(id) {
  const raw = String(id || '').trim();
  if (!raw) throw new Error('Google Sheet ID não informado.');
  const looksLikeApiKey = /^AIza[0-9A-Za-z_\-]{10,}$/.test(raw);
  const looksLikeOauth = /^GOCSP[XA][0-9A-Za-z_\-]+$/.test(raw) || raw.includes('.apps.googleusercontent.com');
  const looksLikeId = /^[a-zA-Z0-9-_]{20,}$/.test(raw);
  if (looksLikeApiKey || looksLikeOauth || !looksLikeId) {
    throw new Error('Google Sheet ID inválido. Copie o trecho entre /d/ e /edit na URL da planilha.');
  }
}

function parseA1(range) {
  const s = String(range || '');
  const bang = s.indexOf('!');
  const sheetName = bang > 0 ? s.slice(0, bang) : null;
  const a1 = bang > 0 ? s.slice(bang + 1) : s;
  const m = a1.match(/^[A-Za-z]+(\d+)/);
  const startRow = m ? parseInt(m[1], 10) : 1;
  return { sheetName, startRow, a1 };
}

function stripDiacritics(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function demojibake(s){
  return String(s||'')
    .replace(/P├ígina/gi,'Pagina')
    .replace(/PÃ¡gina/gi,'Pagina');
}

/** Resolve o título exato da aba usando metadados; tolera acentos/mojibake/caixa. */
async function resolveExactRange(sheets, spreadsheetId, userRange, fallbackTitle='IA') {
  const { sheetName, a1 } = parseA1(userRange || '');
  const meta = await sheets.spreadsheets.get({ spreadsheetId }).catch(handleGoogleError);
  const tabs = (meta.data.sheets||[]).map(s=>s.properties?.title).filter(Boolean);
  if (!tabs.length) throw new Error('Planilha sem abas.');

  if (!sheetName) return `${tabs[0]}!${a1 || 'A2:N'}`;

  const wantedRaw = demojibake(sheetName);
  const wanted1 = stripDiacritics(wantedRaw).toLowerCase();

  const exact = tabs.find(t => t === sheetName) || tabs.find(t => t === wantedRaw);
  if (exact) return `${exact}!${a1 || 'A2:N'}`;

  const normalized = new Map(tabs.map(t => [stripDiacritics(t).toLowerCase(), t]));
  const normHit = normalized.get(wanted1);
  if (normHit) return `${normHit}!${a1 || 'A2:N'}`;

  const pref = tabs.find(t => stripDiacritics(t).toLowerCase().startsWith(wanted1));
  if (pref) return `${pref}!${a1 || 'A2:N'}`;

  const fb = tabs.find(t => stripDiacritics(t).toLowerCase() === stripDiacritics(fallbackTitle).toLowerCase());
  if (fb) return `${fb}!${a1 || 'A2:N'}`;

  return `${tabs[0]}!${a1 || 'A2:N'}`;
}

// Autenticação
async function getSheetsClient(credentials) {
  ensureGoogle();
  const credentialsForAuth = {
    type: "service_account",
    client_email: credentials.clientEmail,
    private_key: credentials.privateKey,
  };
  const auth = new google.auth.GoogleAuth({
    credentials: credentialsForAuth,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  return { sheets, clientEmail: credentials.clientEmail };
}

async function getSheetsClientFromJson(service_json) {
  let j;
  try { j = JSON.parse(String(service_json || '{}')); }
  catch { throw new Error('service_json inválido (JSON malformado).');
  }
  if (j.type && j.type !== 'service_account') {
    throw new Error('JSON não é de Service Account. Gere uma credencial de "Conta de serviço" no Google Cloud.');
  }
  return getSheetsClient({ clientEmail: j.client_email, privateKey: j.private_key });
}

async function getSheetsClientById(chave) {
  const r = await db.query(`SELECT * FROM apigs_config WHERE chave = $1`, [Number(chave)]);
  const row = r.rows[0];
  if (!row) throw new Error('Config não encontrada.');
  validateSheetId(row.google_sheet_id);
  const { sheets, clientEmail } = await getSheetsClient({
    clientEmail: row.client_email,
    privateKey: row.private_key
  });
  return { sheets, row, clientEmail };
}

async function getSheetIdByTitle(sheets, spreadsheetId, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId }).catch(handleGoogleError);
  const tab = (meta.data.sheets || []).find(s => s.properties && s.properties.title === title);
  if (!tab) throw new Error(`A aba "${title}" não foi encontrada.`);
  return tab.properties.sheetId;
}

function handleGoogleError(err) {
  let detailedMessage = err.message;
  if (err.cause?.message) detailedMessage = err.cause.message;
  else if (err.response?.data?.error?.message) detailedMessage = `Erro do Google: ${err.response.data.error.message}`;
  throw new Error(detailedMessage);
}

/* ---- Ações de teste (com resolução de range) ---- */
ipcMain.handle('apigs:sheets:test', async (_e, payload = {}) => {
  try {
    const { service_json, google_sheet_id, google_sheet_range } = payload || {};
    validateSheetId(google_sheet_id);
    if (!service_json) throw new Error('Preencha service_json.');

    const { sheets, clientEmail } = await getSheetsClientFromJson(service_json);
    const finalRange = await resolveExactRange(sheets, google_sheet_id, (google_sheet_range || 'IA!A2:N'), 'IA');

    const timestamp = new Date().toISOString();
    const values = [['BT_TEST', timestamp]];
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: google_sheet_id,
      range: finalRange,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    }).catch(handleGoogleError);
    const updates = res?.data?.updates?.updatedRows || 0;
    return { ok: true, updates, note: `Se necessário, compartilhe a planilha com ${clientEmail}.` };
  } catch (err) {
    console.error('[IPC ERROR] in apigs:sheets:test:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('apigs:sheets:testById', async (_e, chave) => {
  try {
    const { sheets, row, clientEmail } = await getSheetsClientById(chave);
    const finalRange = await resolveExactRange(sheets, row.google_sheet_id, (row.google_sheet_range || 'IA!A2:N'), 'IA');

    const timestamp = new Date().toISOString();
    const values = [['BT_TEST', timestamp]];
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: row.google_sheet_id,
      range: finalRange,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    }).catch(handleGoogleError);
    const updates = res?.data?.updates?.updatedRows || 0;
    return { ok: true, updates, note: `Se necessário, compartilhe a planilha com ${clientEmail}.` };
  } catch (err) {
    console.error('[IPC ERROR] in apigs:sheets:testById:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('apigs:sheets:hasTest', async (_e, payload = {}) => {
  try {
    const { service_json, google_sheet_id, google_sheet_range } = payload || {};
    validateSheetId(google_sheet_id);
    if (!service_json) throw new Error('Preencha service_json.');

    const { sheets } = await getSheetsClientFromJson(service_json);
    const finalRange = await resolveExactRange(sheets, google_sheet_id, (google_sheet_range || 'IA!A2:N'), 'IA');

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: google_sheet_id, range: finalRange
    }).catch(handleGoogleError);
    const values = Array.isArray(resp.data.values) ? resp.data.values : [];
    const count = values.filter(r => (r[0] || '').toString().trim() === 'BT_TEST').length;
    return { ok: true, count };
  } catch (err) {
    console.error('[IPC ERROR] in apigs:sheets:hasTest:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('apigs:sheets:removeTest', async (_e, payload = {}) => {
  try {
    const { service_json, google_sheet_id, google_sheet_range } = payload || {};
    validateSheetId(google_sheet_id);
    if (!service_json) throw new Error('Preencha service_json.');

    const { sheets } = await getSheetsClientFromJson(service_json);
    const finalRange = await resolveExactRange(sheets, google_sheet_id, (google_sheet_range || 'IA!A2:N'), 'IA');

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: google_sheet_id, range: finalRange
    }).catch(handleGoogleError);
    const values = Array.isArray(resp.data.values) ? resp.data.values : [];
    const relRows = [];
    values.forEach((r, i) => { if ((r[0] || '').toString().trim() === 'BT_TEST') relRows.push(i); });
    if (relRows.length === 0) return { ok: true, removed: 0 };

    const { sheetName, startRow } = parseA1(finalRange);
    const sheetId = await getSheetIdByTitle(sheets, google_sheet_id, sheetName || 'IA');
    const absRows = relRows.map(i => (startRow - 1) + i);
    absRows.sort((a,b) => b - a);
    const requests = absRows.map(rowIdx => ({
      deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } }
    }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: google_sheet_id,
      requestBody: { requests }
    }).catch(handleGoogleError);
    return { ok: true, removed: absRows.length };
  } catch (err) {
    console.error('[IPC ERROR] in apigs:sheets:removeTest:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('apigs:sheets:removeTestById', async (_e, chave) => {
  try {
    const { sheets, row } = await getSheetsClientById(chave);
    const finalRange = await resolveExactRange(sheets, row.google_sheet_id, (row.google_sheet_range || 'IA!A2:N'), 'IA');

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: row.google_sheet_id, range: finalRange
    }).catch(handleGoogleError);
    const values = Array.isArray(resp.data.values) ? resp.data.values : [];
    const relRows = [];
    values.forEach((r, i) => { if ((r[0] || '').toString().trim() === 'BT_TEST') relRows.push(i); });
    if (relRows.length === 0) return { ok: true, removed: 0 };

    const { sheetName, startRow } = parseA1(finalRange);
    const sheetId = await getSheetIdByTitle(sheets, row.google_sheet_id, sheetName || 'IA');
    const absRows = relRows.map(i => (startRow - 1) + i);
    absRows.sort((a,b) => b - a);
    const requests = absRows.map(rowIdx => ({
      deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } }
    }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: row.google_sheet_id,
      requestBody: { requests }
    }).catch(handleGoogleError);
    return { ok: true, removed: absRows.length };
  } catch (err) {
    console.error('[IPC ERROR] in apigs:sheets:removeTestById:', err);
    throw new Error(err.message);
  }
});
