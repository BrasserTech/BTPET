// src/renderer/views/consulta-pedidos.js
window.renderConsultaPedidos = function () {
  const PAGE_SIZE = 10;

  const html = `
    <style>
      /* GRID: # | Cliente | Qtd | Status | Tipo Pagto | Total | Obs | Data  */
      .cp-head {
        display:grid;
        grid-template-columns: 80px 1.4fr 110px 180px 160px 160px 1.4fr 180px;
        gap:0;
        padding:10px 12px;
        background:#eef4ff;
        border:1px solid #dfe7fb;
        border-radius:12px;
        font-weight:700;
        color:#0f2544;
      }
      .cp-head > div { padding:8px 10px; }

      .cp-card { margin-top:10px; }
      .cp-row {
        display:grid;
        grid-template-columns: 80px 1.4fr 110px 180px 160px 160px 1.4fr 180px;
        align-items:center;
        gap:0;
        background:#ffffff;
        border:1px solid #e6ecf5;
        border-radius:12px;
        padding:0; /* vamos usar padding em cada coluna pra alinhar melhor */
        box-shadow:0 4px 14px rgba(15,23,42,.05);
        transition: box-shadow .15s ease, transform .05s ease;
        cursor:pointer;
        overflow:hidden;
      }
      .cp-row:hover { box-shadow:0 8px 22px rgba(15,23,42,.08); }
      .cp-col { padding:12px 10px; color:#0f172a; }

      /* separadores verticais */
      .cp-head > div:not(:last-child),
      .cp-row  > .cp-col:not(:last-child){
        border-right:1px dashed #e9eef6;
      }

      .cp-expander {
        display:flex; align-items:center; gap:8px; user-select:none;
        font-variant-numeric: tabular-nums;
      }
      .cp-expander .arrow {
        width:22px; height:22px; line-height:22px; text-align:center;
        border:1px solid #e5eaf0; border-radius:8px; cursor:pointer;
        background:#fff; transition:transform .15s ease, opacity .15s ease;
      }
      .cp-card[data-open="1"] .cp-expander .arrow { transform:rotate(90deg); }

      .cp-items {
        margin-top:6px;
        border:1px dashed #cfe3ff;
        background:#f8fbff;
        border-radius:12px;
        overflow:hidden;
      }
      .cp-items-head, .cp-item {
        display:grid;
        grid-template-columns: 120px 1fr 110px 130px 130px;
        padding:10px 12px;
      }
      .cp-items-head {
        background:#eef6ff;
        color:#0f2544;
        font-weight:700;
        border-bottom:1px dashed #cfe3ff;
      }
      .cp-item {
        font-size:13px;
        color:#0f172a;
        border-bottom:1px solid #ebf2ff;
      }
      .cp-item:last-child { border-bottom:none; }
      .cp-item .num { font-variant-numeric: tabular-nums; text-align:right; }

      .cp-tools{
        display:grid; gap:10px; align-items:end;
        grid-template-columns: 1.2fr 160px 160px 180px 1.2fr auto auto;
      }
      @media (max-width:1100px){ .cp-tools{ grid-template-columns:1fr 1fr; } }

      .cp-tools .input, .cp-tools .select { height:38px; }

      .cp-pager{
        display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:10px;color:#64748b;font-size:12px
      }
      .cp-pager .button.outline{ height:auto; padding:6px 10px; }

      /* seletor de status inline */
      .cp-status-select{
        width:100%;
        height:32px;
        border:1px solid #e5e7eb;
        border-radius:8px;
        padding:0 8px;
        background:#fff;
      }

      /* colunas com números à direita */
      .num { font-variant-numeric: tabular-nums; text-align:right; }
    </style>

    <div class="card">
      <h3>Consulta de Pedidos</h3>

      <div class="cp-tools">
        <div>
          <label class="label">Cliente</label>
          <input id="cp-cli" class="input" placeholder="Nome do cliente" />
        </div>
        <div>
          <label class="label">De</label>
          <input id="cp-de" class="input" type="date" />
        </div>
        <div>
          <label class="label">Até</label>
          <input id="cp-ate" class="input" type="date" />
        </div>
        <div>
          <label class="label">Status</label>
          <select id="cp-st" class="select">
            <option value="">Todos</option>
            <option value="1">Em preparo</option>
            <option value="2">Rota de entrega</option>
            <option value="3">Concluído</option>
          </select>
        </div>
        <div>
          <label class="label">Item (código ou nome)</label>
          <input id="cp-item" class="input" placeholder="Ex.: 12 ou 'camiseta'" />
        </div>
        <button id="cp-buscar" class="button">Buscar</button>
        <button id="cp-limpar" class="button outline">Limpar</button>
      </div>

      <div style="margin-top:12px">
        <div class="cp-head">
          <div>#</div>
          <div>Cliente</div>
          <div class="num">Qtd Itens</div>
          <div>Status</div>
          <div>Tipo pagto</div>
          <div class="num">Total (R$)</div>
          <div>Observações</div>
          <div>Data</div>
        </div>
        <div id="cp-body"></div>
      </div>

      <div class="cp-pager">
        <button id="cp-prev" class="button outline">Anterior</button>
        <span id="cp-page-info"></span>
        <button id="cp-next" class="button outline">Próximo</button>
      </div>
    </div>
  `;

  const $ = (id) => document.getElementById(id);
  const n2 = (x) => (Number(x || 0)).toFixed(2);
  const brl = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function fmtDate(v){
    if (!v) return '';
    const dt = (v instanceof Date) ? v : new Date(v);
    if (Number.isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2,'0');
    const mm = String(dt.getMonth()+1).padStart(2,'0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2,'0');
    const mi = String(dt.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy}, ${hh}:${mi}`;
  }

  function optionStatus(s){
    const val = Number(s)||1;
    return `
      <select class="cp-status-select" data-role="status">
        <option value="1" ${val===1?'selected':''}>Em preparo</option>
        <option value="2" ${val===2?'selected':''}>Rota de entrega</option>
        <option value="3" ${val===3?'selected':''}>Concluído</option>
      </select>
    `;
  }

  return {
    title: 'Consulta de Pedidos',
    html,
    afterRender() {
      const { ipcRenderer } = require('electron');
      const state = { page:1, total:0, rows:[] };
      let bodyEventsBound = false;

      async function tryIPC(channel, payload, aliases=[]){
        try { return await ipcRenderer.invoke(channel, payload); }
        catch (e){
          const msg = String(e?.message || e);
          const noHandler = msg.includes('No handler registered')||msg.includes('has no listeners')||msg.includes('not a function');
          if (noHandler && aliases?.length){
            for (const alt of aliases){ try { return await ipcRenderer.invoke(alt, payload); } catch{} }
          }
          throw e;
        }
      }

      function renderItemsHTML(items){
        if (!Array.isArray(items) || !items.length) {
          return `
            <div class="cp-items">
              <div class="cp-items-head">
                <div>Itens</div><div>Produto</div>
                <div class="num">Qtd</div><div class="num">Vlr Unit</div><div class="num">Total</div>
              </div>
              <div style="padding:12px;color:#64748b">Sem itens.</div>
            </div>`;
        }
        return `
          <div class="cp-items">
            <div class="cp-items-head">
              <div>Itens</div>
              <div>Produto</div>
              <div class="num">Qtd</div>
              <div class="num">Vlr Unit</div>
              <div class="num">Total</div>
            </div>
            ${items.map(it=>{
              const vt = (Number(it.qtde||0) * Number(it.valorunit||0));
              const nome = it.produto_nome ?? it.nome ?? '';
              return `
                <div class="cp-item">
                  <div>${it.codigo_prod ?? it.codigo ?? ''}</div>
                  <div>${nome}</div>
                  <div class="num">${Number(it.qtde||0).toFixed(2)}</div>
                  <div class="num">${brl(n2(it.valorunit||0))}</div>
                  <div class="num">${brl(n2(vt))}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      function renderRows(rows){
        const body = $('cp-body');

        if (!rows.length){
          body.innerHTML = `
            <div class="card" style="grid-column:1/-1;background:#fff;border:1px dashed #e2e8f0;margin-top:10px">
              <div style="padding:10px 12px;color:#64748b">Sem registros.</div>
            </div>`;
          return;
        }

        body.innerHTML = rows.map((r,idx) => {
          const codigo  = r.numero ?? r.codigo ?? r.id ?? '';
          const qtd     = Number(r.qtd_itens||0);
          const total   = n2(r.total || 0);
          const data    = fmtDate(r.datahoracad);
          const obs     = (r.obs || '').toString();
          const status  = Number(r.status||1);
          const tipopag = (r.tipopag || '').toString() || '—';
          const items   = Array.isArray(r.itens) ? r.itens : null;

          const itemsBlock = Array.isArray(items) ? renderItemsHTML(items) : '';

          return `
            <div class="cp-card" data-open="0"
                 data-idx="${idx}"
                 data-chave="${r.chave ?? ''}"
                 data-codigo="${codigo ?? ''}"
                 data-loaded="${Array.isArray(items) ? '1' : '0'}">
              <div class="cp-row">
                <div class="cp-col cp-expander">
                  <div class="arrow">▸</div>
                  <div>${codigo}</div>
                </div>
                <div class="cp-col">${r.cliente || r.nomecliente || ''}</div>
                <div class="cp-col num">${qtd}</div>
                <div class="cp-col">
                  ${optionStatus(status)}
                </div>
                <div class="cp-col">${tipopag}</div>
                <div class="cp-col num">${brl(total)}</div>
                <div class="cp-col" title="${obs.replace(/"/g,'&quot;')}">${obs}</div>
                <div class="cp-col">${data}</div>
              </div>
              ${itemsBlock}
            </div>
          `;
        }).join('');

        body.querySelectorAll('.cp-card .cp-items').forEach(it => it.style.display = 'none');

        if (!bodyEventsBound){
          body.addEventListener('click', async (ev) => {
            const arrow = ev.target.closest('.arrow');
            const row   = ev.target.closest('.cp-row');
            if (!arrow && !row) return;

            // clique no select não expande
            const isSelect = ev.target && ev.target.matches && ev.target.matches('select.cp-status-select');
            if (isSelect) return;

            const card = (arrow || row).closest('.cp-card');
            if (!card) return;

            let items = card.querySelector('.cp-items');

            if (!items){
              const loading = document.createElement('div');
              loading.className = 'cp-items';
              loading.innerHTML = `
                <div class="cp-items-head">
                  <div>Itens</div><div>Produto</div>
                  <div class="num">Qtd</div><div class="num">Vlr Unit</div><div class="num">Total</div>
                </div>
                <div style="padding:12px;color:#64748b">Carregando itens…</div>`;
              card.appendChild(loading);
              items = loading;

              try{
                const chave  = Number(card.getAttribute('data-chave')) || null;
                const codigo = Number(card.getAttribute('data-codigo')) || null;

                const res = await tryIPC(
                  'pedidos:itemsByPedido',
                  { chave, codigo },
                  ['pedidos:getItens','pedidos:itens','pedidos:items','pedidos:getItems']
                );
                const list = Array.isArray(res?.rows) ? res.rows : (Array.isArray(res) ? res : []);
                items.outerHTML = renderItemsHTML(list);
                items = card.querySelector('.cp-items');
              }catch(e){
                items.innerHTML = `
                  <div class="cp-items-head">
                    <div>Itens</div><div>Produto</div>
                    <div class="num">Qtd</div><div class="num">Vlr Unit</div><div class="num">Total</div>
                  </div>
                  <div style="padding:12px;color:#b91c1c;background:#fee2e2;border-top:1px solid #fecaca">
                    Falha ao carregar os itens: ${ (e && e.message) ? e.message : String(e) }
                  </div>`;
              }
            }

            const isOpen = card.getAttribute('data-open') === '1';
            items.style.display = isOpen ? 'none':'block';
            card.setAttribute('data-open', isOpen ? '0':'1');
          });

          // Handler para alteração de status (delegado)
          body.addEventListener('change', async (ev) => {
            if (!ev.target || !ev.target.matches('select.cp-status-select')) return;
            const select = ev.target;
            const card = select.closest('.cp-card');
            if (!card) return;

            const chave = Number(card.getAttribute('data-chave'));
            const newStatus = Number(select.value);

            const oldDisabled = select.disabled;
            select.disabled = true;

            try {
              await tryIPC(
                'pedidos:update-status',
                { chave, status: newStatus },
                ['monitorpedidos:update-status','monitor:set-status','pedidos:set-status']
              );
            } catch (e) {
              const idx = Number(card.getAttribute('data-idx'));
              const prev = Number((state.rows[idx]?.status) || 1);
              select.value = String(prev);
              console.error('Falha ao atualizar status:', e?.message || e);
            } finally {
              select.disabled = oldDisabled;
            }
          });

          bodyEventsBound = true;
        }
      }

      function updatePager(){
        const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
        $('cp-page-info').textContent = `Página ${state.page} de ${pages} — ${state.total} registro(s)`;
        $('cp-prev').disabled = (state.page <= 1);
        $('cp-next').disabled = (state.page >= pages);
      }

      function buildPayload(){
        const sCli  = ($('cp-cli').value || '').trim();
        const sDe   = $('cp-de').value || null;
        const sAte  = $('cp-ate').value || null;
        const sSt   = $('cp-st').value || '';
        const sItem = ($('cp-item').value || '').trim();
        return {
          cliente: sCli || null,
          from: sDe || null,
          to:   sAte || null,
          status: sSt ? Number(sSt) : null,
          item: sItem || null,
          page: state.page,
          pageSize: PAGE_SIZE
        };
      }

      async function load(){
        try{
          const resp = await tryIPC(
            'pedidos:search2',
            buildPayload(),
            ['pedidos:search']
          );
          state.rows  = Array.isArray(resp?.rows) ? resp.rows : [];
          state.total = Number(resp?.total || state.rows.length || 0);
        }catch(e){
          // fallback demo
          const demo = [
            { chave:4, codigo:4, cliente:'teste', qtd_itens:2, status:1, tipopag:'Pix', total:122, obs:'12222', datahoracad:'2025-09-14T22:56:00-03:00' },
            { chave:3, codigo:3, cliente:'teste', qtd_itens:1, status:2, tipopag:'Dinheiro', total:20,   obs:'11111111111111111', datahoracad:'2025-09-14T22:38:00-03:00' },
            { chave:2, codigo:2, cliente:'teste', qtd_itens:1, status:3, tipopag:'Cartão débito', total:10,   obs:'aaaaaaaaaaaaaaaaaaaa', datahoracad:'2025-09-14T22:37:00-03:00' }
          ];
          state.total = demo.length;
          const start = (state.page - 1) * PAGE_SIZE;
          state.rows  = demo.slice(start, start + PAGE_SIZE);
        }
        renderRows(state.rows);
        updatePager();
      }

      $('cp-buscar').onclick = () => { state.page = 1; load(); };
      $('cp-limpar').onclick = () => {
        $('cp-cli').value=''; $('cp-de').value=''; $('cp-ate').value='';
        $('cp-st').value=''; $('cp-item').value='';
        state.page = 1; load();
      };
      ['cp-cli','cp-de','cp-ate','cp-item'].forEach(id=>{
        $(id).addEventListener('keydown', (e)=>{ if (e.key==='Enter') $('cp-buscar').click(); });
      });
      $('cp-prev').onclick = () => { if (state.page>1){ state.page--; load(); } };
      $('cp-next').onclick = () => { state.page++; load(); };

      load();
    }
  };
};
