// src/renderer/views/cadastro-pedidos.js
// View: Cadastro de Pedidos com autocomplete de CLIENTE e PRODUTO (código ou nome).
window.renderCadastroPedidos = function () {
  return {
    title: 'Cadastro de Pedidos',
    html: `
      <style>
        .sop-shell{border:1px solid #e5eaf0;border-radius:14px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.06);padding:14px}
        .sop-wrap{display:flex;flex-direction:column;gap:16px}
        .sop-main{display:grid;gap:16px;grid-template-columns:minmax(620px,1.2fr) minmax(420px,.8fr)}
        @media (max-width:1100px){ .sop-main{grid-template-columns:1fr} }

        .card{border:1px solid #e5eaf0;border-radius:12px;background:#fbfdff;box-shadow:0 6px 18px rgba(15,23,42,.05);overflow:hidden}
        .card-head{padding:10px 14px;border-bottom:1px solid #e5eaf0;font-size:15px;color:#0f172a}
        .card-body{padding:14px}

        .label{font-weight:600;color:#0f172a}
        .input,.textarea,.button,.button.outline,.select{width:100%}
        .input.numeric{text-align:right}
        .textarea{resize:vertical;min-height:92px}

        .top-grid{
          display:grid;gap:14px;align-items:end;
          grid-template-columns:minmax(240px,1fr) minmax(180px,0.6fr) minmax(180px,0.6fr) minmax(180px,0.6fr)
        }
        @media (max-width:1100px){ .top-grid{grid-template-columns:1fr} }

        .prod-row{
          display:grid;gap:10px;align-items:end;
          grid-template-columns:1.2fr 1fr 140px 160px auto;
          padding:10px;border:1px solid #e5eaf0;border-radius:12px;background:#fff
        }
        .prod-row .field{display:flex;flex-direction:column;gap:6px}
        .prod-row .field .label{font-size:12px;color:#64748b}
        .prod-row .btns{display:flex;gap:8px;align-items:center}
        @media (max-width:880px){ .prod-row{grid-template-columns:1fr 1fr} .prod-row .btns{grid-column:1 / -1} }

        .divider{height:1px;background:#e5eaf0;margin:12px 0}

        .items-card{border:1px solid #e5eaf0;border-radius:12px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.06);overflow:hidden}
        .items-card h4{margin:0;padding:12px 14px;border-bottom:1px solid #e5eaf0;font-size:15px;color:#0f172a}
        .tbl-wrap{padding:6px 10px 12px 10px}
        .tbl-grid{width:100%;border-collapse:separate;border-spacing:0}
        .tbl-grid thead th{
          background:#f8fafc;color:#0f172a;font-weight:600;font-size:13px;
          border-bottom:1px solid #e5eaf0;padding:12px 10px;position:sticky;top:0;z-index:1
        }
        .tbl-grid tbody td{border-bottom:1px solid #eef2f7;padding:12px 10px;color:#0f172a}
        .tbl-grid tbody tr:last-child td{border-bottom:none}
        .tbl-grid tbody tr:hover{background:#f9fbff}
        .txt-right{text-align:right}
        .empty-row{text-align:center;color:#64748b;background:#fff}
        .btn-ghost{background:#fff;border:1px solid #e5eaf0;color:#334155;padding:6px 10px;border-radius:8px;cursor:pointer}
        .btn-ghost:hover{background:#f8fafc}
        .actions{display:flex;gap:8px;align-items:center;justify-content:flex-start}

        .client-search-wrapper,.product-search-wrapper{position:relative}
        #ped-cli-suggestions-container,#ped-prod-suggestions-container{
          position:absolute;width:100%;border:1px solid #e5eaf0;border-radius:8px;background:#fff;
          box-shadow:0 8px 22px rgba(15,23,42,.1);z-index:1000;max-height:250px;overflow-y:auto;margin-top:4px
        }
        .suggestion-item{padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9}
        .suggestion-item:last-child{border-bottom:none}
        .suggestion-item:hover{background:#f8fafc}
        .suggestion-item small{color:#64748b;margin-left:8px}
      </style>

      <div class="sop-shell">
        <div class="sop-wrap">
          <form id="form-ped" autocomplete="off">
            <div class="sop-main">
              <div class="card">
                <div class="card-head">Dados gerais do pedido</div>
                <div class="card-body">
                  <div class="top-grid">
                    <div class="client-search-wrapper">
                      <label class="label">Cliente*</label>
                      <input class="input" id="ped-cli-search" placeholder="Digite código, nome ou telefone..." />
                      <div id="ped-cli-suggestions-container" class="hidden"></div>
                      <input class="input" id="ped-cli-nome" style="margin-top:6px;background:#f8fafc" placeholder="Cliente não selecionado" disabled />
                    </div>

                    <div>
                      <label class="label">Status*</label>
                      <select class="select" id="ped-status">
                        <option value="1">Em preparo</option>
                        <option value="2">Rota de entrega</option>
                        <option value="3">Concluído</option>
                      </select>
                    </div>

                    <div>
                      <label class="label">Forma de pagamento</label>
                      <select class="select" id="ped-pag">
                        <option value="">—</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Pix">Pix</option>
                        <option value="Cartão crédito">Cartão crédito</option>
                        <option value="Cartão débito">Cartão débito</option>
                        <option value="Vale refeição">Vale refeição</option>
                        <option value="Transferência">Transferência</option>
                        <option value="Boleto">Boleto</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div>
                      <label class="label">Total (R$)</label>
                      <input class="input numeric" id="ped-total" type="number" step="0.01" min="0" value="0" disabled />
                    </div>

                    <div style="grid-column:1 / -1">
                      <label class="label">Observações</label>
                      <textarea class="textarea" id="ped-obs" rows="3" maxlength="300" placeholder="Detalhes..."></textarea>
                    </div>
                  </div>

                  <div style="margin-top:10px">
                    <label class="label">Itens</label>
                    <div class="prod-row">
                      <div class="field product-search-wrapper">
                        <label class="label">Produto (código ou nome)*</label>
                        <input class="input" id="ped-prod-cod" placeholder="Ex.: 1 ou 'Coca-Cola lata'"/>
                        <div id="ped-prod-suggestions-container" class="hidden"></div>
                      </div>
                      <div class="field">
                        <label class="label">Descrição</label>
                        <input class="input" id="ped-prod-desc" placeholder="-" disabled/>
                      </div>
                      <div class="field"><label class="label">Quantidade</label><input class="input numeric" id="ped-qtde" type="number" step="0.001" min="0.001" value="1" /></div>
                      <div class="field"><label class="label">Valor unitário (R$)</label><input class="input numeric" id="ped-vu" type="number" step="0.01" min="0" value="0" /></div>
                      <div class="btns"><button type="button" class="button" id="ped-add-item" title="Adicionar (Enter)">Adicionar</button></div>
                    </div>
                  </div>

                  <div class="divider"></div>
                  <div class="actions">
                    <button type="submit" class="button" id="ped-submit">Salvar Pedido</button>
                    <button type="reset" class="button outline" id="ped-reset">Limpar</button>
                  </div>
                </div>
              </div>

              <div class="items-card">
                <h4>Itens do Pedido</h4>
                <div class="tbl-wrap">
                  <table class="tbl-grid">
                    <thead>
                      <tr>
                        <th style="width:120px">Cód. Prod.</th>
                        <th>Produto</th>
                        <th class="txt-right" style="width:120px">Qtd</th>
                        <th class="txt-right" style="width:140px">Vlr Unit</th>
                        <th class="txt-right" style="width:140px">Total</th>
                        <th style="width:110px">Ação</th>
                      </tr>
                    </thead>
                    <tbody id="ped-itens"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `,
    afterRender() {
      const { ipcRenderer } = require('electron');
      const $  = (id) => document.getElementById(id);
      const f2 = (n) => Number(n||0).toFixed(2);
      const f3 = (n) => Number(n||0).toFixed(3);

      // estilos auxiliares
      const style = document.createElement('style');
      style.textContent = `
        #ped-cli-suggestions-container.hidden,#ped-prod-suggestions-container.hidden{display:none}
        .suggestion-item.highlighted{background-color:#eef2ff}
        #ped-cli-nome{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
      `;
      document.head.appendChild(style);

      function toast(msg, err=false){
        const t = document.createElement('div');
        t.className = 'toast' + (err ? ' err' : '');
        t.textContent = msg;
        Object.assign(t.style, {
          position:'fixed', right:'16px', bottom:'16px', background: err?'#fee2e2':'#ecfeff',
          color:'#0f172a', border:'1px solid #e5eaf0', borderRadius:'10px',
          padding:'10px 14px', boxShadow:'0 8px 22px rgba(15,23,42,.08)', zIndex:9999
        });
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2200);
      }

      let cliente = null;
      const itens = [];
      let cliSearchTimeout = null;
      let prodSearchTimeout = null;
      let cliSuggestions = [];
      let prodSuggestions = [];
      let cliHighlighted = -1;
      let prodHighlighted = -1;
      let produtoSelecionado = null;

      function totalPedido(){
        return itens.reduce((a,i) => a + (Number(i.qtde||0) * Number(i.valorunit||0)), 0);
      }

      function renderGrid(){
        const body = $('ped-itens');
        if (!itens.length){
          body.innerHTML = '<tr><td class="empty-row" colspan="6">Itens adicionados serão exibidos nessa tabela</td></tr>';
          $('ped-total').value = f2(0);
          return;
        }
        body.innerHTML = itens.map((it,idx) => {
          const vt = (Number(it.qtde)||0) * (Number(it.valorunit)||0);
          return `
            <tr>
              <td>${it.codigo ?? '-'}</td>
              <td>${it.nome ?? '(produto)'}</td>
              <td class="txt-right">${f3(it.qtde)}</td>
              <td class="txt-right">${f2(it.valorunit)}</td>
              <td class="txt-right">${f2(vt)}</td>
              <td><button type="button" class="btn-ghost" data-rm="${idx}">Remover</button></td>
            </tr>
          `;
        }).join('');
        $('ped-total').value = f2(totalPedido());
        body.querySelectorAll('[data-rm]').forEach(btn => {
          btn.onclick = () => {
            const ix = Number(btn.getAttribute('data-rm'));
            if (ix >= 0) itens.splice(ix,1);
            renderGrid();
          };
        });
      }

      function updateHighlight(selector, highlightedIndex){
        const items = document.querySelectorAll(`${selector} .suggestion-item`);
        items.forEach((item, index) => {
          if (index === highlightedIndex) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
          } else {
            item.classList.remove('highlighted');
          }
        });
      }

      function hideSuggestions(id){
        const c = $(id);
        c.innerHTML = '';
        c.classList.add('hidden');
      }

      // ===== CLIENTE =====
      function selectClient(selected){
        if (!selected) return;
        cliente = { chave:selected.chave, codigo:selected.codigo, nome:selected.nome, telefone:selected.telefone };
        $('ped-cli-search').value = selected.nome;
        const tel = selected.telefone || '-';
        $('ped-cli-nome').value = `Cód: ${selected.codigo} | Tel: ${tel} | Nome: ${selected.nome}`;
        hideSuggestions('ped-cli-suggestions-container');
        cliSuggestions = [];
        cliHighlighted = -1;
        $('ped-prod-cod').focus();
      }

      $('ped-cli-search').addEventListener('input', (e) => {
        cliHighlighted = -1;
        const searchTerm = e.target.value.trim();
        clearTimeout(cliSearchTimeout);

        if (searchTerm.length < 3) {
          hideSuggestions('ped-cli-suggestions-container');
          if (!searchTerm) {
            cliente = null;
            $('ped-cli-nome').value = 'Cliente não selecionado';
          }
          return;
        }

        cliSearchTimeout = setTimeout(async () => {
          try {
            const results = await ipcRenderer.invoke('clientes:search-for-autocomplete', searchTerm);
            cliSuggestions = results;
            const container = $('ped-cli-suggestions-container');
            container.innerHTML = '';

            if (!results.length) {
              container.innerHTML = '<div class="suggestion-item" style="color:#94a3b8; cursor:default;">Nenhum cliente encontrado</div>';
            } else {
              results.forEach((cli, index) => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `<b>${cli.nome}</b> <small>(${cli.codigo}) - ${cli.telefone || 'sem fone'}</small>`;
                item.dataset.index = String(index);
                container.appendChild(item);
              });
            }
            container.classList.remove('hidden');
          } catch(err) {
            toast('Erro ao buscar clientes: ' + err.message, true);
          }
        }, 300);
      });

      $('ped-cli-suggestions-container').addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;
        const idx = Number(item.dataset.index);
        if (Number.isInteger(idx)) selectClient(cliSuggestions[idx]);
      });

      $('ped-cli-search').addEventListener('keydown', (e) => {
        const container = $('ped-cli-suggestions-container');
        if (container.classList.contains('hidden') || cliSuggestions.length === 0) return;
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            cliHighlighted = (cliHighlighted + 1) % cliSuggestions.length;
            updateHighlight('#ped-cli-suggestions-container', cliHighlighted);
            break;
          case 'ArrowUp':
            e.preventDefault();
            cliHighlighted = (cliHighlighted - 1 + cliSuggestions.length) % cliSuggestions.length;
            updateHighlight('#ped-cli-suggestions-container', cliHighlighted);
            break;
          case 'Enter':
            e.preventDefault();
            if (cliHighlighted > -1) selectClient(cliSuggestions[cliHighlighted]);
            break;
          case 'Escape':
            hideSuggestions('ped-cli-suggestions-container');
            break;
        }
      });

      // ===== PRODUTO =====
      function fillProdutoCampos(p){
        produtoSelecionado = p ? { chave:p.chave, codigo:p.codigo, nome:p.nome, valorvenda:p.valorvenda, valorcompra:p.valorcompra } : null;
        $('ped-prod-cod').value = p ? String(p.codigo) : '';
        $('ped-prod-desc').value = p ? p.nome : '';
        const vuSugerido = p ? (p.valorvenda != null ? Number(p.valorvenda) : Number(p.valorcompra)||0) : 0;
        if (Number($('ped-vu').value || 0) === 0) $('ped-vu').value = String(vuSugerido);
      }

      async function tryResolveProdutoByDigits(term){
        const onlyDigits = (term||'').replace(/\D/g,'');
        if (onlyDigits && onlyDigits === term){
          try{
            const r = await ipcRenderer.invoke('produtos:byCodigo', Number(onlyDigits));
            if (r){ fillProdutoCampos(r); return true; }
          }catch(_e){}
        }
        return false;
      }

      $('ped-prod-cod').addEventListener('input', async (e) => {
        prodHighlighted = -1;
        const term = e.target.value.trim();
        clearTimeout(prodSearchTimeout);

        if (await tryResolveProdutoByDigits(term)) {
          hideSuggestions('ped-prod-suggestions-container');
          return;
        }

        if (!term || term.length < 2){
          hideSuggestions('ped-prod-suggestions-container');
          produtoSelecionado = null;
          $('ped-prod-desc').value = '';
          return;
        }

        prodSearchTimeout = setTimeout(async () => {
          try {
            const results = await ipcRenderer.invoke('produtos:search-for-autocomplete', term);
            prodSuggestions = results || [];

            const c = $('ped-prod-suggestions-container');
            c.innerHTML = '';

            if (!prodSuggestions.length) {
              c.innerHTML = '<div class="suggestion-item" style="color:#94a3b8; cursor:default;">Nenhum produto encontrado</div>';
            } else {
              prodSuggestions.forEach((p, index) => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                const preco = (p.valorvenda != null) ? ` • R$ ${f2(p.valorvenda)}` : '';
                item.innerHTML = `<b>${p.codigo}</b> — ${p.nome}<small>${preco}</small>`;
                item.dataset.index = String(index);
                c.appendChild(item);
              });
            }

            c.classList.remove('hidden');
          } catch (err) {
            toast('Erro ao buscar produtos: ' + err.message, true);
          }
        }, 250);
      });

      $('ped-prod-suggestions-container').addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;
        const idx = Number(item.dataset.index);
        if (Number.isInteger(idx)) {
          const p = prodSuggestions[idx];
          fillProdutoCampos(p);
          hideSuggestions('ped-prod-suggestions-container');
          $('ped-qtde').focus();
        }
      });

      $('ped-prod-cod').addEventListener('keydown', async (e) => {
        const container = $('ped-prod-suggestions-container');
        if (!container.classList.contains('hidden') && prodSuggestions.length > 0) {
          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault();
              prodHighlighted = (prodHighlighted + 1) % prodSuggestions.length;
              updateHighlight('#ped-prod-suggestions-container', prodHighlighted);
              return;
            case 'ArrowUp':
              e.preventDefault();
              prodHighlighted = (prodHighlighted - 1 + prodSuggestions.length) % prodSuggestions.length;
              updateHighlight('#ped-prod-suggestions-container', prodHighlighted);
              return;
            case 'Enter':
              e.preventDefault();
              if (prodHighlighted > -1) {
                const p = prodSuggestions[prodHighlighted];
                fillProdutoCampos(p);
                hideSuggestions('ped-prod-suggestions-container');
                $('ped-qtde').focus();
              }
              return;
            case 'Escape':
              hideSuggestions('ped-prod-suggestions-container');
              return;
          }
        }
        if (e.key === 'Enter') {
          const term = $('ped-prod-cod').value.trim();
          if (term) await tryResolveProdutoByDigits(term);
          e.preventDefault();
        }
      });

      // clicar fora fecha dropdowns
      document.addEventListener('click', (e) => {
        const cliWrap  = document.querySelector('.client-search-wrapper');
        const prodWrap = document.querySelector('.product-search-wrapper');
        if (cliWrap && !cliWrap.contains(e.target))  hideSuggestions('ped-cli-suggestions-container');
        if (prodWrap && !prodWrap.contains(e.target)) hideSuggestions('ped-prod-suggestions-container');
      });

      // adicionar item
      const addByEnter = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('ped-add-item').click(); } };
      ['ped-qtde','ped-vu'].forEach(id => $(id).addEventListener('keydown', addByEnter));

      $('ped-add-item').onclick = async () => {
        try {
          const term = $('ped-prod-cod').value.trim();
          if (!produtoSelecionado && term) await tryResolveProdutoByDigits(term);
          if (!produtoSelecionado) { toast('Selecione um produto válido.', true); $('ped-prod-cod').focus(); return; }

          const qtde = Number($('ped-qtde').value || 0);
          const valorunit = Number($('ped-vu').value || 0);
          if (qtde <= 0 || valorunit < 0) { toast('Quantidade e valor precisam ser válidos.', true); return; }

          itens.push({
            chaveproduto: produtoSelecionado.chave,
            codigo: produtoSelecionado.codigo,
            nome: produtoSelecionado.nome,
            qtde,
            valorunit
          });

          $('ped-prod-cod').value = '';
          $('ped-prod-desc').value = '';
          $('ped-qtde').value = '1';
          $('ped-vu').value = '0';
          produtoSelecionado = null;
          hideSuggestions('ped-prod-suggestions-container');
          renderGrid();
          $('ped-prod-cod').focus();
        } catch (err) {
          toast('Falha ao adicionar item: ' + (err?.message || err), true);
        }
      };

      // salvar pedido
      $('form-ped').onsubmit = async (e) => {
        e.preventDefault();
        try {
          if (!cliente?.chave) { toast('Selecione um cliente.', true); $('ped-cli-search').focus(); return; }
          if (itens.length === 0) { toast('Adicione ao menos um item.', true); return; }

          const payload = {
            chaveclifor: cliente.chave,
            status: Number($('ped-status').value || 1),
            obs: ($('ped-obs').value || '').trim() || null,
            tipopag: (($('ped-pag').value || '').trim() || null), // << NOVO
            itens: itens.map(i => ({ chaveproduto: i.chaveproduto, qtde: Number(i.qtde), valorunit: Number(i.valorunit) }))
          };
          const r = await ipcRenderer.invoke('pedidos:create', payload);
          toast(`Pedido salvo (cód. ${r.numero || r.chave})`);
          $('ped-reset').click();
        } catch (err) {
          toast('Erro ao salvar: ' + (err?.message || err), true);
        }
      };

      // reset
      $('ped-reset').onclick = (ev) => {
        ev.preventDefault?.();
        $('form-ped').reset();
        cliente = null;
        itens.length = 0;
        hideSuggestions('ped-cli-suggestions-container');
        hideSuggestions('ped-prod-suggestions-container');
        $('ped-status').value = '1';
        $('ped-pag').value = '';                 // << limpa forma de pagamento
        $('ped-cli-search').value = '';
        $('ped-cli-nome').value = 'Cliente não selecionado';
        $('ped-prod-desc').value = '';
        $('ped-qtde').value = '1';
        $('ped-vu').value = '0';
        $('ped-total').value = '0.00';
        produtoSelecionado = null;
        renderGrid();
        $('ped-cli-search').focus();
      };

      // inicial
      hideSuggestions('ped-cli-suggestions-container');
      hideSuggestions('ped-prod-suggestions-container');
      renderGrid();
      $('ped-cli-search').focus();
    }
  };
};
