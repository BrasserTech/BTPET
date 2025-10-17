const { Pool } = require('pg');
require('dotenv').config();

function get(k, def) {
  const vDB = process.env[`DB_${k}`];
  if (vDB !== undefined) return vDB;
  if (k === 'NAME') return process.env.PG_DATABASE ?? def;
  return process.env[`PG_${k}`] ?? def;
}

const pool = new Pool({
  host: get('HOST', '127.0.0.1'),
  port: Number(get('PORT', 5432)),
  database: get('NAME', 'postgres'),
  user: get('USER', 'postgres'),
  password: get('PASSWORD', 'BT_2025$'),
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT ?? 30000),
});

async function test() {
  const r = await pool.query('select current_database() db, now() ts');
  return r.rows[0];
}

module.exports = { pool, test };
