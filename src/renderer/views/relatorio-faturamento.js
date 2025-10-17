// src/renderer/views/relatorio-faturamento.js
// Relatório de Faturamento — cabeçalho padronizado, ordenação e seleção de colunas (Código sempre visível).

window.renderRelFaturamento = function () {
  return {
    title: 'Relatório: Faturamento',
    html: `
      <style>
        .rep-shell{background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06)}
        .rep-head{padding:16px 16px 8px 16px}
        .rep-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px}
        @media (max-width:1100px){ .rep-grid{grid-template-columns:repeat(6,1fr)} }
        @media (max-width:700px){ .rep-grid{grid-template-columns:repeat(2,1fr)} }
        .rep-actions{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
        .rep-totalbox{padding:22px;text-align:center;border-top:1px solid #eef2f7}
        .rep-totalcap{font-size:12px;color:#6b7a90;letter-spacing:.08em}
        .rep-total{font-size:44px;line-height:1.0;font-weight:800;color:#10253f;margin-top:8px}
        .card{border-top:1px solid #eef2f7;padding:16px}
        .tbl{width:100%;border-collapse:separate;border-spacing:0}
        .tbl thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:10px;text-align:left;color:#10253f}
        .tbl td{border-bottom:1px solid #eef2f7;padding:10px}
        .txt-right{text-align:right}
        .muted{color:#6b7a90}
        .chip{display:inline-flex;gap:6px;align-items:center;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px}
        .dropdown{position:relative;display:inline-block}
        .dropdown-menu{position:absolute;z-index:10;top:calc(100% + 6px);left:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 18px rgba(21,78,210,.06);padding:10px;min-width:240px}
        .dropdown-menu label{display:flex;gap:8px;align-items:center;padding:4px 2px}
      </style>

      <div class="rep-shell">
        <div class="rep-head">
          <div class="rep-grid">
            <div class="col" style="grid-column: span 2">
              <label class="label">De</label>
              <input id="fat-dtini" type="date" class="input"/>
            </div>
            <div class="col" style="grid-column: span 2">
              <label class="label">Até</label>
              <input id="fat-dtfim" type="date" class="input"/>
            </div>
            <div class="col" style="grid-column: span 3">
              <label class="label">Telefone (opcional)</label>
              <input id="fat-telefone" type="text" class="input" placeholder="Digite o número ou parte dele"/>
            </div>
            <div class="col" style="grid-column: span 3">
              <label class="label">Cliente (opcional)</label>
              <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                <input id="fat-cli" class="input" placeholder="F8 para pesquisar" data-lookup="clientes" data-target-id="fat-cli-id"/>
                <button id="fat-cli-lupa" class="button outline" title="Pesquisar (F8)">🔎</button>
              </div>
              <input id="fat-cli-id" type="hidden"/>
            </div>
            <div class="col" style="grid-column: span 2">
              <label class="label">Empresa (opcional)</label>
              <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                <input id="fat-emp" class="input" placeholder="F8 para pesquisar" data-lookup="empresas" data-target-id="fat-emp-id"/>
                <button id="fat-emp-lupa" class="button outline" title="Pesquisar (F8)">🔎</button>
              </div>
              <input id="fat-emp-id" type="hidden"/>
            </div>

            <div class="col" style="grid-column: span 2">
              <label class="label">Ordenar por</label>
              <select id="fat-ordby" class="input">
                <option value="data">Data</option>
                <option value="codigo">Código</option>
                <option value="cliente">Cliente</option>
                <option value="telefone">Telefone</option>
                <option value="total">Valor</option>
              </select>
            </div>
            <div class="col" style="grid-column: span 2">
              <label class="label">Direção</label>
              <select id="fat-orddir" class="input">
                <option value="DESC">Maior → menor</option>
                <option value="ASC">Menor → maior</option>
              </select>
            </div>

            <div class="col" style="grid-column: span 3">
              <label class="label">Campos</label>
              <div class="dropdown">
                <button id="fat-cols-btn" class="chip">Escolher colunas</button>
                <div id="fat-cols-menu" class="dropdown-menu" style="display:none">
                  <label><input type="checkbox" data-col="data"     checked> Data</label>
                  <label><input type="checkbox" data-col="cliente"  checked> Cliente</label>
                  <label><input type="checkbox" data-col="telefone" checked> Telefone</label>
                  <label><input type="checkbox" data-col="total"    checked> Total (R$)</label>
                  <div class="muted" style="margin-top:6px;font-size:12px">* Código é sempre exibido</div>
                </div>
              </div>
            </div>
          </div>

          <div class="rep-actions">
            <button id="fat-aplicar" class="button">Aplicar</button>
            <button id="fat-limpar" class="button outline">Limpar</button>
            <button id="fat-pdf" class="button outline">Baixar PDF</button>
          </div>
        </div>

        <div class="rep-totalbox">
          <div class="rep-totalcap">TOTAL DO PERÍODO</div>
          <div id="fat-total" class="rep-total">R$ 0,00</div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 8px 0">Documentos (Pedidos)</h3>
          <table class="tbl">
            <thead>
              <tr id="fat-head-row"></tr>
            </thead>
            <tbody id="fat-docs"></tbody>
          </table>
        </div>
      </div>
    `,
    afterRender() {
      const { ipcRenderer } = require('electron');
      const $ = (id) => document.getElementById(id);
      const moeda = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const todayISO = () => new Date().toISOString().slice(0, 10);
      const firstOfMonth = () => { const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); };
      const toBr = (s)=>{ const d=new Date(s); return isNaN(d)?'':d.toLocaleDateString('pt-BR'); };

      // estado de colunas (código sempre)
      const colState = new Set(['data','cliente','telefone','total']);

      function bindColsDropdown(btnId, menuId) {
        const btn = $(btnId), menu = $(menuId);
        btn.onclick = ()=> menu.style.display = menu.style.display==='none'?'block':'none';
        document.addEventListener('click', (ev)=>{
          if (!menu.contains(ev.target) && ev.target !== btn) menu.style.display='none';
        });
        menu.querySelectorAll('input[type="checkbox"]').forEach(chk=>{
          chk.addEventListener('change', ()=>{
            const col = chk.getAttribute('data-col');
            if (chk.checked) colState.add(col); else colState.delete(col);
            renderHead(); renderRows(last.docs);
          });
        });
      }

      bindColsDropdown('fat-cols-btn','fat-cols-menu');

      // cabeçalho dinâmico
      function renderHead(){
        const ths = [];
        ths.push(`<th style="width:110px">Código</th>`);
        if (colState.has('data'))     ths.push(`<th style="width:160px">Data</th>`);
        if (colState.has('cliente'))  ths.push(`<th>Cliente</th>`);
        if (colState.has('telefone')) ths.push(`<th style="width:160px">Telefone</th>`);
        if (colState.has('total'))    ths.push(`<th class="txt-right" style="width:160px">Total (R$)</th>`);
        $('fat-head-row').innerHTML = ths.join('');
      }

      // defaults
      $('fat-dtini').value = firstOfMonth();
      $('fat-dtfim').value = todayISO();
      $('fat-ordby').value = 'data';
      $('fat-orddir').value = 'DESC';

      function buildFilters(){
        return {
          dtini: $('fat-dtini').value || null,
          dtfim: $('fat-dtfim').value || null,
          telefone: $('fat-telefone').value || null,
          cliforId: Number($('fat-cli-id').value || '') || null,
          empresaId: Number($('fat-emp-id').value || '') || null,
          sortBy: $('fat-ordby').value,
          sortDir: $('fat-orddir').value
        };
      }

      let last = { docs: [], totalPeriodo: 0 };

      async function load(){
        try{
          const filters = buildFilters();
          const resp = await ipcRenderer.invoke('faturamento:listar', filters);
          last = { docs: Array.isArray(resp?.docs)?resp.docs:[], totalPeriodo: Number(resp?.totalPeriodo||0), filters };
          $('fat-total').textContent = moeda(last.totalPeriodo);
          renderHead();
          renderRows(last.docs);
        }catch(e){
          console.error(e);
          alert('Erro ao carregar: ' + (e?.message || e));
        }
      }

      function renderRows(rows){
        $('fat-docs').innerHTML = rows.length ? rows.map(r=>{
          const tds = [];
          tds.push(`<td>${r.codigo}</td>`);
          if (colState.has('data'))     tds.push(`<td>${toBr(r.data)}</td>`);
          if (colState.has('cliente'))  tds.push(`<td>${r.cliente||''}</td>`);
          if (colState.has('telefone')) tds.push(`<td>${r.telefone||''}</td>`);
          if (colState.has('total'))    tds.push(`<td class="txt-right">${moeda(r.total)}</td>`);
          return `<tr>${tds.join('')}</tr>`;
        }).join('') : `<tr><td colspan="${1 + colState.size}" class="muted">Sem documentos</td></tr>`;
      }

      // ações
      $('fat-aplicar').onclick = load;
      $('fat-limpar').onclick = ()=>{
        $('fat-dtini').value = firstOfMonth();
        $('fat-dtfim').value = todayISO();
        $('fat-telefone').value = '';
        $('fat-cli').value = ''; $('fat-cli-id').value = '';
        $('fat-emp').value = ''; $('fat-emp-id').value = '';
        $('fat-ordby').value='data'; $('fat-orddir').value='DESC';
        colState.clear(); ['data','cliente','telefone','total'].forEach(c=>colState.add(c));
        load();
      };

      // PDF respeitando colunas
      $('fat-pdf').onclick = ()=>{
        const { docs, totalPeriodo, filters } = last;
        const cols = ['codigo', ...Array.from(colState)];
        const head = [];
        if (cols.includes('codigo'))  head.push(`<th style="width:90px">Código</th>`);
        if (cols.includes('data'))    head.push(`<th style="width:120px">Data</th>`);
        if (cols.includes('cliente')) head.push(`<th>Cliente</th>`);
        if (cols.includes('telefone'))head.push(`<th style="width:130px">Telefone</th>`);
        if (cols.includes('total'))   head.push(`<th class="right" style="width:130px">Total (R$)</th>`);

        const rows = docs.length ? docs.map(r=>{
          const t = [];
          if (cols.includes('codigo'))  t.push(`<td>${r.codigo}</td>`);
          if (cols.includes('data'))    t.push(`<td>${new Date(r.data).toLocaleDateString('pt-BR')}</td>`);
          if (cols.includes('cliente')) t.push(`<td>${r.cliente||''}</td>`);
          if (cols.includes('telefone'))t.push(`<td>${r.telefone||''}</td>`);
          if (cols.includes('total'))   t.push(`<td class="right">${moeda(r.total)}</td>`);
          return `<tr>${t.join('')}</tr>`;
        }).join('') : `<tr><td colspan="${cols.length}" class="muted">Sem documentos</td></tr>`;

        const filtroDe  = filters?.dtini ? filters.dtini.split('-').reverse().join('/') : '';
        const filtroAte = filters?.dtfim ? filters.dtfim.split('-').reverse().join('/') : '';

        const html = `
          <html><head><meta charset="utf-8"/><title>Relatório de Faturamento</title>
            <style>
              @page{size:A4;margin:18mm 14mm}
              body{font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#0f2544}
              h1{font-size:20px;margin:0 0 4px 0}
              .muted{color:#6b7a90}
              .cap{font-size:12px;margin:2px 0 14px 0}
              .total{font-size:30px;font-weight:800;margin:10px 0 14px 0;color:#10253f}
              table{width:100%;border-collapse:separate;border-spacing:0}
              thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:8px;text-align:left}
              td{border-bottom:1px solid #eef2f7;padding:8px}
              .right{text-align:right}
            </style>
          </head><body>
            <h1>Relatório de Faturamento</h1>
            <div class="cap muted">De: <b>${filtroDe}</b> • Até: <b>${filtroAte}</b> • Ordenado por: <b>${filters.sortBy}/${filters.sortDir}</b></div>
            <div class="total">${moeda(totalPeriodo)}</div>
            <table><thead><tr>${head.join('')}</tr></thead><tbody>${rows}</tbody></table>
          </body></html>`;
        const w = window.open('', '_blank'); w.document.write(html); w.document.close();
        setTimeout(()=>{ try{w.focus();w.print();} finally{w.close();} }, 300);
      };

      // lookup F8
      const wire = (btn, input, ent) => { $(btn).onclick = ()=> (typeof openLookup==='function'
        ? openLookup(ent, ({id,label})=>{ $(input).value=label; const hid=document.getElementById($(input).getAttribute('data-target-id')); if(hid) hid.value=String(id); })
        : alert('Lookup não disponível')); };
      wire('fat-cli-lupa','fat-cli','clientes');
      wire('fat-emp-lupa','fat-emp','empresas');
      window.addEventListener('keydown',(ev)=>{ if(ev.key==='F8'){ ev.preventDefault(); const a=document.activeElement; if(a&&a.id==='fat-cli') $('fat-cli-lupa').click(); else $('fat-emp-lupa').click(); } });

      // primeira carga
      load();
    }
  };
};
