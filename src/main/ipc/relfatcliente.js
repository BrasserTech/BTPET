// src/main/ipc/relfatcliente.js
// Faturamento por Cliente — filtros, ordenação segura, suporte a telefone
// e DETALHES de itens por pedido.

const { ipcMain } = require('electron');
const db = require('./db');

function safeHandle(ch, fn) {
  try { ipcMain.removeHandler(ch); } catch (_) {}
  ipcMain.handle(ch, fn);
}

function buildWherePedidos(alias, f = {}) {
  const w = [`${alias}.ativo = 1`];
  const p = [];

  if (f.dtini)   { p.push(String(f.dtini));  w.push(`${alias}.datahoracad >= ($${p.length}::date)`); }
  if (f.dtfim)   { p.push(String(f.dtfim));  w.push(`${alias}.datahoracad < ($${p.length}::date + INTERVAL '1 day')`); }
  if (f.cliforId){ p.push(Number(f.cliforId)); w.push(`${alias}.chaveclifor = $${p.length}`); }
  if (f.empresaId){p.push(Number(f.empresaId)); w.push(`${alias}.chaveemp = $${p.length}`); }
  if (f.telefone){ p.push(`%${String(f.telefone).trim()}%`); w.push(`COALESCE(c.telefone,'') ILIKE $${p.length}`); }

  return { clause: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p };
}

function buildOrderResumo(sortBy, sortDir) {
  const dir = String(sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  switch (String(sortBy || '').toLowerCase()) {
    case 'cliente':  return `ORDER BY cliente ${dir}`;
    case 'telefone': return `ORDER BY telefone ${dir} NULLS LAST, cliente`;
    case 'qtd':      return `ORDER BY qtd_pedidos ${dir}, total DESC`;
    case 'total':    return `ORDER BY total ${dir}, cliente`;
    default:         return `ORDER BY total DESC, cliente`;
  }
}

/**
 * canal: 'relfatcliente:listar'
 * payload: { dtini?, dtfim?, cliforId?, empresaId?, telefone?, sortBy?, sortDir? }
 * retorno: { resumo:[{chaveclifor,cliente,telefone,qtd_pedidos,total}] }
 */
safeHandle('relfatcliente:listar', async (_e, f = {}) => {
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
  const order = buildOrderResumo(filters.sortBy, filters.sortDir);

  const sql = `
    SELECT
      p.chaveclifor                         AS chaveclifor,
      COALESCE(c.nome, '(Sem cliente)')     AS cliente,
      COALESCE(c.telefone, '')              AS telefone,
      COUNT(*)                              AS qtd_pedidos,
      COALESCE(SUM(COALESCE(p.total,0)),0)  AS total
    FROM pedidos p
    LEFT JOIN clifor c ON c.chave = p.chaveclifor
    ${clause}
    GROUP BY p.chaveclifor, c.nome, c.telefone
    ${order}
  `;
  const { rows } = await db.query(sql, params);
  return { resumo: Array.isArray(rows) ? rows : [] };
});

/**
 * canal: 'relfatcliente:docsByCliente'
 * payload: { cliforId:number, dtini?, dtfim?, empresaId? }
 * retorno: { docs:[{codigo,data,total}] }
 */
safeHandle('relfatcliente:docsByCliente', async (_e, f = {}) => {
  const cliforId = Number(f.cliforId || 0);
  if (!cliforId) throw new Error('cliforId é obrigatório.');

  const { clause, params } = buildWherePedidos('p', { ...f, cliforId });

  const sql = `
    SELECT
      p.chave              AS codigo,
      p.datahoracad        AS data,
      COALESCE(p.total,0)  AS total
    FROM pedidos p
    ${clause}
    ORDER BY p.datahoracad DESC
  `;
  const { rows } = await db.query(sql, params);
  return { docs: Array.isArray(rows) ? rows : [] };
});

/**
 * canal: 'relfatcliente:itensByPedido'
 * payload: { pedidoId:number }
 * retorno: { itens:[{produto, qtde, valorunit, desconto, total}], totalItens:number }
 */
safeHandle('relfatcliente:itensByPedido', async (_e, f = {}) => {
  const pedidoId = Number(f.pedidoId || 0);
  if (!pedidoId) throw new Error('pedidoId é obrigatório.');

  // Tabela de itens no schema: public.pedido_itens
  const sql = `
    SELECT
      COALESCE(pr.nome,'(Sem produto)') AS produto,
      COALESCE(i.qtde,0)::numeric       AS qtde,
      COALESCE(i.valorunit,0)::numeric  AS valorunit,
      COALESCE(i.desconto,0)::numeric   AS desconto,
      COALESCE(i.valortotal, (COALESCE(i.qtde,0) * COALESCE(i.valorunit,0) - COALESCE(i.desconto,0)))::numeric AS total
    FROM public.pedido_itens i
    LEFT JOIN public.produtos pr ON pr.chave = i.chaveproduto
    WHERE i.chavepedido = $1
    ORDER BY pr.nome
  `;
  const { rows } = await db.query(sql, [pedidoId]);
  const totalItens = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  return { itens: Array.isArray(rows) ? rows : [], totalItens };
});

module.exports = {};
