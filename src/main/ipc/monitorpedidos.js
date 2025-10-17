// ===============================================
// src/main/ipc/monitorpedidos.js
// ===============================================

const { ipcMain } = require('electron');
const { google } = require('googleapis');
const db = require('./db');

/**
 * Helper para normalizar números de telefone para COMPARAÇÃO.
 * Remove caracteres não numéricos.
 * Remove o código do país '55' se o número for longo.
 * @param {string} phone 
 * @returns {string} - Apenas os dígitos do telefone, sem o '55' inicial.
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    return digits.substring(2);
  }
  return digits;
}


async function getMonitorConfigFromDB() {
  const result = await db.query('SELECT * FROM apigs_config ORDER BY chave DESC LIMIT 1');
  if (!result.rows[0]) {
    throw new Error('Nenhuma configuração do Google Sheets foi encontrada no banco de dados. Por favor, salve uma na tela de Configurações.');
  }
  return result.rows[0];
}
function titleFromRange(r){ if(!r||!r.includes('!')) return null; return r.split('!')[0].replace(/^'|'+$/g,''); }
function parseDateWithFix(iso){ if(!iso) return null; const d = new Date(String(iso)); return Number.isNaN(d.getTime()) ? null : d; }
function parseBRNumber(v){ if(v==null||v==='') return 0; const n=Number(String(v).replace(/\./g,'').replace(',','.')); return Number.isFinite(n)?n:0; }
async function getSheetsClient(config){
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: config.client_email, private_key: config.private_key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version:'v4', auth: authClient });
}


/* ===== core ===== */
async function fetchFromSheet(config, { apenasHoje = true } = {}){
  if(!config.google_sheet_id) {
    throw new Error('Configuração inválida: google_sheet_id não encontrado no banco de dados.');
  }

  const sheets = await getSheetsClient(config);
  const range = config.google_sheet_range || 'Página1!A2:J';
  const title = titleFromRange(range);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: config.google_sheet_id, range });
  const rows = Array.isArray(res.data.values) ? res.data.values : [];
  
  const all = rows.map((r,i)=>{
    const [dataHora,nome,pedido,obs,valorTotal,statusCod,endereco,contato,qtdIn] = r;
    const dAdj = parseDateWithFix(dataHora);
    return {
      id: i+2, rowNumber: i+2, sheetTitle: title,
      hora: dAdj ? dAdj.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—',
      horaRaw: dAdj ? dAdj.toISOString() : null, cliente: nome || '—', item: (pedido && String(pedido).trim()) ? pedido : '—',
      qtd: Number.isFinite(Number(qtdIn)) ? Number(qtdIn) : 1, statusCode: String(statusCod ?? '').trim() || '',
      local: endereco || '—', observacao: (obs && String(obs).trim()) ? obs : '—', contato: contato || '—',
      valor: parseBRNumber(valorTotal),
      clienteExiste: false, 
    };
  });
  
  const phoneList = [...new Set(all.map(p => normalizePhone(p.contato)).filter(Boolean))];
  if (phoneList.length > 0) {
    const sqlCheck = `
      SELECT DISTINCT
        CASE
          WHEN SUBSTRING(regexp_replace(telefone, '\\D', 'g') FROM 1 FOR 2) = '55' AND LENGTH(regexp_replace(telefone, '\\D', 'g')) > 11
          THEN SUBSTRING(regexp_replace(telefone, '\\D', 'g') FROM 3)
          ELSE regexp_replace(telefone, '\\D', 'g')
        END AS normalized_phone
      FROM clifor
      WHERE 
        CASE
          WHEN SUBSTRING(regexp_replace(telefone, '\\D', 'g') FROM 1 FOR 2) = '55' AND LENGTH(regexp_replace(telefone, '\\D', 'g')) > 11
          THEN SUBSTRING(regexp_replace(telefone, '\\D', 'g') FROM 3)
          ELSE regexp_replace(telefone, '\\D', 'g')
        END = ANY($1::text[])
    `;
    const checkRes = await db.query(sqlCheck, [phoneList]);
    const existingPhones = new Set(checkRes.rows.map(r => r.normalized_phone));

    all.forEach(pedido => {
      const normalized = normalizePhone(pedido.contato);
      if (normalized && existingPhones.has(normalized)) {
        pedido.clienteExiste = true;
      }
    });
  }

  let data = all;
  if (apenasHoje) {
    const t = new Date();
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0,0,0,0);
    const end   = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23,59,59,999);
    data = all.filter(x => { const dt = x.horaRaw ? new Date(x.horaRaw) : null; return dt && dt >= start && dt <= end; });
  }
  const kpi = {
    emPreparo:  data.filter(x => x.statusCode === '1').length,
    saiuEntrega:data.filter(x => x.statusCode === '2').length,
    totalPronto:data.filter(x => x.statusCode === '3').length,
  };
  data.sort((a,b)=> new Date(b.horaRaw||0) - new Date(a.horaRaw||0));
  return { data, kpi };
}

// ==================================================================
// FUNÇÃO DE ATUALIZAR STATUS (RESTAURADA)
// ==================================================================
async function updateStatusOnSheet(config, { id, status }){
  if(!config.google_sheet_id) {
    throw new Error('Configuração inválida: google_sheet_id não encontrado no banco de dados.');
  }
  if(!id || !status) throw new Error('Parâmetros inválidos (id/status).');

  const sheets = await getSheetsClient(config);
  const title = titleFromRange(config.google_sheet_range) || 'Página1';

  const range = `${title}!F${id}:F${id}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.google_sheet_id,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [[String(status)]] },
  });
  return { ok: true };
}

/* ===== IPCs do Monitor ===== */
ipcMain.handle('monitor:list', async (_e, { apenasHoje = true } = {}) => {
  try {
    const config = await getMonitorConfigFromDB();
    const r = await fetchFromSheet(config, { apenasHoje });
    return { ok: true, ...r };
  } catch (err) {
    console.error('[monitor:list] erro:', err);
    return { ok: false, error: String(err?.message || err) };
  }
});

// ==================================================================
// IPC HANDLE DE ATUALIZAR STATUS (RESTAURADO)
// ==================================================================
ipcMain.handle('monitor:update-status', async (_e, { id, status }) => {
  try {
    const config = await getMonitorConfigFromDB();
    const r = await updateStatusOnSheet(config, { id, status });
    return { ok: true, ...r };
  } catch (err) {
    console.error('[monitor:update-status] erro:', err);
    return { ok: false, error: String(err?.message || err) };
  }
});


/* ===== Lógica de criação de cliente ===== */
async function createClienteFromPedidoLogic(payload) {
  const { nome, telefone } = payload || {};
  
  if (!nome) throw new Error('Nome é obrigatório');

  const telefoneNormalizado = normalizePhone(telefone);

  if (!telefoneNormalizado) throw new Error('O número de telefone é obrigatório.');
  if (telefoneNormalizado.length < 10) throw new Error('O número de telefone parece inválido. Forneça o DDD + número completo.');

  const sqlCheck = `
    SELECT chave FROM clifor WHERE 
    CASE
      WHEN SUBSTRING(regexp_replace(telefone, '\\D', 'g') FROM 1 FOR 2) = '55' AND LENGTH(regexp_replace(telefone, '\\D', 'g')) > 11
      THEN SUBSTRING(regexp_replace(telefone, '\\D', 'g') FROM 3)
      ELSE regexp_replace(telefone, '\\D', 'g')
    END = $1
  `;
  const checkRes = await db.query(sqlCheck, [telefoneNormalizado]);
  if (checkRes.rows.length > 0) {
    throw new Error('Um cliente com este telefone já existe no banco de dados.');
  }

  const sql = `
    INSERT INTO clifor (ativo, nome, fisjur, tipo, telefone)
    VALUES (1, $1, 'F', 1, $2)
    RETURNING chave;
  `;
  
  const r = await db.query(sql, [nome, telefone]);
  return r.rows[0];
}

/* ===== IPC para criar cliente ===== */
ipcMain.handle('clientes:create-from-pedido', async (_e, { nome, telefone }) => {
  try {
    await createClienteFromPedidoLogic({ nome, telefone });
    return { ok: true };
  } catch (err)
 {
    console.error('[clientes:create-from-pedido] erro:', err);
    return { ok: false, error: String(err?.message || 'Erro ao tentar cadastrar cliente.') };
  }
});


module.exports = {};