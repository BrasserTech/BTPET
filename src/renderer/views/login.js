// src/renderer/views/login.js
const AUTH_KEY = 'AUTH_TOKEN';

window.renderLogin = function () {
  return {
    title: 'Entrar',
    html: `
      <div class="card" style="max-width:480px;margin:40px auto">
        <h2 style="margin:0 0 12px">Acessar</h2>
        <div class="muted" style="margin-bottom:12px">Informe seu e-mail e senha para entrar.</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <input id="lg-email" class="input" type="email" placeholder="E-mail"/>
          <input id="lg-senha" class="input" type="password" placeholder="Senha"/>
          <button id="lg-btn" class="button">Entrar</button>
          <div class="muted">Não tem conta? <a href="#/cadastro">Cadastre-se</a></div>
          <div id="lg-msg" class="muted"></div>
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
        const el = $('lg-msg');
        el.textContent = t || '';
        el.style.color = isErr ? '#b91c1c' : '#64748b';
      }

      $('lg-btn').onclick = async () => {
        try {
          setMsg('Autenticando...');
          const email = $('lg-email').value.trim();
          const senha = $('lg-senha').value;
          if (!email || !senha) return setMsg('Informe e-mail e senha.', true);

          const out = await ipc.invoke('auth:signin', {
            email, senha,
            user_agent: navigator.userAgent || null
          });
          if (!out?.ok) return setMsg(out?.error || 'Falha ao entrar.', true);

          localStorage.setItem(AUTH_KEY, out.token);
          setMsg('Ok! Redirecionando...');
          location.hash = '#/';
        } catch (err) {
          setMsg(err?.message || String(err), true);
        }
      };
    }
  };
};

window.views = window.views || {};
window.views['login'] = window.renderLogin;
