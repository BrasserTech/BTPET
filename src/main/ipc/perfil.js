// src/main/ipc/perfil.js
const { ipcMain } = require('electron');
const db = require('./db');

/* =========================================================
   Como identificado pelo cliente:
   - Sempre haverá um usuário logado.
   - Usuário logado = registro com ativo = 3.
   ========================================================= */

ipcMain.handle('perfil:getActive', async () => {
  try {
    const { rows } = await db.query(
      `SELECT chave, nome, email, cpf_cnpj, perfil
         FROM public.usuarios
        WHERE ativo = 3
        ORDER BY datahoraalt DESC
        LIMIT 1`,
      []
    );
    if (!rows.length) throw new Error('Nenhum usuário ativo (ativo=3) encontrado.');
    return { ok: true, user: rows[0] };
  } catch (err) {
    console.error('[perfil:getActive] erro:', err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('perfil:updateActive', async (_e, payload = {}) => {
  try {
    const { nome, novaSenha } = payload;

    const fields = [];
    const params = [];
    let idx = 1;

    if (nome) {
      fields.push(`nome = $${idx++}`);
      params.push(nome);
    }
    if (novaSenha) {
      fields.push(`senha = $${idx++}`);
      params.push(String(novaSenha));
    }

    if (!fields.length) throw new Error('Nada para atualizar.');

    await db.query(
      `UPDATE public.usuarios
          SET ${fields.join(', ')}, datahoraalt = NOW()
        WHERE ativo = 3`,
      params
    );

    return { ok: true, msg: 'Perfil atualizado com sucesso.' };
  } catch (err) {
    console.error('[perfil:updateActive] erro:', err);
    return { ok: false, error: err.message };
  }
});
