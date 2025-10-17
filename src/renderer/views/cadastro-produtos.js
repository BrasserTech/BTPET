// src/renderer/views/cadastro-produtos.js
window.renderCadastroProdutos = function () {
  return {
    title: 'Cadastro de Produtos',
    html: `
      <div class="card">
        <form class="form" id="form-prod" autocomplete="off">
          <div id="p-status" style="display:none;margin-bottom:10px;padding:8px 10px;border-radius:8px;font-size:14px"></div>

          <div class="form-fields" style="grid-template-columns:1fr 1fr">
            <div style="grid-column:1 / -1">
              <label class="label">Nome*</label>
              <input class="input" id="p-nome" required maxlength="100" placeholder="Ex.: Camiseta Algodão" />
            </div>

            <div>
              <label class="label">Valor de compra* (R$)</label>
              <input class="input" id="p-vcompra" type="number" step="0.01" min="0" value="0" required />
            </div>

            <div>
              <label class="label">Valor de venda (R$)</label>
              <input class="input" id="p-vvenda" type="number" step="0.01" min="0" placeholder="Em branco = igual à compra" />
            </div>

            <div>
              <label class="label">Empresa (referência) — opcional</label>
              <div style="display:flex; gap:6px">
                <input class="input" id="p-emp" placeholder="F8 para pesquisar empresa" data-lookup="empresas" data-target-id="p-emp-id" />
                <button type="button" class="button outline" id="p-emp-lupa" title="Pesquisar (F8)">🔎</button>
              </div>
              <input type="hidden" id="p-emp-id" />
            </div>

            <div>
              <label class="label">Validade (opcional)</label>
              <input class="input" id="p-valid" type="date" />
            </div>

            <div style="grid-column:1 / -1">
              <label class="label">Observações</label>
              <textarea class="textarea" id="p-obs" rows="3" maxlength="300" placeholder="Detalhes do produto..."></textarea>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="button" id="p-salvar">Salvar</button>
            <button type="reset" class="button outline" id="p-reset">Limpar</button>
          </div>
        </form>
      </div>
    `,
    afterRender() {
      const { ipcRenderer } = require('electron');
      const $ = (id) => document.getElementById(id);

      // ---- feedback visual (fallback ao toast) ----
      const statusBox = $('p-status');
      function showStatus(msg, isError = false) {
        if (typeof toast === 'function') {
          toast(msg, !!isError);
          return;
        }
        statusBox.style.display = 'block';
        statusBox.style.background = isError ? '#fee2e2' : '#ecfdf5';
        statusBox.style.color = isError ? '#991b1b' : '#065f46';
        statusBox.style.border = isError ? '1px solid #fecaca' : '1px solid #a7f3d0';
        statusBox.textContent = msg;
        clearTimeout(showStatus._t);
        showStatus._t = setTimeout(() => { statusBox.style.display = 'none'; }, 3000);
      }

      let isSaving = false;
      const btnSalvar = $('p-salvar');

      function setSaving(state) {
        isSaving = state;
        btnSalvar.disabled = state;
        btnSalvar.textContent = state ? 'Salvando…' : 'Salvar';
      }

      function resetAll() {
        $('form-prod').reset();
        $('p-emp-id').value = '';
        $('p-emp').value = '';
        $('p-vcompra').value = '0';
        $('p-nome').focus();
      }

      // Lookup por botão
      $('p-emp-lupa').addEventListener('click', () => {
        if (typeof openLookup !== 'function') return showStatus('Lookup não carregado.', true);
        openLookup('empresas', ({ id, label }) => {
          $('p-emp-id').value = String(id);
          $('p-emp').value = label;
        });
      });

      // Lookup por F8
      window.addEventListener('keydown', (ev) => {
        if (ev.key === 'F8') {
          ev.preventDefault();
          $('p-emp-lupa').click();
        }
      });

      $('p-reset').addEventListener('click', (e) => {
        e.preventDefault();
        resetAll();
        showStatus('Formulário limpo.');
      });

      $('form-prod').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSaving) return;

        try {
          const nome = ($('p-nome').value || '').trim();
          if (!nome) {
            showStatus('Informe o nome do produto.', true);
            $('p-nome').focus();
            return;
          }

          const valorcompra = Number($('p-vcompra').value || '0');
          const vvRaw = $('p-vvenda').value;
          const valorvenda = vvRaw === '' ? null : Number(vvRaw);

          const payload = {
            nome,
            valorcompra,
            valorvenda, // se null, trigger no BD define = valorcompra
            chaveemp: Number($('p-emp-id').value || '') || null,
            validade: $('p-valid').value || null,
            obs: ($('p-obs').value || '').trim() || null,
            categoria: 1
          };

          setSaving(true);
          await ipcRenderer.invoke('produtos:criar', payload);

          showStatus('Produto salvo!');
          resetAll();
        } catch (err) {
          showStatus('Erro ao salvar: ' + (err && err.message ? err.message : String(err)), true);
        } finally {
          setSaving(false);
        }
      });

      $('p-nome').focus();
    }
  };
};
