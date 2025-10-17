// src/main/ipc/relatorios.js
// IPC de Relatórios (novo esquema)
// - Vendas:    pedidos / pedido_itens
// - Compras:   entradas / itementrada*
// - Clientes:  clifor
//
// Handlers expostos:
//   rel:fatdiario:listar            (alias: rel:fat:diario:listar)
//   rel:porcliente:listar           (alias: rel:fat:porcliente:listar)
//   rel:historicocomercial:listar

const { ipcMain } = require('electron');
const db = require('./db');

// ---------------------------- helpers ----------------------------
function buildWhere(alias, f, opts = {}) {
  const { hasEmpresa = false } = opts;
  const w = [];
  const p = [];

  if (f?.dtini) {
    p.push(`${f.dtini} 00:00:00`);
    w.push(`${alias}.datahoracad >= $${p.length}`);
  }
  if (f?.dtfim) {
    p.push(`${f.dtfim} 23:59:59`);
    w.push(`${alias}.datahoracad <= $${p.length}`);
  }

  const cli = f?.cliforId ?? f?.clienteId;
  if (cli) {
    p.push(Number(cli));
    w.push(`${alias}.chaveclifor = $${p.length}`);
  }

  if (hasEmpresa && f?.empresaId) {
    p.push(Number(f.empresaId));
    w.push(`${alias}.chaveemp = $${p.length}`);
  }

  // onde houver coluna 'ativo'
  w.push(`${alias}.ativo = 1`);

  return { clause: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p };
}
const normRows = (r) => (Array.isArray(r) ? r : []);
const sum = (arr, pick = (x) => x) => (arr || []).reduce((a, b) => a + Number(pick(b) || 0), 0);

// ---------------------------- Faturamento Diário ----------------------------
async function _fatDiarioCore(_e, f = {}) {
  const mov = (f.movimento || 'saidas').toLowerCase();

  async function queryVendas() {
    const { clause, params } = buildWhere('p', f, { hasEmpresa: true });

    const { rows: porDia } = await db.query(
      `SELECT DATE(p.datahoracad) AS dia, SUM(COALESCE(p.total,0)) AS total
         FROM pedidos p
        ${clause}
     GROUP BY 1
     ORDER BY 1`,
      params
    );

    const { rows: docs } = await db.query(
      `SELECT p.chave AS codigo,
              p.datahoracad AS data,
              COALESCE(c.nome,'') AS cliente,
              COALESCE(p.total,0) AS total,
              'venda'::text AS mov
         FROM pedidos p
    LEFT JOIN clifor c ON c.chave = p.chaveclifor
        ${clause}
     ORDER BY p.datahoracad`,
      params
    );

    return { porDia: normRows(porDia), docs: normRows(docs), total: sum(porDia, r => r.total) };
  }

  async function queryCompras() {
    const { clause, params } = buildWhere('e', f, { hasEmpresa: false });

    const { rows: porDia } = await db.query(
      `SELECT DATE(e.datahoracad) AS dia, SUM(COALESCE(e.total,0)) AS total
         FROM entradas e
        ${clause}
     GROUP BY 1
     ORDER BY 1`,
      params
    );

    const { rows: docs } = await db.query(
      `SELECT e.chave AS codigo,
              e.datahoracad AS data,
              COALESCE(c.nome,'') AS cliente,
              COALESCE(e.total,0) AS total,
              'entrada'::text AS mov
         FROM entradas e
    LEFT JOIN clifor c ON c.chave = e.chaveclifor
        ${clause}
     ORDER BY e.datahoracad`,
      params
    );

    return { porDia: normRows(porDia), docs: normRows(docs), total: sum(porDia, r => r.total) };
  }

  if (mov === 'saidas') return await queryVendas();
  if (mov === 'entradas') return await queryCompras();

  const V = await queryVendas();
  const C = await queryCompras();

  const map = new Map();
  for (const r of V.porDia) map.set(String(r.dia).slice(0, 10), (map.get(String(r.dia).slice(0,10)) || 0) + Number(r.total || 0));
  for (const r of C.porDia) map.set(String(r.dia).slice(0, 10), (map.get(String(r.dia).slice(0,10)) || 0) + Number(r.total || 0));

  const porDia = Array.from(map.entries()).map(([dia, total]) => ({ dia, total })).sort((a, b) => a.dia.localeCompare(b.dia));
  const docs = [...V.docs, ...C.docs].sort((a, b) => new Date(a.data) - new Date(b.data));
  const totalPeriodo = V.total + C.total;

  return { porDia, docs, totalPeriodo };
}
ipcMain.handle('rel:fatdiario:listar', _fatDiarioCore);
ipcMain.handle('rel:fat:diario:listar', _fatDiarioCore);

// ---------------------------- Faturamento por Cliente ----------------------------
async function _porClienteCore(_e, f = {}) {
  const mov = (f.movimento || 'saidas').toLowerCase();

  async function vendasPorCliente() {
    const { clause, params } = buildWhere('p', f, { hasEmpresa: true });

    const { rows: resumo } = await db.query(
      `SELECT COALESCE(c.nome,'(Sem cliente)') AS cliente,
              SUM(COALESCE(p.total,0)) AS total
         FROM pedidos p
    LEFT JOIN clifor c ON c.chave = p.chaveclifor
        ${clause}
     GROUP BY 1
     ORDER BY total DESC NULLS LAST, 1`,
      params
    );

    const { rows: docs } = await db.query(
      `SELECT p.chave AS codigo,
              p.datahoracad AS data,
              COALESCE(c.nome,'') AS cliente,
              COALESCE(p.total,0) AS total,
              'venda'::text AS mov
         FROM pedidos p
    LEFT JOIN clifor c ON c.chave = p.chaveclifor
        ${clause}
     ORDER BY p.datahoracad`,
      params
    );

    return { resumo: normRows(resumo), docs: normRows(docs) };
  }

  async function comprasPorCliente() {
    const { clause, params } = buildWhere('e', f, { hasEmpresa: false });

    const { rows: resumo } = await db.query(
      `SELECT COALESCE(c.nome,'(Sem fornecedor)') AS cliente,
              SUM(COALESCE(e.total,0)) AS total
         FROM entradas e
    LEFT JOIN clifor c ON c.chave = e.chaveclifor
        ${clause}
     GROUP BY 1
     ORDER BY total DESC NULLS LAST, 1`,
      params
    );

    const { rows: docs } = await db.query(
      `SELECT e.chave AS codigo,
              e.datahoracad AS data,
              COALESCE(c.nome,'') AS cliente,
              COALESCE(e.total,0) AS total,
              'entrada'::text AS mov
         FROM entradas e
    LEFT JOIN clifor c ON c.chave = e.chaveclifor
        ${clause}
     ORDER BY e.datahoracad`,
      params
    );

    return { resumo: normRows(resumo), docs: normRows(docs) };
  }

  if (mov === 'saidas') return await vendasPorCliente();
  if (mov === 'entradas') return await comprasPorCliente();

  const V = await vendasPorCliente();
  const C = await comprasPorCliente();

  const map = new Map();
  for (const r of V.resumo) map.set(r.cliente, (map.get(r.cliente) || 0) + Number(r.total || 0));
  for (const r of C.resumo) map.set(r.cliente, (map.get(r.cliente) || 0) + Number(r.total || 0));

  const resumo = Array.from(map.entries())
    .map(([cliente, total]) => ({ cliente, total }))
    .sort((a, b) => Number(b.total) - Number(a.total));

  const docs = [...V.docs, ...C.docs].sort((a, b) => new Date(a.data) - new Date(b.data));
  return { resumo, docs };
}
ipcMain.handle('rel:porcliente:listar', _porClienteCore);
ipcMain.handle('rel:fat:porcliente:listar', _porClienteCore);

// ---------------------------- Histórico Comercial ----------------------------
ipcMain.handle('rel:historicocomercial:listar', async (_e, f = {}) => {
  const mov = (f.movimento || 'saidas').toLowerCase();
  const tipo = (f.tipoItem || 'produto').toLowerCase();

  async function vendasProdutos() {
    const { clause, params } = buildWhere('p', f, { hasEmpresa: true });
    const sql = `
      SELECT COALESCE(c.nome,'') AS cliente,
             COALESCE(pr.nome, CONCAT('Produto #', pi.chaveproduto)) AS descricao,
             pi.qtde, pi.valorunit,
             ROUND(COALESCE(pi.qtde,1) * COALESCE(pi.valorunit,0), 2) AS valortotal,
             'venda'::text AS mov,
             p.datahoracad AS data
        FROM pedido_itens pi
        JOIN pedidos p   ON p.chave = pi.chavepedido
   LEFT JOIN clifor c    ON c.chave = p.chaveclifor
   LEFT JOIN produtos pr ON pr.chave = pi.chaveproduto
       ${clause.replace(/^WHERE\s+/i, 'WHERE ')}
     ORDER BY p.datahoracad
    `;
    const { rows } = await db.query(sql, params);
    return rows;
  }

  async function vendasServicos() {
    const { clause, params } = buildWhere('s', f, { hasEmpresa: false });
    const { rows } = await db.query(
      `SELECT COALESCE(c.nome,'') AS cliente,
              COALESCE(sv.nome, CONCAT('Serviço #', isv.chaveservico)) AS descricao,
              isv.qtde, isv.valorunit, isv.valortotal,
              'venda'::text AS mov,
              s.datahoracad AS data
         FROM itemsaidaserv isv
         JOIN saidas s  ON s.chave = isv.chavesaida
    LEFT JOIN clifor c ON c.chave = s.chaveclifor
    LEFT JOIN servicos sv ON sv.chave = isv.chaveservico
        ${clause}
     ORDER BY s.datahoracad`,
      params
    );
    return rows;
  }

  async function entradaProdutos() {
    const { clause, params } = buildWhere('e', f, { hasEmpresa: false });
    const { rows } = await db.query(
      `SELECT COALESCE(c.nome,'') AS cliente,
              COALESCE(p.nome, CONCAT('Produto #', iep.chaveproduto)) AS descricao,
              iep.qtde, iep.valorunit, iep.valortotal,
              'entrada'::text AS mov,
              e.datahoracad AS data
         FROM itementradaprod iep
         JOIN entradas e ON e.chave = iep.chaveentrada
    LEFT JOIN clifor c ON c.chave = e.chaveclifor
    LEFT JOIN produtos p ON p.chave = iep.chaveproduto
        ${clause}
     ORDER BY e.datahoracad`,
      params
    );
    return rows;
  }

  async function entradaServicos() {
    const { clause, params } = buildWhere('e', f, { hasEmpresa: false });
    const { rows } = await db.query(
      `SELECT COALESCE(c.nome,'') AS cliente,
              COALESCE(sv.nome, CONCAT('Serviço #', ies.chaveservico)) AS descricao,
              ies.qtde, ies.valorunit, ies.valortotal,
              'entrada'::text AS mov,
              e.datahoracad AS data
         FROM itementradaserv ies
         JOIN entradas e ON e.chave = ies.chaveentrada
    LEFT JOIN clifor c ON c.chave = e.chaveclifor
    LEFT JOIN servicos sv ON sv.chave = ies.chaveservico
        ${clause}
     ORDER BY e.datahoracad`,
      params
    );
    return rows;
  }

  let itens = [];

  if (mov === 'saidas' || mov === 'ambos') {
    if (tipo === 'produto' || tipo === 'ambos') itens = itens.concat(await vendasProdutos());
    if (tipo === 'servico' || tipo === 'ambos') itens = itens.concat(await vendasServicos());
  }
  if (mov === 'entradas' || mov === 'ambos') {
    if (tipo === 'produto' || tipo === 'ambos') itens = itens.concat(await entradaProdutos());
    if (tipo === 'servico' || tipo === 'ambos') itens = itens.concat(await entradaServicos());
  }

  itens = normRows(itens).sort((a, b) => new Date(a.data) - new Date(b.data));
  return { itens };
});
