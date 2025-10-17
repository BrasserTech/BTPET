// src/main/ipc/cardapio.js
const { ipcMain } = require('electron');
const db = require('./db');

let google = null;
async function lazyGoogle(){ if (!google) ({ google } = require('googleapis')); return google; }

async function getConfig(){
  const r = await db.query(`SELECT * FROM apigs_config ORDER BY chave DESC LIMIT 1`);
  return r.rows?.[0] || null;
}

async function getSheetsClientRW(cfg){
  if (!cfg || !cfg.google_sheet_id) return null;
  const g = await lazyGoogle();
  const privateKey = String(cfg.private_key || '').replace(/\\n/g, '\n');
  const auth = new g.auth.GoogleAuth({
    credentials: { client_email: cfg.client_email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return g.sheets({ version: 'v4', auth: authClient });
}

const DEFAULT_RANGE = 'pagCardapio!A2:E';

function stripDia(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
const DIAS = [
  { idx:1, label:'segunda-feira' },
  { idx:2, label:'terça-feira'   },
  { idx:3, label:'quarta-feira'  },
  { idx:4, label:'quinta-feira'  },
  { idx:5, label:'sexta-feira'   },
  { idx:6, label:'sabado'        },
  { idx:7, label:'domingo'       },
];
const DIA_BY_LABEL = new Map(DIAS.map(d => [stripDia(d.label), d.idx]));
const LABEL_BY_IDX = new Map(DIAS.map(d => [d.idx, d.label]));

function parseMoney(v, def=null){
  if (v===null || v===undefined || v==='') return def;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/^R\$\s*/,'');
  const n = Number(s.replace(/\./g,'').replace(',','.'));
  return Number.isFinite(n) ? n : def;
}

/* ---------------- Sheet -> modelo ---------------- */
async function readCardapioFromSheet(sheets, cfg){
  const range = cfg.google_sheet_range_cardapio || DEFAULT_RANGE;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: cfg.google_sheet_id,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = Array.isArray(res.data.values) ? res.data.values : [];
  const out = [];
  for (const row of values){
    const [dia, almoco, janta, pAlm, pJan] = (row||[]).concat(['','','','','']).slice(0,5);
    if (!dia) continue;
    const idx = DIA_BY_LABEL.get(stripDia(dia));
    if (!idx) continue;
    out.push({
      dia_semana: idx,
      almoco: almoco || '',
      janta:  janta  || '',
      preco_almoco: parseMoney(pAlm),
      preco_janta:  parseMoney(pJan),
    });
  }
  return out;
}

/* --------------- modelo -> sheet ------------------ */
function toSheetMatrix(rowsFromDb){
  const map = new Map(rowsFromDb.map(r => [Number(r.dia_semana), r]));
  const values = [];
  for (const d of DIAS){
    const r = map.get(d.idx) || {};
    values.push([
      d.label,
      r.almoco || '',
      r.janta  || '',
      r.preco_almoco!=null ? Number(r.preco_almoco) : '',
      r.preco_janta !=null ? Number(r.preco_janta)  : '',
    ]);
  }
  return values;
}

/* ---------------- Banco (upsert 7 linhas) --------- */
async function upsertSemana(client, rows){
  for (const r of rows){
    await client.query(`
      INSERT INTO cardapio_semana (dia_semana, almoco, janta, preco_almoco, preco_janta, updated_at)
      VALUES ($1,$2,$3,$4,$5, now())
      ON CONFLICT (dia_semana)
      DO UPDATE SET
        almoco = EXCLUDED.almoco,
        janta  = EXCLUDED.janta,
        preco_almoco = EXCLUDED.preco_almoco,
        preco_janta  = EXCLUDED.preco_janta,
        updated_at   = now()
    `, [
      Number(r.dia_semana),
      r.almoco || null,
      r.janta  || null,
      r.preco_almoco==null ? null : Number(r.preco_almoco),
      r.preco_janta ==null ? null : Number(r.preco_janta),
    ]);
  }
}

/* ---------------- IPCs ---------------------------- */
function safeHandle(ch, fn){ try{ ipcMain.removeHandler(ch); }catch{} ipcMain.handle(ch, fn); }

safeHandle('cardapio:list', async () => {
  const r = await db.query(`
    SELECT dia_semana, almoco, janta, preco_almoco, preco_janta
      FROM cardapio_semana
     ORDER BY dia_semana
  `);
  const map = new Map(r.rows.map(x => [Number(x.dia_semana), x]));
  const out = [];
  for (const d of DIAS){
    out.push({
      dia_semana: d.idx,
      label: LABEL_BY_IDX.get(d.idx),
      almoco: (map.get(d.idx)?.almoco) || '',
      janta:  (map.get(d.idx)?.janta)  || '',
      preco_almoco: map.get(d.idx)?.preco_almoco ?? null,
      preco_janta:  map.get(d.idx)?.preco_janta  ?? null,
    });
  }
  return out;
});

safeHandle('cardapio:sync-from-sheet', async () => {
  const cfg = await getConfig();
  if (!cfg || !cfg.google_sheet_id) throw new Error('Config do Google Sheets ausente.');

  const sheets = await getSheetsClientRW(cfg);
  const rows = await readCardapioFromSheet(sheets, cfg);

  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    await upsertSemana(client, rows);
    await client.query('COMMIT');
    return { ok:true, rows: rows.length };
  }catch(e){
    await client.query('ROLLBACK');
    throw e;
  }finally{
    client.release();
  }
});

safeHandle('cardapio:save', async (_e, payload = {}) => {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rows.length !== 7) throw new Error('Devem ser informadas 7 linhas (segunda..domingo).');

  // Banco
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    await upsertSemana(client, rows);
    await client.query('COMMIT');
  }catch(e){
    await client.query('ROLLBACK');
    throw e;
  }finally{
    client.release();
  }

  // Planilha
  const cfg = await getConfig();
  if (!cfg || !cfg.google_sheet_id) return { ok:true, note:'Sem configuração da planilha; apenas banco atualizado.' };
  const sheets = await getSheetsClientRW(cfg);
  const matrix = toSheetMatrix(rows);
  const range  = cfg.google_sheet_range_cardapio || DEFAULT_RANGE;

  await sheets.spreadsheets.values.update({
    spreadsheetId: cfg.google_sheet_id,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: matrix }
  });

  return { ok:true, written: matrix.length };
});
