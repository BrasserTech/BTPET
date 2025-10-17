// src/renderer/views/cadastro.js
const AUTH_KEY = 'AUTH_TOKEN';

window.renderCadastro = function () {
  return {
    title: 'Cadastro',
    html: `
      <div class="card" style="max-width:520px;margin:40px auto">
        <h2 style="margin:0 0 12px">Criar conta</h2>
        <div class="muted" style="margin-bottom:12px">Preencha os dados abaixo.</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <input id="cd-nome" class="input" placeholder="Nome completo"/>
          <input id="cd-email" class="input" type="email" placeholder="E-mail"/>
          <input id="cd-senha" class="input" type="password" placeholder="Senha (mín. 6)"/>
          <button id="cd-btn" class="button">Cadastrar</button>
          <div class="muted">Já tem conta? <a href="#/login">Entrar</a></div>
          <div id="cd-msg" class="muted"></div>
        </div>
      </div>
    `,
    afterRender() {
      const ipc = window.electron?.ipcRenderer || require('electron').ipcRenderer;
      const $ = (id) => document.getElementById(id);

      // se já logado, volta ao dashboard
      if (localStorage.getItem(AUTH_KEY)) {
        location.hash = '#/';
        return;
      }

      function setMsg(t, isErr = false) {
        const el = $('cd-msg');
        el.textContent = t || '';
        el.style.color = isErr ? '#b91c1c' : '#64748b';
      }

      $('cd-btn').onclick = async () => {
        try {
          setMsg('Enviando...');
          const nome  = $('cd-nome').value.trim();
          const email = $('cd-email').value.trim();
          const senha = $('cd-senha').value;

          if (!nome || !email || !senha) return setMsg('Preencha todos os campos.', true);
          if (senha.length < 6) return setMsg('A senha deve ter ao menos 6 caracteres.', true);

          const out = await ipc.invoke('auth:signup', {
            nome, email, senha,
            user_agent: navigator.userAgent || null
          });
          if (!out?.ok) return setMsg(out?.error || 'Falha no cadastro.', true);

          localStorage.setItem(AUTH_KEY, out.token);
          setMsg('Conta criada! Redirecionando...');
          location.hash = '#/';
        } catch (err) {
          setMsg(err?.message || String(err), true);
        }
      };
    }
  };
};

window.views = window.views || {};
window.views['cadastro'] = window.renderCadastro;
