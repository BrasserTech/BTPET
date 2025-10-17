// src/main/ipc/dashboard.js
// Exibe SOMENTE dados do banco (pedidos/pedido_itens).
// 'WhatsApp' => bot=true; 'App' => bot=false; 'Todos' => ambos.
// Remove leitura direta do Google Sheets para a UI.

const { ipcMain } = require('electron');
const db = require('./db');

/* =========================
   Helpers (datas / números)
   ========================= */
function titleFromRange(r) {
  if (!r || !r.includes('!')) return null;
  return r.split('!')[0].replace(/^'|'+$/g, '');
}
function parseDateWithFix(iso) {
  if (!iso) return null;
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? null : d;
}
function brMoneyToNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function statusLabel(code) {
  const s = String(code ?? '').trim();
  if (s === '1') return 'Em preparo';
  if (s === '2') return 'Saiu para entrega';
  if (s === '3') return 'Pronto';
  return s || '—';
}
function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabelFromKey(k) {
  const [y, m] = k.split('-');
  return `${m}/${String(y).slice(-2)}`;
}
function listMonthsInclusive(dtStart, dtEnd) {
  const out = [];
  const a = new Date(Date.UTC(dtStart.getUTCFullYear(), dtStart.getUTCMonth(), 1));
  const b = new Date(Date.UTC(dtEnd.getUTCFullYear(), dtEnd.getUTCMonth(), 1));
  for (let y = a.getUTCFullYear(), m = a.getUTCMonth(); y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth()); ) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

/* =========================
   Banco (App) - com filtro por bot
   ========================= */
async function fetchFromDBInRange(dtStart, dtEnd, onlyBot = null) {
  const cond = ['p.ativo = 1', 'p.datahoracad >= $1', 'p.datahoracad <= $2'];
  const vals = [dtStart, dtEnd];

  if (onlyBot === true) {
    cond.push('COALESCE(p.bot, false) = true');
  } else if (onlyBot === false) {
    cond.push('COALESCE(p.bot, false) = false');
  }

  const sql = `
    SELECT p.datahoracad AS data, 
           COALESCE(c.nome,'') AS cliente,
           COALESCE(p.total,0)::numeric(14,2) AS total,
           COALESCE(p.status,1)::int AS status,
           COALESCE(p.bot,false) AS bot
      FROM pedidos p
 LEFT JOIN clifor c ON c.chave = p.chaveclifor
     WHERE ${cond.join(' AND ')}
     ORDER BY p.datahoracad ASC
  `;
  const r = await db.query(sql, vals);
  return r.rows.map(x => ({
    origem: x.bot ? 'WhatsApp (Sheets)' : 'App (manual)',
    data: new Date(x.data),
    cliente: x.cliente || '',
    total: Number(x.total || 0),
    statusCode: String(x.status || 1),
    status: statusLabel(x.status),
    bot: !!x.bot,
  }));
}

/* =========================
   Agregação
   ========================= */
function rollupMonthly(rows, dtStart, dtEnd) {
  const keys = listMonthsInclusive(
    new Date(Date.UTC(dtStart.getUTCFullYear(), dtStart.getUTCMonth(), 1)),
    new Date(Date.UTC(dtEnd.getUTCFullYear(), dtEnd.getUTCMonth(), 1))
  );
  const map = new Map(keys.map(k => [k, { fat: 0, ped: 0 }]));

  let totalFat = 0;
  let totalPed = 0;
  for (const r of rows) {
    const k = monthKey(new Date(Date.UTC(r.data.getUTCFullYear(), r.data.getUTCMonth(), 1)));
    if (!map.has(k)) continue;
    map.get(k).fat += Number(r.total || 0);
    map.get(k).ped += 1;
    totalFat += Number(r.total || 0);
    totalPed += 1;
  }

  const labels = keys.map(monthLabelFromKey);
  const faturamento = keys.map(k => map.get(k).fat);
  const pedidos = keys.map(k => map.get(k).ped);
  return { labels, faturamento, pedidos, totalFaturamento: totalFat, totalPedidos: totalPed };
}

/* =========================
   Normalização de parâmetros
   ========================= */
function coerceDateRange({ inicio, fim, atalho }) {
  const now = new Date();
  const end = fim ? new Date(fim) : now;
  let start = inicio ? new Date(inicio) : null;

  if (!start) {
    const opt = String(atalho || '').trim();
    const months = opt.startsWith('Últimos ') ? parseInt(opt.replace(/\D+/g, ''), 10) : NaN;
    if (Number.isFinite(months) && months > 0) {
      start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1, 0, 0, 0, 0);
    } else {
      start = new Date(end.getFullYear(), end.getMonth() - 5, 1, 0, 0, 0, 0);
    }
  } else {
    start.setHours(0, 0, 0, 0);
  }
  const endAdj = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  return { dtStart: start, dtEnd: endAdj };
}

/* =========================
   IPCs
   ========================= */
ipcMain.handle('dashboard:fat-qty', async (_e, params = {}) => {
  const { dtStart, dtEnd } = coerceDateRange(params);
  const origem = (params.origem || 'Todos').trim();

  let rows = [];
  if (origem === 'App') {
    // Apenas lançamentos manuais
    rows = await fetchFromDBInRange(dtStart, dtEnd, false);
  } else if (origem === 'WhatsApp') {
    // Apenas o que já foi sincronizado do WhatsApp (bot=true)
    rows = await fetchFromDBInRange(dtStart, dtEnd, true);
  } else {
    // Todos = banco inteiro (manuais + sincronizados)
    rows = await fetchFromDBInRange(dtStart, dtEnd, null);
  }

  return rollupMonthly(rows, dtStart, dtEnd);
});

ipcMain.handle('dashboard:last', async (_e, params = {}) => {
  const { dtStart, dtEnd } = coerceDateRange(params);
  const origem = (params.origem || 'Todos').trim();
  const limit = Math.max(5, Math.min(Number(params.limit || 20), 50));

  let rows = [];
  if (origem === 'App') {
    rows = await fetchFromDBInRange(dtStart, dtEnd, false);
  } else if (origem === 'WhatsApp') {
    rows = await fetchFromDBInRange(dtStart, dtEnd, true);
  } else {
    rows = await fetchFromDBInRange(dtStart, dtEnd, null);
  }

  rows.sort((a, b) => b.data - a.data);

  const out = rows.slice(0, limit).map(r => ({
    data: r.data,
    cliente: r.cliente || '',
    status: r.status || '',
    total: Number(r.total || 0),
    origem: r.bot ? 'WhatsApp (Sheets)' : 'App (manual)',
  }));

  return out;
});
