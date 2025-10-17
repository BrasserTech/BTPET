// src/main/ipc/sheets-sync.js
// Sincroniza pedidos da planilha (A..N) para o banco.
// Pendente = coluna J ("jaimportado") vazia ou 0.
// Após inserir no banco, marca "S" na coluna J da própria aba.
// Robusto a acentos/mojibake no nome da aba (resolve via metadados).
// Corrige parse de moeda (evita 175.00 -> 17500) e respeita NOT NULL em produtos.valorcompra.

const { ipcMain } = require('electron');
const crypto = require('crypto');
const db = require('./db');

let google = null;
async function lazyGoogle() {
  if (!google) ({ google } = require('googleapis'));
  return google;
}

/* =========================
   Config (apigs_config)
   ========================= */
async function getDashboardConfigFromDB() {
  const sql = 'SELECT * FROM apigs_config ORDER BY chave DESC LIMIT 1';
  const r = await db.query(sql);
  return r.rows?.[0] || null;
}

async function getSheetsClient(cfg, scope = 'https://www.googleapis.com/auth/spreadsheets') {
  if (!cfg || !cfg.google_sheet_id) return null;
  const g = await lazyGoogle();
  const privateKey = String(cfg.private_key || '').replace(/\\n/g, '\n');
  const auth = new g.auth.GoogleAuth({
    credentials: { client_email: cfg.client_email, private_key: privateKey },
    scopes: [scope],
  });
  const authClient = await auth.getClient();
  return g.sheets({ version: 'v4', auth: authClient });
}

/* =========================
   Helpers
   ========================= */
// Conversão monetária: aceita "1.234,56", "1234,56", "1234.56" e números.
function parseMoney(v, def = 0) {
  if (v === null || v === undefined || v === '') return def;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  const s = String(v).trim();

  // Caso simples: apenas dígitos com ponto como decimal (ex.: 175.00, 33.5)
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);

  // Caso BR/mixto: remove separadores de milhar "." e troca "," por "."
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}

function statusToCode(x) {
  const s = String(x ?? '').trim().toLowerCase();
  if (['1','em preparo','preparo'].includes(s)) return 1;
  if (['2','saiu para entrega','entrega'].includes(s)) return 2;
  if (['3','pronto','concluido','concluído'].includes(s)) return 3;
  const n = Number(s); return Number.isFinite(n) && n>=1 && n<=3 ? n : 1;
}

function parseSheetDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  const isoTry = new Date(s);
  if (!Number.isNaN(isoTry.getTime())) return isoTry;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const dd = +m[1], MM = +m[2]-1, yyyy = +(m[3].length===2 ? ('20'+m[3]) : m[3]);
    const hh = +(m[4] ?? 0), mi = +(m[5] ?? 0), ss = +(m[6] ?? 0);
    const d = new Date(yyyy, MM, dd, hh, mi, ss);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function stripDiacritics(s) { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function demojibake(s) {
  return String(s||'')
    .replace(/P├ígina/gi, 'Pagina')
    .replace(/PÃ¡gina/gi, 'Pagina');
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

  if (!sheetName) return { finalRange: `${tabs[0]}!${a1 || 'A2:N'}`, tabTitle: tabs[0], startRow: parseA1StartRow(a1||'A2') };

  const wantedRaw = demojibake(sheetName);
  const wanted1   = stripDiacritics(wantedRaw).toLowerCase();

  const exact = tabs.find(t => t === sheetName) || tabs.find(t => t === wantedRaw);
  if (exact) return { finalRange: `${exact}!${a1 || 'A2:N'}`, tabTitle: exact, startRow: parseA1StartRow(a1||'A2') };

  const normalizedMap = new Map(tabs.map(t => [stripDiacritics(t).toLowerCase(), t]));
  const normHit = normalizedMap.get(wanted1);
  if (normHit) return { finalRange: `${normHit}!${a1 || 'A2:N'}`, tabTitle: normHit, startRow: parseA1StartRow(a1||'A2') };

  const pref = tabs.find(t => stripDiacritics(t).toLowerCase().startsWith(wanted1));
  if (pref) return { finalRange: `${pref}!${a1 || 'A2:N'}`, tabTitle: pref, startRow: parseA1StartRow(a1||'A2') };

  const fb = tabs.find(t => stripDiacritics(t).toLowerCase() === stripDiacritics(fallbackTitle).toLowerCase());
  if (fb) return { finalRange: `${fb}!${a1 || 'A2:N'}`, tabTitle: fb, startRow: parseA1StartRow(a1||'A2') };

  return { finalRange: `${tabs[0]}!${a1 || 'A2:N'}`, tabTitle: tabs[0], startRow: parseA1StartRow(a1||'A2') };
}

function buildRowHash(sheetId, row) {
  const base = JSON.stringify({
    sheetId,
    data: row.data ? new Date(row.data).toISOString() : null,
    nome: row.cliente || '',
    item: row.item || '',
    total: Number(row.total) || 0,
    qtd: Number(row.qtd) || 1,
    status: row.statusCode || '',
    tel: row.contato || '',
    obs: row.obs || '',
    end: row.endereco || '',
    opc: row.opcao || '',
    tam: row.tamanho || '',
    tp: row.tipoPagamento || ''
  });
  return crypto.createHash('sha1').update(base).digest('hex');
}

/* =========================
   Upserts: cliente e produto
   ========================= */
async function upsertClienteByNomeTelefone(client, nome, telefone, endereco) {
  const nm = (nome||'').trim(); const tf = (telefone||'').trim();

  if (tf) {
    const byTel = await client.query(`SELECT chave, nome FROM clifor WHERE telefone=$1 LIMIT 1`, [tf]).then(r=>r.rows[0]);
    if (byTel) {
      if (nm && byTel.nome && byTel.nome.trim().toLowerCase() !== nm.toLowerCase()) {
        const r = await client.query(
          `INSERT INTO clifor (ativo,nome,fisjur,tipo,telefone,endereco)
           VALUES (1,$1,'F',1,$2,NULLIF($3,'')) RETURNING chave`, [nm, tf, endereco||null]
        );
        return r.rows[0].chave;
      }
      return byTel.chave;
    }
  }
  if (nm) {
    const byName = await client.query(`SELECT chave, telefone FROM clifor WHERE lower(nome)=lower($1) LIMIT 1`, [nm]).then(r=>r.rows[0]);
    if (byName) {
      if (tf && (!byName.telefone || byName.telefone.trim()==='')) {
        await client.query(`UPDATE clifor SET telefone=$1 WHERE chave=$2`, [tf, byName.chave]);
      }
      return byName.chave;
    }
  }
  const r = await client.query(
    `INSERT INTO clifor (ativo,nome,fisjur,tipo,telefone,endereco)
     VALUES (1,$1,'F',1,NULLIF($2,''),NULLIF($3,'')) RETURNING chave`, [nm||'Cliente (WhatsApp)', tf, endereco||null]
  );
  return r.rows[0].chave;
}

async function introspectProdutos(client) {
  const rows = await client.query(`
    SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='produtos'
  `).then(r => r.rows);
  const has = n => rows.some(x => x.column_name === n);
  const nn  = n => rows.some(x => x.column_name === n && x.is_nullable === 'NO');
  const def = n => rows.some(x => x.column_name === n && x.column_default != null);
  return {
    hasAtivo: has('ativo'),
    hasCodigo: has('codigo'),
    hasValorCompra: has('valorcompra'),
    hasValorVenda: has('valorvenda'),
    codigoNNNoDef: nn('codigo') && !def('codigo'),
    vCompraNNNoDef: nn('valorcompra') && !def('valorcompra'),
  };
}

async function upsertProdutoByNome(client, nome, precoSugerido) {
  const nm = (nome && String(nome).trim()) ? String(nome).trim() : 'Item (WhatsApp)';
  const found = await client.query(`SELECT chave FROM produtos WHERE lower(nome)=lower($1) LIMIT 1`, [nm]).then(r=>r.rows[0]);
  if (found) return found.chave;

  const p = await introspectProdutos(client);
  const cols = [], vals = [];
  const push = (c,v)=>{ cols.push(c); vals.push(v); };

  if (p.hasAtivo) push('ativo', 1);
  push('nome', nm);

  if (p.hasCodigo && p.codigoNNNoDef) {
    const nextCodigo = await client.query(`SELECT COALESCE(MAX(codigo),0)+1 AS n FROM produtos`).then(r=>+r.rows[0].n||1);
    push('codigo', nextCodigo);
  }

  if (p.hasValorVenda) push('valorvenda', Number(precoSugerido)||0);
  if (p.hasValorCompra) push('valorcompra', 0); // evita NOT NULL

  const ph = vals.map((_,i)=>`$${i+1}`).join(',');
  const sql = `INSERT INTO produtos (${cols.join(',')}) VALUES (${ph}) RETURNING chave`;
  const r = await client.query(sql, vals);
  return r.rows[0].chave;
}

/* =========================
   Introspecção pedidos
   ========================= */
async function introspectPedidos(client) {
  const cols = await client.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='pedidos'
  `).then(r => new Set(r.rows.map(x => x.column_name)));
  return { hasBot: cols.has('bot'), hasHash: cols.has('source_hash') };
}

/* =========================
   Leitura do Sheets (A2:N) + resolução do range
   ========================= */
async function readRowsFromSheets(cfg) {
  // leitura exige escopo readonly
  const sheets = await getSheetsClient(cfg, 'https://www.googleapis.com/auth/spreadsheets.readonly');
  if (!sheets) return { tabTitle: 'IA', startRow: 2, rows: [] };

  const requested = (cfg.google_sheet_range || 'IA!A2:N').trim();
  const { finalRange, tabTitle, startRow } = await resolveExactRange(sheets, cfg.google_sheet_id, requested, 'IA');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: cfg.google_sheet_id,
    range: finalRange,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const values = Array.isArray(res.data.values) ? res.data.values : [];
  const out = [];

  // Percorremos TODAS as linhas retornadas, mas só coletamos as pendentes.
  for (let i = 0; i < values.length; i++) {
    const raw = values[i] || [];
    const r = raw.concat(new Array(14)).slice(0,14);
    const [
      dtRaw, nome, pedido, obs, totalStr, statusCod,
      endereco, numero, qtdStr, jaimportado, _contador,
      opcaoCardapio, tamanho, tipoPagamento
    ] = r;

    const pendente = String(jaimportado ?? '').trim() !== 'S';
    if (!pendente) continue;

    const d = parseSheetDate(dtRaw);
    if (!d) continue;

    const itemDesc =
      (pedido && String(pedido).trim()) ||
      (opcaoCardapio && String(opcaoCardapio).trim()) ||
      (tamanho && String(tamanho).trim()) ||
      '—';

    out.push({
      // índice absoluto da linha na planilha (considerando cabeçalho + startRow)
      absRow: startRow + i,
      data: d,
      cliente: (nome||'').trim(),
      item: itemDesc,
      obs: obs || '',
      total: parseMoney(totalStr, 0),
      statusCode: String(statusCod ?? '').trim(),
      contato: numero ? String(numero).trim() : '',
      qtd: Number.isFinite(Number(qtdStr)) ? Number(qtdStr) : 1,
      endereco: endereco || '',
      opcao: opcaoCardapio || '',
      tamanho: tamanho || '',
      tipoPagamento: tipoPagamento || '',
    });
  }

  return { tabTitle, startRow, rows: out };
}

/* =========================
   Inserção de 1 linha
   ========================= */
function buildHash(cfg, row){ return buildRowHash(cfg.google_sheet_id, row); }

async function insertPedidoFromRow(client, cfg, row, intros, logger) {
  const obsBase = (row.obs||'').trim();
  const obs = obsBase ? `${obsBase} | oriundo do whatsapp` : 'oriundo do whatsapp';
  const hash = buildHash(cfg, row);

  if (intros.hasHash) {
    const exists = await client.query(`SELECT 1 FROM pedidos WHERE source_hash=$1 LIMIT 1`, [hash]).then(r=>!!r.rowCount);
    if (exists) { logger(`dedup: já importada (hash=${hash})`); return { inserted:false, reason:'duplicate' }; }
  }

  const chaveclifor = await upsertClienteByNomeTelefone(client, row.cliente, row.contato, row.endereco);
  const total = Number(row.total)||0;
  const qtd   = Math.max(1, Number(row.qtd)||1);
  const vUnit = +(total / qtd).toFixed(2);
  const status= statusToCode(row.statusCode);

  const cols=['chaveclifor','obs','subtotal','desconto','acrescimo','total','status','ativo'];
  const vals=[chaveclifor,obs,total,0,0,total,status,1];
  if (intros.hasBot)  { cols.push('bot');         vals.push(true); }
  if (intros.hasHash) { cols.push('source_hash'); vals.push(hash); }
  const ph = vals.map((_,i)=>`$${i+1}`).join(',');
  const ped = await client.query(`INSERT INTO pedidos (${cols.join(',')}) VALUES (${ph}) RETURNING chave`, vals).then(r=>r.rows[0]);

  const chaveproduto = await upsertProdutoByNome(client, row.item, vUnit);
  await client.query(
    `INSERT INTO pedido_itens (chavepedido, chaveproduto, qtde, valorunit, desconto, valortotal)
     VALUES ($1,$2,$3,$4,0,$5)`,
    [ped.chave, chaveproduto, qtd, vUnit, total]
  );

  logger(`ok: pedido=${ped.chave}, item=${chaveproduto}, qtd=${qtd}, unit=${vUnit}`);
  return { inserted:true, chavepedido: ped.chave };
}

/* =========================
   IPC
   ========================= */
ipcMain.removeHandler('sheets:sync-now');
ipcMain.handle('sheets:sync-now', async () => {
  const client = await db.pool.connect();
  const out = { lidas:0, novas:0, atualizadas:0, erros:0, mensagens:[] };
  const log = (m)=>{ const line=`[sheets-sync] ${m}`; console.log(line); out.mensagens.push(line); };

  // Para marcar "S" depois do commit
  const markRowsAbs = [];
  let sheetTitle = 'IA';

  try {
    const cfg = await getDashboardConfigFromDB();
    if (!cfg || !cfg.google_sheet_id) throw new Error('apigs_config ausente ou incompleta (sheet id/credenciais).');

    const { rows, tabTitle } = await readRowsFromSheets(cfg);
    sheetTitle = tabTitle;
    out.lidas = rows.length;
    log(`pendentes=${rows.length}`);

    await client.query('BEGIN');
    const intros = await introspectPedidos(client);

    for (let i=0;i<rows.length;i++){
      const row = rows[i];
      const tag = `linha#${i+1} cliente="${row.cliente}" total=${row.total} qtd=${row.qtd} data=${row.data?.toISOString?.()||row.data}`;
      try{
        await client.query('SAVEPOINT sp_row');
        log(`${tag} -> processando`);
        const ret = await insertPedidoFromRow(client, cfg, row, intros, (m)=>log(`${tag} | ${m}`));
        if (ret.inserted) {
          out.novas++; log(`${tag} -> INSERIDA (pedido=${ret.chavepedido})`);
          // Vamos marcar essa linha na planilha
          if (Number.isInteger(row.absRow)) markRowsAbs.push(row.absRow);
        } else if (ret.reason==='duplicate') {
          out.atualizadas++; log(`${tag} -> JÁ IMPORTADA (dedup)`);
        }
        await client.query('RELEASE SAVEPOINT sp_row');
      }catch(e){
        out.erros++; await client.query('ROLLBACK TO SAVEPOINT sp_row');
        log(`${tag} -> ERRO: ${e?.message||e}${e?.detail?` | detail=${e.detail}`:''}${e?.code?` | code=${e.code}`:''}`);
      }
    }

    await client.query('COMMIT');
    log(`RESUMO: lidas=${out.lidas} novas=${out.novas} atualizadas=${out.atualizadas} erros=${out.erros}`);

    // Se houve inserções, marca "S" na coluna J dessas linhas
    if (markRowsAbs.length > 0) {
      try {
        const sheetsRW = await getSheetsClient(cfg, 'https://www.googleapis.com/auth/spreadsheets'); // leitura+escrita
        // monta updates: J<row>:J<row> = "S"
        const data = markRowsAbs.map(rn => ({
          range: `${sheetTitle}!J${rn}:J${rn}`,
          values: [['S']]
        }));
        await sheetsRW.spreadsheets.values.batchUpdate({
          spreadsheetId: cfg.google_sheet_id,
          requestBody: { valueInputOption: 'USER_ENTERED', data }
        });
        log(`Marcadas como importadas (J='S'): ${markRowsAbs.join(', ')}`);
      } catch (markErr) {
        log(`AVISO: falha ao marcar 'S' no Sheets: ${markErr?.message || markErr}`);
      }
    }

    return out;

  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    const msg = `FALHA GERAL: ${err?.message || err}`;
    log(msg);
    throw new Error(msg);
  } finally {
    client.release();
  }
});
