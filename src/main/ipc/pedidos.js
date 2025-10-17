// src/main/ipc/pedidos.js
const { ipcMain } = require('electron');
const db = require('./db');

/* ========================= Helpers comuns ========================= */

function safeHandle(channel, fn) {
  try { ipcMain.removeHandler(channel); } catch (_) {}
  ipcMain.handle(channel, fn);
}

function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

// ---- Google Sheets helpers (mínimos) ----
let google = null;
async function lazyGoogle() {
  if (!google) ({ google } = require('googleapis'));
  return google;
}

async function getConfig() {
  const r = await db.query(`SELECT * FROM apigs_config ORDER BY chave DESC LIMIT 1`);
  return r.rows?.[0] || null;
}

async function getSheetsClientRW(cfg) {
  if (!cfg || !cfg.google_sheet_id) return null;
  const g = await lazyGoogle();
  const privateKey = String(cfg.private_key || '').replace(/\\n/g, '\n');
  const auth = new g.auth.GoogleAuth({
    credentials: { client_email: cfg.client_email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const authClient = await auth.getClient();
  return g.sheets({ version: 'v4', auth: authClient });
}

function stripDiacritics(s) {
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function splitA1(range) {
  const s = String(range||'').trim();
  const bang = s.indexOf('!');
  return { sheetName: bang>-1 ? s.slice(0,bang) : null, a1: bang>-1 ? s.slice(bang+1) : s };
}
function parseA1StartRow(a1) {
  const m = String(a1||'').match(/^[A-Za-z]+(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}
async function resolveExactRange(sheets, spreadsheetId, userRange, fallbackTitle='IA') {
  const { sheetName, a1 } = splitA1(userRange || '');
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = (meta.data.sheets||[]).map(s => s.properties?.title).filter(Boolean);
  if (!tabs.length) throw new Error('Planilha sem abas.');

  if (!sheetName) {
    const tab = tabs[0];
    return { finalRange: `${tab}!${a1 || 'A2:N'}`, tabTitle: tab, startRow: parseA1StartRow(a1||'A2') };
  }

  // tenta igual, depois normalizado
  const exact = tabs.find(t => t === sheetName);
  if (exact) return { finalRange: `${exact}!${a1 || 'A2:N'}`, tabTitle: exact, startRow: parseA1StartRow(a1||'A2') };

  const normalizedMap = new Map(tabs.map(t => [stripDiacritics(t).toLowerCase(), t]));
  const wanted = stripDiacritics(sheetName).toLowerCase();
  const normHit = normalizedMap.get(wanted);
  if (normHit) return { finalRange: `${normHit}!${a1 || 'A2:N'}`, tabTitle: normHit, startRow: parseA1StartRow(a1||'A2') };

  // fallback
  const fb = tabs.find(t => stripDiacritics(t).toLowerCase() === stripDiacritics(fallbackTitle).toLowerCase()) || tabs[0];
  return { finalRange: `${fb}!${a1 || 'A2:N'}`, tabTitle: fb, startRow: parseA1StartRow(a1||'A2') };
}

function parseMoney(v, def = 0) {
  if (v === null || v === undefined || v === '') return def;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}

/**
 * Localiza a linha da planilha correspondente a um pedido já importado (J='S'),
 * usando: cliente (B), total (E), quantidade (I) e a descrição do item (C ou L ou M).
 * Retorna o número absoluto da linha (ex.: 2 significa linha 2) ou null.
 */
async function findSheetRowForPedido(sheets, cfg, pedidoChave) {
  // 1) Dados do pedido (cliente, total, qtd, item)
  const r = await db.query(`
    SELECT
      p.chave,
      p.total::numeric(14,2) AS total,
      c.nome AS cliente,
      COALESCE(c.telefone,'') AS telefone,
      COALESCE(SUM(i.qtde),0)        AS qtd,
      MIN(pr.nome)                   AS item_nome
    FROM pedidos p
    JOIN clifor c       ON c.chave = p.chaveclifor
    LEFT JOIN pedido_itens i ON i.chavepedido = p.chave
    LEFT JOIN produtos pr     ON pr.chave      = i.chaveproduto
    WHERE p.chave = $1
    GROUP BY p.chave, p.total, c.nome, c.telefone
  `, [Number(pedidoChave)]);
  const row = r.rows[0];
  if (!row) return null;

  const itemNome = (row.item_nome || '').trim();
  const cliente  = (row.cliente   || '').trim();
  const qtd      = Number(row.qtd || 0);
  const total    = Number(row.total || 0);

  // 2) Leitura da planilha
  const rangeReq = (cfg.google_sheet_range || 'IA!A2:N').trim();
  const { finalRange, tabTitle, startRow } = await resolveExactRange(sheets, cfg.google_sheet_id, rangeReq, 'IA');

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: cfg.google_sheet_id,
    range: finalRange,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = Array.isArray(resp.data.values) ? resp.data.values : [];

  const norm = (s)=>stripDiacritics(String(s||'').trim()).toLowerCase();

  for (let i=0;i<values.length;i++){
    const raw = values[i] || [];
    const [
      _A_dt, B_nome, C_pedido, _D_obs, E_total, _F_status,
      _G_endereco, _H_numero, I_qtd, J_ja, _K_cont, L_opcao, M_tam, _N_tipo
    ] = raw.concat(new Array(14)).slice(0,14);

    const ja = String(J_ja ?? '').trim().toUpperCase();
    if (ja !== 'S') continue;

    const nmOK  = norm(B_nome) === norm(cliente);
    const totOK = Math.abs(parseMoney(E_total, 0) - total) < 0.005;
    const qtdOK = Number(I_qtd || 0) === qtd;

    // descrição do item pode ter vindo de C || L || M (importador original)
    const anyItem =
      norm(C_pedido) === norm(itemNome) ||
      norm(L_opcao)  === norm(itemNome) ||
      norm(M_tam)    === norm(itemNome);

    if (nmOK && totOK && qtdOK && anyItem) {
      return { absRow: startRow + i, tabTitle };
    }
  }

  return null;
}

/* ============================ CREATE ============================ */
safeHandle('pedidos:create', async (_e, payload = {}) => {
  const {
    chaveclifor,
    status = 1,
    obs = null,
    itens = [],
    tipopag = null,   // << NOVO
  } = payload;

  if (!chaveclifor) throw new Error('Cliente obrigatório.');
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('Informe itens.');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // cria o pedido com totais zerados (e já guarda tipopag)
    const rPed = await client.query(
      `INSERT INTO pedidos (ativo, chaveclifor, status, obs, subtotal, desconto, acrescimo, total, tipopag)
       VALUES (1, $1, $2, $3, 0, 0, 0, 0, $4)
       RETURNING chave, numero, datahoracad`,
      [chaveclifor, toNumber(status, 1), obs, tipopag]
    );
    const pedido = rPed.rows[0];

    // itens
    let subtotal = 0;
    for (const it of itens) {
      const { chaveproduto, qtde, valorunit } = it || {};
      if (!chaveproduto) throw new Error('Item sem produto.');

      const q  = toNumber(qtde, 1);
      const vu = toNumber(valorunit, 0);
      const vt = Math.round(q * vu * 100) / 100;
      subtotal += vt;

      await client.query(
        `INSERT INTO pedido_itens (chavepedido, chaveproduto, qtde, valorunit, desconto, valortotal)
         VALUES ($1, $2, $3, $4, 0, $5)`,
        [pedido.chave, chaveproduto, q, vu, vt]
      );
    }

    // fecha totais e mantém tipopag como veio
    const desconto = 0;
    const acrescimo = 0;
    const total = Math.round((subtotal - desconto + acrescimo) * 100) / 100;
    await client.query(
      `UPDATE pedidos
         SET subtotal = $1,
             desconto = $2,
             acrescimo = $3,
             total = $4,
             tipopag = COALESCE($5, tipopag)
       WHERE chave = $6`,
      [subtotal, desconto, acrescimo, total, tipopag, pedido.chave]
    );

    await client.query('COMMIT');
    return { ...pedido, total };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});


// --- helper local (coluna existe?) ---
async function tableHasColumn(table, column) {
  const r = await db.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = $1
        AND column_name  = $2
      LIMIT 1`,
    [String(table), String(column)]
  );
  return !!r.rowCount;
}

/* ======================= UPDATE STATUS (DB + Sheets) ======================= */
safeHandle('pedidos:update-status', async (_e, { chave, status } = {}) => {
  const id = Number(chave);
  const st = Number(status);
  if (!Number.isFinite(id) || id <= 0) throw new Error('chave inválida.');
  if (![1,2,3].includes(st)) throw new Error('status inválido.');

  // Monta UPDATE de forma dinâmica conforme existência de updated_at
  const hasUpdatedAt = await tableHasColumn('pedidos', 'updated_at');
  const setPieces = ['status = $2'];
  if (hasUpdatedAt) setPieces.push('updated_at = now()');

  const sql = `UPDATE pedidos SET ${setPieces.join(', ')} WHERE chave = $1 RETURNING chave, status`;
  const r = await db.query(sql, [id, st]);
  if (!r.rowCount) throw new Error('Pedido não encontrado.');

  // 2) Melhor-esforço para refletir na planilha
  try {
    const cfg = await getConfig();
    if (cfg && cfg.google_sheet_id && cfg.client_email && cfg.private_key) {
      const sheets = await getSheetsClientRW(cfg);
      if (sheets) {
        const hit = await findSheetRowForPedido(sheets, cfg, id);
        if (hit && hit.absRow) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: cfg.google_sheet_id,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: [{ range: `${hit.tabTitle}!F${hit.absRow}:F${hit.absRow}`, values: [[String(st)]] }]
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('[pedidos:update-status] aviso: falha ao refletir na planilha:', e?.message || e);
  }

  return { ok: true, chave: r.rows[0].chave, status: r.rows[0].status };
});

/* =============== LIST (compat c/ versões antigas) =============== */
safeHandle('pedidos:search', async (_e, { q = '', page = 1, pageSize = 10 } = {}) => {
  const offset = Math.max(0, (Number(page) - 1) * Number(pageSize));
  const like = q || '';

  const where = `
    p.ativo = 1 AND (
      $1 = '' OR
      COALESCE(p.numero, p.chave::text) = $1 OR
      unaccent(lower(c.nome)) LIKE unaccent(lower('%' || $1 || '%')) OR
      unaccent(lower(COALESCE(p.obs, ''))) LIKE unaccent(lower('%' || $1 || '%'))
    )
  `;

  const rowsSql = `
    SELECT
      p.chave,
      COALESCE(p.numero, p.chave::text) AS codigo,
      c.nome AS cliente,
      COALESCE(ii.qtd_itens, 0)::int AS qtd_itens,
      p.status,
      p.tipopag,                  -- << NOVO
      p.total,
      p.obs,
      p.datahoracad
    FROM pedidos p
    JOIN clifor c ON c.chave = p.chaveclifor
    LEFT JOIN (
      SELECT chavepedido, COUNT(*)::int AS qtd_itens
      FROM pedido_itens
      GROUP BY chavepedido
    ) ii ON ii.chavepedido = p.chave
    WHERE ${where}
    ORDER BY p.datahoracad DESC, p.chave DESC
    LIMIT $2 OFFSET $3;
  `;

  const totalSql = `
    SELECT COUNT(*)::int AS total
    FROM pedidos p
    JOIN clifor c ON c.chave = p.chaveclifor
    WHERE ${where};
  `;

  const [rRows, rTot] = await Promise.all([
    db.query(rowsSql, [like, pageSize, offset]),
    db.query(totalSql, [like])
  ]);

  return { rows: rRows.rows, total: rTot.rows[0]?.total ?? 0 };
});

/* ======= SEARCH2 (filtros completos + paginação) ======= */
safeHandle('pedidos:search2', async (_e, args = {}) => {
  const {
    cliente = null,
    from = null,
    to = null,
    status = null,
    item = null,
    page = 1,
    pageSize = 10
  } = args;

  const vals = [];
  const cond = ['p.ativo = 1'];

  if (cliente && String(cliente).trim() !== '') {
    const raw = String(cliente).trim();
    let maybeCode = null;
    const m = raw.match(/^\s*(\d+)\s*-\s*/);
    if (m && m[1]) { maybeCode = Number(m[1]); }
    else if (/^\d+$/.test(raw)) { maybeCode = Number(raw); }

    if (maybeCode != null) {
      vals.push(maybeCode);
      cond.push(`c.codigo = $${vals.length}`);
    } else {
      vals.push(raw);
      cond.push(`unaccent(lower(c.nome)) LIKE unaccent(lower('%' || $${vals.length} || '%'))`);
    }
  }

  if (from) { vals.push(from); cond.push(`p.datahoracad >= $${vals.length}`); }
  if (to)   { vals.push(to + ' 23:59:59.999'); cond.push(`p.datahoracad <= $${vals.length}`); }
  if (status != null && status !== '') {
    vals.push(Number(status));
    cond.push(`p.status = $${vals.length}`);
  }

  let joinItem = '';
  if (item && String(item).trim() !== '') {
    joinItem = `
      JOIN pedido_itens fi ON fi.chavepedido = p.chave
      JOIN produtos     fp ON fp.chave       = fi.chaveproduto
    `;
    const rawItem = String(item).trim();
    if (/^\d+$/.test(rawItem)) {
      vals.push(Number(rawItem));
      cond.push(`fp.codigo = $${vals.length}`);
    } else {
      vals.push(rawItem);
      cond.push(`unaccent(lower(fp.nome)) LIKE unaccent(lower('%' || $${vals.length} || '%'))`);
    }
  }

  const whereSQL = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const limit  = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const offset = Math.max(0, (Number(page) - 1) * limit);

  const rowsSql = `
    SELECT
      p.chave,
      COALESCE(p.numero, p.chave::text) AS codigo,
      c.nome AS cliente,
      COALESCE(ii.qtd_itens, 0)::int AS qtd_itens,
      p.status,
      p.tipopag,                -- << NOVO
      p.total,
      p.obs,
      p.datahoracad
    FROM pedidos p
    JOIN clifor c ON c.chave = p.chaveclifor
    ${joinItem}
    LEFT JOIN (
      SELECT chavepedido, COUNT(*)::int AS qtd_itens
      FROM pedido_itens
      GROUP BY chavepedido
    ) ii ON ii.chavepedido = p.chave
    ${whereSQL}
    GROUP BY p.chave, p.numero, c.nome, ii.qtd_itens, p.tipopag  -- << AJUSTE
    ORDER BY p.datahoracad DESC, p.chave DESC
    LIMIT $${vals.length + 1} OFFSET $${vals.length + 2};
  `;

  const totalSql = `
    SELECT COUNT(DISTINCT p.chave)::int AS total
    FROM pedidos p
    JOIN clifor c ON c.chave = p.chaveclifor
    ${joinItem}
    ${whereSQL};
  `;

  const rRows = await db.query(rowsSql, [...vals, limit, offset]);
  const rTot  = await db.query(totalSql, vals);
  return { rows: rRows.rows, total: rTot.rows[0]?.total ?? 0 };
});

/* =============== ITENS DO PEDIDO (cascata) =============== */
safeHandle('pedidos:itemsByPedido', async (_e, { chave = null, codigo = null } = {}) => {
  let chavepedido = null;

  if (chave) {
    chavepedido = Number(chave);
  } else if (codigo != null) {
    const r = await db.query(
      `SELECT chave FROM pedidos WHERE (numero = $1 OR chave::text = $1) LIMIT 1`,
      [String(codigo)]
    );
    chavepedido = r.rows[0]?.chave ?? null;
  }

  if (!chavepedido) throw new Error('chavepedido é obrigatória.');

  const sql = `
    SELECT
      i.chave,
      i.chaveproduto,
      i.qtde,
      i.valorunit,
      i.valortotal,
      p.codigo AS codigo_prod,
      p.nome   AS produto_nome
    FROM pedido_itens i
    JOIN produtos p ON p.chave = i.chaveproduto
    WHERE i.chavepedido = $1
    ORDER BY i.chave ASC;
  `;
  const rItems = await db.query(sql, [chavepedido]);
  return { rows: rItems.rows };
});

/* =================== CLIENTES (autocomplete) =================== */
safeHandle('clientes:search-for-autocomplete', async (_e, term) => {
  if (!term || term.trim().length < 3) return [];

  const searchTerm = term.trim() + '%';
  const searchTermNumeric = (term || '').replace(/\D/g, '') + '%';

  const sql = `
    SELECT chave, codigo, nome, telefone
    FROM clifor
    WHERE ativo = 1 AND (
      unaccent(nome) ILIKE unaccent($1) OR
      CAST(codigo AS TEXT) ILIKE $1 OR
      ($2 != '%' AND regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') ILIKE $2)
    )
    ORDER BY nome
    LIMIT 10
  `;
  const result = await db.query(sql, [searchTerm, searchTermNumeric]);
  return result.rows;
});

/* =================== PRODUTOS (byCodigo + autocomplete) =================== */
safeHandle('produtos:byCodigo', async (_e, codigo) => {
  if (!codigo) return null;
  const sql = `
    SELECT chave, codigo, nome, valorvenda, valorcompra
    FROM produtos
    WHERE ativo = 1 AND codigo = $1
    LIMIT 1
  `;
  const r = await db.query(sql, [Number(codigo)]);
  return r.rows[0] || null;
});

safeHandle('produtos:search-for-autocomplete', async (_e, term) => {
  if (!term || !String(term).trim()) return [];
  const t = String(term).trim();
  const onlyDigits = t.replace(/\D/g, '');

  let rows;
  if (onlyDigits && onlyDigits === t) {
    rows = await db.query(
      `SELECT chave, codigo, nome, valorvenda, valorcompra
       FROM produtos
       WHERE ativo = 1 AND CAST(codigo AS TEXT) ILIKE $1
       ORDER BY codigo
       LIMIT 10`,
      [t + '%']
    );
  } else {
    rows = await db.query(
      `SELECT chave, codigo, nome, valorvenda, valorcompra
       FROM produtos
       WHERE ativo = 1 AND unaccent(nome) ILIKE unaccent($1)
       ORDER BY nome
       LIMIT 10`,
      ['%' + t + '%']
    );
  }
  return rows.rows;
});
