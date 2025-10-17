// src/renderer/views/perfil.js
// Busca sempre o usuário com ativo=3 (usuário logado).
window.renderPerfil = function () {
  return {
    title: 'Perfil',
    html: `
      <div class="card" style="max-width:900px;margin:40px auto;padding:20px">
        <h2 id="pf-title">Meu perfil</h2>
        <p class="muted">Gerencie suas informações e segurança.</p>
        <div id="pf-msg" class="muted" style="margin-bottom:10px"></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
          <div>
            <label>Nome</label>
            <input id="pf-nome" class="input" placeholder="Seu nome"/>
          </div>
          <div>
            <label>E-mail (somente leitura)</label>
            <input id="pf-email" class="input" readonly/>
          </div>

          <div>
            <label>CPF ou CNPJ</label>
            <input id="pf-cpf" class="input" readonly/>
          </div>
          <div>
            <label>Perfil</label>
            <input id="pf-perfil" class="input" readonly/>
          </div>

          <div>
            <label>Nova senha (opcional)</label>
            <input id="pf-senha1" type="password" class="input" placeholder="Deixe em branco para manter"/>
          </div>
          <div>
            <label>Confirmar nova senha</label>
            <input id="pf-senha2" type="password" class="input" placeholder="Repita a senha"/>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
          <button id="pf-salvar" class="button">Salvar alterações</button>
          <button id="pf-sair" class="button secondary">Sair da conta</button>
        </div>
      </div>
    `,

    afterRender() {
      const ipc = window.electron?.ipcRenderer || require('electron').ipcRenderer;
      const $ = (id) => document.getElementById(id);

      function setMsg(t, isErr = false) {
        const el = $('pf-msg');
        el.textContent = t || '';
        el.style.color = isErr ? '#b91c1c' : '#64748b';
      }

      async function carregar() {
        try {
          const res = await ipc.invoke('perfil:getActive');
          if (!res?.ok) {
            // Evitar mensagem de "não autenticado": mostra aviso discreto.
            setMsg('Não foi possível carregar seu perfil. Verifique sua conexão ou tente novamente.', true);
            return;
          }
          const u = res.user;
          $('pf-email').value  = u.email || '';
          $('pf-nome').value   = u.nome || '';
          $('pf-cpf').value    = u.cpf_cnpj || '';
          $('pf-perfil').value = u.perfil || 'operador';

          const t = $('pf-title');
          if (t) t.textContent = `Meu perfil – ${u.nome || ''}`;
          setMsg(''); // limpa qualquer aviso
        } catch (err) {
          console.error('[perfil] load error:', err);
          setMsg('Erro ao carregar o perfil.', true);
        }
      }

      $('pf-salvar').onclick = async () => {
        try {
          const nome = $('pf-nome').value.trim();
          const s1   = $('pf-senha1').value;
          const s2   = $('pf-senha2').value;

          if (s1 && s1 !== s2) {
            setMsg('As senhas não coincidem.', true);
            return;
          }

          const res = await ipc.invoke('perfil:updateActive', {
            nome: nome || undefined,
            novaSenha: s1 || undefined
          });

          if (!res?.ok) {
            setMsg(res?.error || 'Falha ao salvar.', true);
            return;
          }
          setMsg(res.msg || 'Alterações salvas com sucesso.');
          // limpa campos de senha após salvar
          $('pf-senha1').value = '';
          $('pf-senha2').value = '';
          // recarrega título caso o nome tenha mudado
          carregar();
        } catch (err) {
          console.error('[perfil] save error:', err);
          setMsg('Erro ao salvar alterações.', true);
        }
      };

      $('pf-sair').onclick = async () => {
        // Mantemos o comportamento atual do app para "sair":
        // apenas redireciona para o login e limpa o token local, se existir.
        try { localStorage.removeItem('AUTH_TOKEN'); } catch {}
        location.hash = '#/login';
      };

      carregar();
    }
  };
};

window.views = window.views || {};
window.views['perfil'] = window.renderPerfil;
