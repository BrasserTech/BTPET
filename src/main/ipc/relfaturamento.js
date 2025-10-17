// src/main/ipc/relfaturamento.js
// Relatório de Faturamento (somente pedidos) — filtros, ordenação e seleção de colunas no renderer.

const { ipcMain } = require('electron');
const db = require('./db');

// evita múltiplos handlers ao recarregar
function safeHandle(ch, fn) {
  try { ipcMain.removeHandler(ch); } catch (_) {}
  ipcMain.handle(ch, fn);
}

/** Mapeia sort seguro (whitelist) -> ORDER BY */
function buildOrderPedidos(sortBy, sortDir) {
  const dir = String(sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  switch (String(sortBy || '').toLowerCase()) {
    case 'codigo':   return { sql: `ORDER BY p.chave ${dir}` };
    case 'data':     return { sql: `ORDER BY p.datahoracad ${dir}` };
    case 'cliente':  return { sql: `ORDER BY c.nome ${dir} NULLS LAST, p.datahoracad DESC` };
    case 'telefone': return { sql: `ORDER BY c.telefone ${dir} NULLS LAST, p.datahoracad DESC` };
    case 'total':    return { sql: `ORDER BY p.total ${dir} NULLS LAST, p.datahoracad DESC` };
    default:         return { sql: `ORDER BY p.datahoracad DESC` };
  }
}

// WHERE conforme filtros
function buildWherePedidos(alias, f = {}) {
  const w = [`${alias}.ativo = 1`];
  const p = [];

  if (f.dtini) {
    p.push(String(f.dtini));
    w.push(`${alias}.datahoracad >= ($${p.length}::date)`);
  }
  if (f.dtfim) {
    p.push(String(f.dtfim));
    w.push(`${alias}.datahoracad < ($${p.length}::date + INTERVAL '1 day')`);
  }
  if (f.cliforId) {
    p.push(Number(f.cliforId));
    w.push(`${alias}.chaveclifor = $${p.length}`);
  }
  if (f.empresaId) {
    p.push(Number(f.empresaId));
    w.push(`${alias}.chaveemp = $${p.length}`);
  }
  if (f.telefone) {
    p.push(`%${String(f.telefone).trim()}%`);
    w.push(`COALESCE(c.telefone,'') ILIKE $${p.length}`);
  }

  return { clause: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p };
}

/**
 * canal: 'faturamento:listar'
 * payload: { dtini?, dtfim?, cliforId?, empresaId?, telefone?, sortBy?, sortDir? }
 * retorno: { docs:[{codigo,data,cliente,telefone,total}], totalPeriodo:number }
 */
safeHandle('faturamento:listar', async (_e, f = {}) => {
  const filters = {
    dtini: f?.dtini || null,
    dtfim: f?.dtfim || null,
    cliforId: Number(f?.cliforId || '') || null,
    empresaId: Number(f?.empresaId || '') || null,
    telefone: (f?.telefone || '').trim() || null,
    sortBy: f?.sortBy || null,
    sortDir: f?.sortDir || null,
  };

  const { clause, params } = buildWherePedidos('p', filters);
  const order = buildOrderPedidos(filters.sortBy, filters.sortDir).sql;

  const docsSql = `
    SELECT
      p.chave                 AS codigo,
      p.datahoracad           AS data,
      COALESCE(c.nome,'')     AS cliente,
      COALESCE(c.telefone,'') AS telefone,
      COALESCE(p.total,0)     AS total
    FROM pedidos p
    LEFT JOIN clifor c ON c.chave = p.chaveclifor
    ${clause}
    ${order}
  `;

  const totSql = `
    SELECT COALESCE(SUM(COALESCE(p.total,0)), 0) AS total
    FROM pedidos p
    LEFT JOIN clifor c ON c.chave = p.chaveclifor
    ${clause}
  `;

  const { rows: docs } = await db.query(docsSql, params);
  const { rows: rTot } = await db.query(totSql, params);
  const totalPeriodo = Number(rTot?.[0]?.total || 0);
  return { docs, totalPeriodo };
});

module.exports = {};
