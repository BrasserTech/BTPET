// src/renderer/views/cadastro-clientes.js
// Form semelhante ao sistema anterior; tenta salvar via IPC e exibe toasts.

window.renderCadastroClientes = function () {
  const html = `
  <div class="card" style="padding:16px">
    <h3>Cadastro de Clientes</h3>

    <form id="form-cli" class="form" style="grid-template-columns: 1fr 1fr">
      <div class="full">
        <label class="label">Nome*</label>
        <input id="cli-nome" class="input" placeholder="Cliente Exemplo" />
      </div>

      <div>
        <label class="label">Fis./Jur.*</label>
        <select id="cli-fj" class="select">
          <option value="F">Física</option>
          <option value="J">Jurídica</option>
        </select>
      </div>

      <div>
        <label class="label">Tipo*</label>
        <select id="cli-tipo" class="select">
          <option value="1">Cliente</option>
          <option value="2">Fornecedor</option>
          <option value="3">Ambos</option>
        </select>
      </div>

      <div class="full">
        <label class="label">Documento (CPF/CNPJ)</label>
        <input id="cli-doc" class="input" placeholder="00000000000 ou 00000000000000" />
      </div>

      <div class="full">
        <label class="label">Empresa (referência) — opcional</label>
        <div style="display:grid; grid-template-columns:1fr auto; gap:8px">
          <input id="cli-emp" class="input" placeholder="F8 para pesquisar empresa" />
          <button type="button" id="btn-emp-lkp-cli" class="button outline" title="Pesquisar">🔎</button>
        </div>
      </div>

      <div>
        <label class="label">Email</label>
        <input id="cli-email" class="input" placeholder="contato@email.com" />
      </div>

      <div>
        <label class="label">Telefone</label>
        <input id="cli-fone" class="input" placeholder="(00) 00000-0000" />
      </div>

      <div class="full">
        <label class="label">Endereço</label>
        <input id="cli-ender" class="input" placeholder="Rua, nº, bairro, cidade" />
      </div>

      <div class="form-actions full">
        <button type="submit" class="button" id="btn-save-cli">Salvar</button>
        <button type="reset" class="button outline" id="btn-clear-cli">Limpar</button>
      </div>
    </form>
  </div>
  `;

  function toast(msg, err = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  return {
    title: 'Cadastro de Clientes',
    html,
    afterRender() {
      const { ipcRenderer } = require('electron');
      const $ = id => document.getElementById(id);

      async function tryIPC(channel, payload, aliases = []) {
        try {
          return await ipcRenderer.invoke(channel, payload);
        } catch (e) {
          const msg = String(e?.message || e);
          const noHandler = msg.includes('No handler registered') || msg.includes('has no listeners') || msg.includes('not a function');
          if (noHandler && aliases?.length) {
            for (const alt of aliases) {
              try { return await ipcRenderer.invoke(alt, payload); } catch {}
            }
          }
          throw e;
        }
      }

      // Lookup (placeholder)
      $('btn-emp-lkp-cli').onclick = () => toast('Lookup de empresas não implementado nesta amostra.');

      $('form-cli').addEventListener('submit', async (ev) => {
        ev.preventDefault();

        const nome  = $('cli-nome').value.trim();
        const fisjur = $('cli-fj').value;
        const tipo   = Number($('cli-tipo').value);
        const cpf    = $('cli-doc').value.trim() || null;
        const email  = $('cli-email').value.trim() || null;
        const telefone = $('cli-fone').value.trim() || null;
        const endereco = $('cli-ender').value.trim() || null;

        if (!nome) { toast('Informe o nome do cliente.', true); return; }

        const payload = { nome, fisjur, tipo, cpf, email, telefone, endereco };

        try {
          await tryIPC(
            'clientes:save',
            payload,
            ['clientes:create','db:clientes:salvar','clientes:upsert','clientes:insert','clientes:add']
          );
          toast('Cliente salvo com sucesso.');
          $('form-cli').reset();
        } catch (e) {
          toast('Falha ao salvar: ' + (e?.message || e), true);
        }
      });
    }
  };
};
