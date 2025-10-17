const { ipcMain } = require('electron');
const db = require('./db');

// =================================================================
// LÓGICA CENTRAL DE CRIAÇÃO E VALIDAÇÃO
// Esta função contém as regras de negócio e o acesso ao banco.
// =================================================================
async function createClienteLogic(payload) {
  const {
    nome, fisjur = 'F', tipo = 1, email = null, cpf = null,
    telefone = null, endereco = null, pertenceemp = null
  } = payload || {};

  // --- VALIDAÇÕES CENTRALIZADAS ---
  if (!nome) throw new Error('Nome é obrigatório');

  if (!telefone) throw new Error('O número de telefone é obrigatório.');

  const telefoneDigits = (telefone || '').replace(/\D/g, ''); // Remove tudo que não for dígito
  if (telefoneDigits.length < 10) { // Exige pelo menos 10 dígitos (DDD + 8 dígitos)
    throw new Error('O número de telefone parece inválido. Forneça o DDD + número completo.');
  }
  // --- FIM DAS VALIDAÇÕES ---

  const sql = `
    INSERT INTO clifor (ativo, nome, fisjur, tipo, email, cpf, telefone, endereco, pertenceemp)
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING chave, codigo, nome, fisjur, tipo, email, cpf, telefone, endereco, datahoracad;
  `;
  const r = await db.query(sql, [nome, fisjur, tipo, email, cpf, telefone, endereco, pertenceemp]);
  return r.rows[0];
}

// =================================================================
// IPC HANDLERS - PONTO DE ENTRADA PARA O RENDERER (FRONT-END)
// =================================================================

/* ===================== CREATE / SAVE ===================== */

ipcMain.handle('clientes:create', async (_e, payload) => {
  try {
    return await createClienteLogic(payload);
  } catch (err) {
    // Captura erros da lógica (ex: validação) e os re-lança para o renderer
    throw new Error(err.message);
  }
});

ipcMain.handle('clientes:save', async (_e, payload) => {
  try {
    // Chama a MESMA lógica central, garantindo a validação
    return await createClienteLogic(payload);
  } catch (err) {
    throw new Error(err.message);
  }
});

/* ===================== LIST SIMPLES ===================== */
ipcMain.handle('clientes:list', async (_e, { search = '', limit = 50, offset = 0 } = {}) => {
  const q = `
    SELECT chave, codigo, nome, fisjur, tipo, email, telefone
    FROM clifor
    WHERE ativo = 1
      AND ($1 = '' OR unaccent(lower(nome)) LIKE unaccent(lower('%' || $1 || '%')))
    ORDER BY nome ASC
    LIMIT $2 OFFSET $3;
  `;
  const r = await db.query(q, [search, limit, offset]);
  return r.rows;
});

/* ===================== BY CODIGO ===================== */
ipcMain.handle('clientes:byCodigo', async (_e, codigo) => {
  const r = await db.query('SELECT * FROM clifor WHERE codigo = $1', [codigo]);
  return r.rows[0] || null;
});

/* ===================== SEARCH PAGINADO (classificação robusta) ===================== */
ipcMain.handle('clientes:search', async (_e, { q = '', page = 1, pageSize = 10 } = {}) => {
  const offset = Math.max(0, (Number(page) - 1) * Number(pageSize));
  const limit = Math.max(1, Number(pageSize));

  const raw = String(q || '').trim();
  const digits = raw.replace(/\D/g, '');

  let codeFromCombo = null;
  const m = raw.match(/^\s*(\d+)\s*-\s*/);
  if (m && m[1]) codeFromCombo = Number(m[1]);

  let mode = 'nome'; // nome | codigo | email | doc | telefone
  let term = raw;

  if (codeFromCombo != null) {
    mode = 'codigo';
    term = codeFromCombo;
  } else if (raw.includes('@')) {
    mode = 'email';
  } else if (/^\d+$/.test(raw)) {
    if (digits.length >= 14 || digits.length === 11) {
      mode = 'doc'; // cpf/cnpj
    } else if (digits.length >= 8) {
      mode = 'telefone';
    } else {
      mode = 'codigo';
      term = Number(digits || 0);
    }
  } else if (digits.length >= 8) {
    mode = (digits.length >= 14 || digits.length === 11) ? 'doc' : 'telefone';
    term = digits;
  } else {
    mode = 'nome';
  }

  const cond = ['c.ativo = 1'];
  const vals = [];

  switch (mode) {
    case 'codigo': {
      vals.push(Number(term));
      cond.push(`c.codigo = $${vals.length}`);
      break;
    }
    case 'email': {
      vals.push(term);
      cond.push(`unaccent(lower(c.email)) LIKE unaccent(lower('%' || $${vals.length} || '%'))`);
      break;
    }
    case 'doc': {
      const pref = (digits || term).replace(/\D/g, '') + '%';
      vals.push(pref);
      cond.push(`regexp_replace(COALESCE(c.cpf,''), '[^0-9]', '', 'g') ILIKE $${vals.length}`);
      break;
    }
    case 'telefone': {
      const pref = (digits || term).replace(/\D/g, '') + '%';
      vals.push(pref);
      cond.push(`regexp_replace(COALESCE(c.telefone,''), '[^0-9]', '', 'g') ILIKE $${vals.length}`);
      break;
    }
    case 'nome':
    default: {
      vals.push(term);
      cond.push(`unaccent(lower(c.nome)) LIKE unaccent(lower('%' || $${vals.length} || '%'))`);
      break;
    }
  }

  const where = `WHERE ${cond.join(' AND ')}`;

  const rowsSql = `
    SELECT c.codigo, c.nome, c.fisjur, c.tipo, c.cpf AS documento,
           c.email, c.telefone, c.endereco, c.datahoracad
      FROM clifor c
     ${where}
     ORDER BY c.datahoracad DESC, c.codigo DESC
     LIMIT $${vals.length + 1} OFFSET $${vals.length + 2};
  `;
  const totalSql = `
    SELECT COUNT(*)::int AS total
      FROM clifor c
     ${where};
  `;

  const [rRows, rTot] = await Promise.all([
    db.query(rowsSql, [...vals, limit, offset]),
    db.query(totalSql, vals)
  ]);

  return { rows: rRows.rows, total: rTot.rows[0]?.total ?? 0 };
});

/* ===================== AUTOCOMPLETE ===================== */
ipcMain.handle('clientes:search-for-autocomplete', async (_e, term) => {
  const t = (term || '').trim();
  if (t.length < 2) return [];

  const tLike = `%${t}%`;
  const tDigits = t.replace(/\D/g, '');

  const sql = `
    SELECT
      chave, codigo, nome, email, telefone, cpf
    FROM clifor
    WHERE
      ativo = 1 AND (
        unaccent(nome) ILIKE unaccent($1) OR
        CAST(codigo AS TEXT) ILIKE $2 OR
        unaccent(COALESCE(email,'')) ILIKE unaccent($1) OR
        ($3 <> '' AND regexp_replace(COALESCE(telefone,''), '[^0-9]', '', 'g') ILIKE $3) OR
        ($4 <> '' AND regexp_replace(COALESCE(cpf,''), '[^0-9]', '', 'g') ILIKE $4)
      )
    ORDER BY nome
    LIMIT 10
  `;

  const params = [
    tLike,
    t + '%',
    tDigits ? tDigits + '%' : '',
    tDigits ? tDigits + '%' : ''
  ];

  const r = await db.query(sql, params);
  return r.rows;
});