// src/main/ipc/produtos.js
const { ipcMain } = require('electron');
const db = require('./db');

/** =========================
 * Helpers / Core query
 * ========================= */
async function listarProdutos(filtroRaw = '') {
  const raw = String(filtroRaw || '').trim();

  // Detecta "123 - Qualquer" -> código
  let codeFromCombo = null;
  const m = raw.match(/^\s*(\d+)\s*-\s*/);
  if (m && m[1]) codeFromCombo = Number(m[1]);

  // Classificação simples: codigo | nome
  let mode = 'nome';
  let term = raw;

  if (codeFromCombo != null) {
    mode = 'codigo';
    term = codeFromCombo;
  } else if (/^\d+$/.test(raw) && raw !== '') {
    mode = 'codigo';
    term = Number(raw);
  } else {
    mode = 'nome';
  }

  const cond = ['p.ativo = 1'];
  const vals = [];

  if (mode === 'codigo') {
    vals.push(Number(term));
    cond.push(`p.codigo = $${vals.length}`);
  } else { // nome
    vals.push(term);
    cond.push(`unaccent(lower(p.nome)) LIKE unaccent(lower('%' || $${vals.length} || '%'))`);
  }

  const where = `WHERE ${cond.join(' AND ')}`;

  const sql = `
    SELECT
      p.chave,
      p.codigo,
      p.ativo,
      p.nome,
      p.chaveemp,
      p.valorcompra,
      p.valorvenda,
      p.obs,
      p.categoria,
      p.validade,
      p.datahoracad,
      p.datahoraalt
    FROM produtos p
    ${where}
    ORDER BY p.nome ASC
  `;

  const r = await db.query(sql, vals);
  return r.rows;
}

async function criarProduto(payload = {}) {
  const {
    nome,
    chaveemp = null,
    valorcompra,
    valorvenda = null,
    obs = null,
    categoria = 1,
    validade = null,
    ativo = 1,
  } = payload;

  if (!nome) throw new Error('Nome é obrigatório.');
  if (valorcompra == null || Number.isNaN(Number(valorcompra))) {
    throw new Error('Valor de compra é obrigatório e deve ser numérico.');
  }

  const sql = `
    INSERT INTO produtos
      (ativo, nome, chaveemp, valorcompra, valorvenda, obs, categoria, validade)
    VALUES
      ($1,    $2,   $3,       $4,          $5,         $6,  $7,        $8)
    RETURNING chave, codigo
  `;
  const params = [
    Number(ativo) || 1,
    nome,
    chaveemp ? Number(chaveemp) : null,
    Number(valorcompra),
    (valorvenda == null ? null : Number(valorvenda)),
    obs,
    Number(categoria) || 1,
    validade || null,
  ];

  const r = await db.query(sql, params);
  return r.rows[0]; // { chave, codigo }
}

async function excluirProduto(payload = {}) {
  const { id, codigo } = payload || {};
  if (id == null && codigo == null) {
    throw new Error('Informe id (chave) ou código para excluir.');
  }

  const cond = [];
  const params = [];
  if (id != null) { params.push(Number(id)); cond.push(`chave = $${params.length}`); }
  if (codigo != null) { params.push(Number(codigo)); cond.push(`codigo = $${params.length}`); }

  const sql = `
    UPDATE produtos
       SET ativo = 2, datahoraalt = NOW()
     WHERE ${cond.join(' OR ')}
     RETURNING chave, codigo
  `;
  const r = await db.query(sql, params);
  if (!r.rowCount) throw new Error('Produto não encontrado.');
  return r.rows[0];
}

async function produtoByCodigo(codigo) {
  const r = await db.query('SELECT * FROM produtos WHERE codigo = $1', [codigo]);
  return r.rows[0] || null;
}

/** =========================
 * Autocomplete (já usado na view)
 * ========================= */
ipcMain.handle('produtos:search-for-autocomplete', async (_e, term) => {
  const t = (term || '').trim();
  if (t.length < 2) return [];

  const onlyDigits = t.replace(/\D/g, '');
  if (onlyDigits && onlyDigits === t) {
    const r = await db.query(
      `
        SELECT chave, codigo, nome, valorvenda, valorcompra
        FROM produtos
        WHERE ativo = 1 AND CAST(codigo AS TEXT) ILIKE $1
        ORDER BY codigo
        LIMIT 10
      `,
      [t + '%']
    );
    return r.rows;
  }

  const r = await db.query(
    `
      SELECT chave, codigo, nome, valorvenda, valorcompra
      FROM produtos
      WHERE ativo = 1 AND unaccent(nome) ILIKE unaccent($1)
      ORDER BY nome
      LIMIT 10
    `,
    ['%' + t + '%']
  );
  return r.rows;
});

/** =========================
 * Handlers principais
 * ========================= */
ipcMain.handle('produtos:listar', async (_evt, filtroRaw) => {
  return listarProdutos(filtroRaw);
});

ipcMain.handle('produtos:criar', async (_evt, payload = {}) => {
  return criarProduto(payload);
});

ipcMain.handle('produtos:excluir', async (_evt, payload = {}) => {
  return excluirProduto(payload);
});

/** =========================
 * Aliases de compatibilidade
 * ========================= */
ipcMain.handle('produtos:list', async (_e, { search = '' } = {}) => {
  return listarProdutos(search);
});

ipcMain.handle('produtos:create', async (_e, payload = {}) => {
  return criarProduto(payload);
});

ipcMain.handle('produtos:byCodigo', async (_e, codigo) => {
  return produtoByCodigo(Number(codigo));
});
