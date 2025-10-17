// ===============================
// src/renderer/views/consulta-clientes.js
// ===============================
window.renderConsultaClientes = function () {
  const PAGE_SIZE = 10;

  const html = `
    <div class="card">
      <h3>Consulta de Clientes</h3>

      <style>
        .cc-qwrap{ position:relative; }
        #cc-suggest{
          position:absolute; left:0; right:0; top:38px;
          border:1px solid #e5eaf0; border-radius:10px; background:#fff;
          box-shadow:0 8px 22px rgba(15,23,42,.10); z-index:1000;
          max-height:260px; overflow-y:auto; display:none;
        }
        #cc-suggest .s-item{
          padding:10px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer;
        }
        #cc-suggest .s-item:last-child{ border-bottom:none; }
        #cc-suggest .s-item:hover, #cc-suggest .s-item.highlight{ background:#f8fafc; }
        #cc-suggest small{ color:#64748b; margin-left:6px; }

        /* Adicionado para garantir a rolagem horizontal em telas pequenas */
        .datagrid { overflow-x: auto; }
      </style>

      <div class="form" style="grid-template-columns: 1fr auto auto; align-items:end;">
        <div class="cc-qwrap">
          <label class="label">Buscar por nome, documento ou e-mail...</label>
          <input id="cc-q" class="input" placeholder="Digite e pressione Enter" />
          <div id="cc-suggest"></div>
        </div>
        <button id="cc-buscar" class="button" style="height:38px">Buscar</button>
        <button id="cc-limpar" class="button outline" style="height:38px">Limpar</button>
      </div>

      <div style="margin-top:12px">
        <div class="datagrid" id="cc-grid">
          <div class="dg-row dg-head" style="grid-template-columns: 100px minmax(200px, 2fr) 70px 90px minmax(160px, 1fr) minmax(200px, 1.5fr) minmax(140px, 1fr) minmax(250px, 2fr) 170px;">
            <div class="dg-cell">Código</div>
            <div class="dg-cell">Nome</div>
            <div class="dg-cell">F/J</div>
            <div class="dg-cell">Tipo</div>
            <div class="dg-cell">Documento</div>
            <div class="dg-cell">Email</div>
            <div class="dg-cell">Telefone</div>
            <div class="dg-cell">Endereço</div>
            <div class="dg-cell">Data</div>
          </div>
          <div id="cc-body"></div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:10px">
        <button id="cc-prev" class="button outline">Anterior</button>
        <span id="cc-page-info" style="color:#64748b;font-size:12px"></span>
        <button id="cc-next" class="button outline">Próximo</button>
      </div>
    </div>
  `;

  // -------- utilitários de formatação ----------
  function safe(v, def = '') { return (v === null || v === undefined) ? def : String(v); }

  function maskDoc(doc) {
    const d = (doc || '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return doc || '';
  }

  function fmtDate(v) {
    if (!v) return '';
    const dt = (v instanceof Date) ? v : new Date(v);
    if (Number.isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}, ${hh}:${mi}`;
  }

  // --------- componente ----------
  return {
    title: 'Consulta de Clientes',
    html,
    afterRender() {
      const { ipcRenderer } = require('electron');
      const $ = (id) => document.getElementById(id);

      // estado local
      const state = {
        q: '',
        page: 1,
        total: 0,
        rows: []
      };

      // ======= AUTOCOMPLETE (estado) =======
      let acTimeout = null;
      let acItems = [];
      let acIndex = -1;

      function toast(msg, err=false){
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = `position:fixed;right:16px;bottom:16px;background:${err?'#fee2e2':'#ecfeff'};border:1px solid #e5eaf0;border-radius:10px;padding:8px 12px;box-shadow:0 8px 22px rgba(15,23,42,.08);z-index:9999;color:#0f172a`;
        document.body.appendChild(t);
        setTimeout(()=>t.remove(),2000);
      }

      // renderização das linhas
      function renderRows(rows) {
        const body = $('cc-body');

        if (!rows.length) {
          body.innerHTML = `
            <div class="card" style="grid-column:1/-1;background:#fff;border:1px dashed #e2e8f0;">
              <div style="padding:10px 12px;color:#64748b">Sem registros.</div>
            </div>`;
          return;
        }

        body.innerHTML = rows.map(r => {
          const codigo    = safe(r.codigo ?? r.id ?? '');
          const nome      = safe(r.nome);
          const fisjur    = safe(r.fisjur || r.fj || '');
          const tipo      = safe(r.tipo);
          const documento = maskDoc(r.documento ?? r.cpf ?? r.cnpj ?? '');
          const email     = safe(r.email);
          const telefone  = safe(r.telefone);
          const endereco  = safe(r.endereco || r.logradouro || '');
          const criadoEm  = fmtDate(r.criado_em || r.data || r.created_at || r.datahoracad);

          return `
            <div class="dg-row" style="grid-template-columns: 100px minmax(200px, 2fr) 70px 90px minmax(160px, 1fr) minmax(200px, 1.5fr) minmax(140px, 1fr) minmax(250px, 2fr) 170px;">
              <div class="dg-cell">${codigo}</div>
              <div class="dg-cell">${nome}</div>
              <div class="dg-cell">${fisjur}</div>
              <div class="dg-cell">${tipo}</div>
              <div class="dg-cell">${documento}</div>
              <div class="dg-cell">${email}</div>
              <div class="dg-cell">${telefone}</div>
              <div class="dg-cell">${endereco}</div>
              <div class="dg-cell">${criadoEm}</div>
            </div>
          `;
        }).join('');
      }

      function updatePager() {
        const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
        $('cc-page-info').textContent = `Página ${state.page} de ${pages} — ${state.total} registro(s)`;
        $('cc-prev').disabled = (state.page <= 1);
        $('cc-next').disabled = (state.page >= pages);
      }

      // invocação com tolerância a aliases
      async function tryIPC(channel, payload, aliases = []) {
        try {
          return await ipcRenderer.invoke(channel, payload);
        } catch (e) {
          const msg = String(e?.message || e);
          const noHandler =
            msg.includes('No handler registered') ||
            msg.includes('has no listeners') ||
            msg.includes('not a function');
          if (noHandler && aliases?.length) {
            for (const alt of aliases) {
              try { return await ipcRenderer.invoke(alt, payload); } catch {}
            }
          }
          throw e;
        }
      }

      async function load() {
        const payload = { q: state.q, page: state.page, pageSize: PAGE_SIZE };

        try {
          const resp = await tryIPC(
            'clientes:search',
            payload,
            ['db:clientes:buscar', 'clientes:list', 'clientes:find', 'clientes:query']
          );

          state.rows  = Array.isArray(resp?.rows) ? resp.rows : [];
          state.total = Number(resp?.total || state.rows.length || 0);
        } catch (e) {
          // Fallback simples
          state.rows = [];
          state.total = 0;
        }

        renderRows(state.rows);
        updatePager();
      }

      // ====== AUTOCOMPLETE (UI) ======
      function hideAC(){
        const box = $('cc-suggest');
        box.style.display = 'none';
        box.innerHTML = '';
        acItems = [];
        acIndex = -1;
      }
      function showAC(){
        const box = $('cc-suggest');
        if (box.innerHTML.trim()) box.style.display = 'block';
      }
      function renderAC(items){
        $('cc-suggest').innerHTML = items.map((c,i) => {
          const doc = c.cpf ? ` • ${maskDoc(c.cpf)}` : '';
          const tel = c.telefone ? ` • ${c.telefone}` : '';
          return `<div class="s-item" data-i="${i}"><b>${c.codigo}</b> — ${c.nome}<small>${doc}${tel}</small></div>`;
        }).join('');
        showAC();
      }

      $('cc-q').addEventListener('input', () => {
        const term = $('cc-q').value.trim();
        clearTimeout(acTimeout);
        acIndex = -1;

        if (term.length < 2) { hideAC(); return; }

        acTimeout = setTimeout(async () => {
          try{
            const res = await ipcRenderer.invoke('clientes:search-for-autocomplete', term);
            acItems = res || [];
            if (!acItems.length) {
              $('cc-suggest').innerHTML = `<div class="s-item" style="cursor:default;color:#94a3b8">Nenhum cliente encontrado</div>`;
              showAC();
              return;
            }
            renderAC(acItems);
          }catch(err){
            hideAC();
            toast('Erro ao buscar clientes: ' + err.message, true);
          }
        }, 300);
      });

      $('cc-suggest').addEventListener('click', (e) => {
        const el = e.target.closest('.s-item');
        if (!el || el.dataset.i == null) return;
        const c = acItems[Number(el.dataset.i)];
        $('cc-q').value = `${c.codigo} - ${c.nome}`;
        state.q = $('cc-q').value.trim();
        hideAC();
        state.page = 1;
        load();
      });

      $('cc-q').addEventListener('keydown', (e) => {
        const box = $('cc-suggest');
        if (box.style.display !== 'block' || acItems.length === 0) {
          if (e.key === 'Enter') { state.q = $('cc-q').value.trim(); state.page = 1; load(); }
          return;
        }

        switch(e.key){
          case 'ArrowDown':
            e.preventDefault();
            acIndex = (acIndex + 1) % acItems.length;
            Array.from(box.children).forEach((c,i) => c.classList.toggle('highlight', i===acIndex));
            box.children[acIndex]?.scrollIntoView({block:'nearest'});
            break;
          case 'ArrowUp':
            e.preventDefault();
            acIndex = (acIndex - 1 + acItems.length) % acItems.length;
            Array.from(box.children).forEach((c,i) => c.classList.toggle('highlight', i===acIndex));
            box.children[acIndex]?.scrollIntoView({block:'nearest'});
            break;
          case 'Enter':
            e.preventDefault();
            if (acIndex > -1) {
              const c = acItems[acIndex];
              $('cc-q').value = `${c.codigo} - ${c.nome}`;
              state.q = $('cc-q').value.trim();
              hideAC();
              state.page = 1;
              load();
            }
            break;
          case 'Escape':
            hideAC();
            break;
        }
      });

      document.addEventListener('click', (e) => {
        const wrap = document.querySelector('.cc-qwrap');
        if (wrap && !wrap.contains(e.target)) hideAC();
      });

      // handlers
      $('cc-buscar').onclick = () => {
        state.q = $('cc-q').value.trim();
        state.page = 1;
        hideAC();
        load();
      };

      $('cc-limpar').onclick = () => {
        $('cc-q').value = '';
        state.q = '';
        state.page = 1;
        hideAC();
        load();
      };

      $('cc-prev').onclick = () => { if (state.page > 1) { state.page--; load(); } };
      $('cc-next').onclick = () => { state.page++; load(); };

      // inicial
      load();
    }
  };
};