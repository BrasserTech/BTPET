// src/renderer/views/relatorio-fat-por-cliente.js
// Faturamento por Cliente — expansão por cliente/pedido/itens e PDF com dois modos: Resumo ou Expandido (cascata de itens por cliente).

window.renderRelFatPorCliente = function () {
  return {
    title: 'Relatório: Faturamento por Cliente',
    html: `
      <style>
        .rep-shell{background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06)}
        .rep-head{padding:16px 16px 8px 16px}
        .rep-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px}
        @media (max-width:1100px){ .rep-grid{grid-template-columns:repeat(6,1fr)} }
        @media (max-width:700px){ .rep-grid{grid-template-columns:repeat(2,1fr)} }
        .rep-actions{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
        .card{border-top:1px solid #eef2f7;padding:16px}
        .tbl{width:100%;border-collapse:separate;border-spacing:0}
        .tbl thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:10px;text-align:left;color:#10253f}
        .tbl td{border-bottom:1px solid #eef2f7;padding:10px}
        .txt-right{text-align:right}
        .muted{color:#6b7a90}

        .exp-btn{width:26px;height:26px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer}
        .exp-btn span{display:inline-block;transition:transform .18s ease}
        .row-click{cursor:pointer}
        .subrow{background:#fbfdff}
        .subbox{border:1px dashed #e2e8f0;border-radius:10px;padding:10px;background:#fff}
        .subtbl thead th{background:#f8fafc}
        .chip{display:inline-flex;gap:6px;align-items:center;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px}
        .dropdown{position:relative;display:inline-block}
        .dropdown-menu{position:absolute;z-index:10;top:calc(100% + 6px);left:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 18px rgba(21,78,210,.06);padding:10px;min-width:240px}
        .dropdown-menu label{display:flex;gap:8px;align-items:center;padding:4px 2px}
      </style>

      <div class="rep-shell">
        <div class="rep-head">
          <div class="rep-grid">
            <div style="grid-column: span 2">
              <label class="label">De</label>
              <input id="fpc-dtini" type="date" class="input"/>
            </div>
            <div style="grid-column: span 2">
              <label class="label">Até</label>
              <input id="fpc-dtfim" type="date" class="input"/>
            </div>
            <div style="grid-column: span 3">
              <label class="label">Telefone (opcional)</label>
              <input id="fpc-telefone" type="text" class="input" placeholder="Digite o número ou parte dele"/>
            </div>
            <div style="grid-column: span 3">
              <label class="label">Cliente (opcional)</label>
              <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                <input id="fpc-cli" class="input" placeholder="F8 para pesquisar" data-lookup="clientes" data-target-id="fpc-cli-id"/>
                <button id="fpc-cli-lupa" class="button outline" title="Pesquisar (F8)">🔎</button>
              </div>
              <input id="fpc-cli-id" type="hidden"/>
            </div>
            <div style="grid-column: span 2">
              <label class="label">Empresa (opcional)</label>
              <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                <input id="fpc-emp" class="input" placeholder="F8 para pesquisar" data-lookup="empresas" data-target-id="fpc-emp-id"/>
                <button id="fpc-emp-lupa" class="button outline" title="Pesquisar (F8)">🔎</button>
              </div>
              <input id="fpc-emp-id" type="hidden"/>
            </div>

            <div style="grid-column: span 2">
              <label class="label">Ordenar por</label>
              <select id="fpc-ordby" class="input">
                <option value="total">Valor</option>
                <option value="cliente">Cliente</option>
                <option value="telefone">Telefone</option>
                <option value="qtd">Qtd. Pedidos</option>
              </select>
            </div>
            <div style="grid-column: span 2">
              <label class="label">Direção</label>
              <select id="fpc-orddir" class="input">
                <option value="DESC">Maior → menor</option>
                <option value="ASC">Menor → maior</option>
              </select>
            </div>

            <div style="grid-column: span 3">
              <label class="label">Campos</label>
              <div class="dropdown">
                <button id="fpc-cols-btn" class="chip">Escolher colunas</button>
                <div id="fpc-cols-menu" class="dropdown-menu" style="display:none">
                  <label><input type="checkbox" data-col="cliente"  checked> Cliente</label>
                  <label><input type="checkbox" data-col="telefone" checked> Telefone</label>
                  <label><input type="checkbox" data-col="qtd"      checked> Qtd. Pedidos</label>
                  <label><input type="checkbox" data-col="total"    checked> Total (R$)</label>
                </div>
              </div>
            </div>

            <div style="grid-column: span 3">
              <label class="label">Modo do PDF</label>
              <select id="fpc-pdf-modo" class="input" title="Escolha o tipo de emissão do PDF">
                <option value="resumo">Resumo (totais por cliente)</option>
                <option value="expandido">Expandido (cliente → itens)</option>
              </select>
            </div>
          </div>

          <div class="rep-actions">
            <button id="fpc-aplicar" class="button">Aplicar</button>
            <button id="fpc-limpar" class="button outline">Limpar</button>
            <button id="fpc-pdf" class="button outline">Baixar PDF</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 8px 0">Totais por Cliente</h3>
          <table class="tbl">
            <thead>
              <tr id="fpc-head-row"></tr>
            </thead>
            <tbody id="fpc-resumo"></tbody>
          </table>
        </div>
      </div>
    `,
    afterRender() {
      const { ipcRenderer } = require('electron');

      const $ = (id)=>document.getElementById(id);
      const moeda = (n)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const todayISO = () => new Date().toISOString().slice(0,10);
      const firstOfMonth = () => { const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); };
      const toBr = (s)=>{ const d=new Date(s); return isNaN(d)?'':d.toLocaleDateString('pt-BR'); };

      // Colunas visíveis do quadro de resumo (tela e também cabeçalho do PDF)
      const colState = new Set(['cliente','telefone','qtd','total']);

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
            renderHead(); renderResumo(last.resumo);
          });
        });
      }
      bindColsDropdown('fpc-cols-btn','fpc-cols-menu');

      function renderHead(){
        const ths = ['<th style="width:40px"></th>']; // botão expandir
        if (colState.has('cliente'))  ths.push('<th>Cliente</th>');
        if (colState.has('telefone')) ths.push('<th style="width:160px">Telefone</th>');
        if (colState.has('qtd'))      ths.push('<th class="txt-right" style="width:160px">Qtd. Pedidos</th>');
        if (colState.has('total'))    ths.push('<th class="txt-right" style="width:180px">Total (R$)</th>');
        $('fpc-head-row').innerHTML = ths.join('');
      }

      // Defaults
      $('fpc-dtini').value = firstOfMonth();
      $('fpc-dtfim').value  = todayISO();
      $('fpc-ordby').value  = 'total';
      $('fpc-orddir').value = 'DESC';
      $('fpc-pdf-modo').value = 'resumo';

      function buildFilters(){
        return {
          dtini: $('fpc-dtini').value || null,
          dtfim: $('fpc-dtfim').value || null,
          telefone: $('fpc-telefone').value || null,
          cliforId: Number($('fpc-cli-id').value || '') || null,
          empresaId: Number($('fpc-emp-id').value || '') || null,
          sortBy: $('fpc-ordby').value,
          sortDir: $('fpc-orddir').value
        };
      }

      let last = { resumo: [], filters: {} };
      const expanded = new Map();   // cliente -> { loaded, rows:[{codigo,data,total}] }
      const itemsCache = new Map(); // pedidoId -> itens[]

      async function load(){
        const filters = buildFilters();
        const resp = await ipcRenderer.invoke('relfatcliente:listar', filters);
        last = { resumo: Array.isArray(resp?.resumo)?resp.resumo:[], filters };
        expanded.clear(); itemsCache.clear();
        renderHead();
        renderResumo(last.resumo);
      }

      function renderResumo(rows){
        const tbody = $('fpc-resumo');
        if (!rows.length){
          tbody.innerHTML = `<tr><td colspan="${1 + colState.size}" class="muted">Sem dados</td></tr>`;
          return;
        }
        tbody.innerHTML = rows.map(r=>{
          const k = String(r.chaveclifor ?? '');
          const tds = [];
          tds.push(`<td><button class="exp-btn" data-toggle="${k}" title="Expandir/Fechar"><span>▸</span></button></td>`);
          if (colState.has('cliente'))  tds.push(`<td>${r.cliente || '(Sem cliente)'}</td>`);
          if (colState.has('telefone')) tds.push(`<td>${r.telefone || ''}</td>`);
          if (colState.has('qtd'))      tds.push(`<td class="txt-right">${Number(r.qtd_pedidos||0)}</td>`);
          if (colState.has('total'))    tds.push(`<td class="txt-right">${moeda(r.total)}</td>`);
          return `<tr class="row-click" data-clifor="${k}">${tds.join('')}</tr>`;
        }).join('');

        tbody.querySelectorAll('[data-toggle]').forEach(btn=>{
          btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); toggleCliente(btn.getAttribute('data-toggle')); });
        });
        tbody.querySelectorAll('tr.row-click').forEach(tr=>{
          tr.addEventListener('click', ()=> toggleCliente(tr.getAttribute('data-clifor')));
        });
      }

      async function toggleCliente(clifor){
        if (!clifor) return;
        const tbody = $('fpc-resumo');
        const row = tbody.querySelector(`tr[data-clifor="${clifor}"]`);
        if (!row) return;
        const btn = row.querySelector('button[data-toggle]'); const icon = btn?.querySelector('span');

        const next = row.nextElementSibling;
        if (next && next.classList.contains('subrow')) { next.remove(); if (icon) icon.style.transform='rotate(0deg)'; return; }

        let cache = expanded.get(clifor);
        if (!cache || !cache.loaded) {
          const { docs } = await ipcRenderer.invoke('relfatcliente:docsByCliente', { ...last.filters, cliforId: Number(clifor) });
          cache = { loaded:true, rows: Array.isArray(docs)?docs:[] }; expanded.set(clifor, cache);
        }

        const pedidosRows = cache.rows.length
          ? cache.rows.map(d => `
              <tr class="ped-row" data-ped="${d.codigo}">
                <td style="width:40px">
                  <button class="exp-btn" data-toggle-ped="${d.codigo}" title="Itens do pedido"><span>▸</span></button>
                </td>
                <td style="width:120px">${d.codigo}</td>
                <td style="width:160px">${toBr(d.data)}</td>
                <td class="txt-right" style="width:180px">${moeda(d.total)}</td>
              </tr>
            `).join('')
          : `<tr><td colspan="4" class="muted">Sem pedidos no período</td></tr>`;

        const htmlSub = `
          <tr class="subrow">
            <td colspan="${1 + colState.size}">
              <div class="subbox">
                <table class="tbl subtbl">
                  <thead>
                    <tr>
                      <th style="width:40px"></th>
                      <th style="width:110px">Código</th>
                      <th style="width:160px">Data</th>
                      <th class="txt-right" style="width:180px">Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody>${pedidosRows}</tbody>
                </table>
              </div>
            </td>
          </tr>
        `;
        row.insertAdjacentHTML('afterend', htmlSub);
        if (icon) icon.style.transform='rotate(90deg)';

        // bind para itens
        const subTbody = row.nextElementSibling.querySelector('tbody');
        subTbody.querySelectorAll('[data-toggle-ped]').forEach(b=>{
          b.addEventListener('click', async (ev)=>{
            ev.stopPropagation();
            const id = Number(b.getAttribute('data-toggle-ped'));
            await toggleItens(subTbody, id, b);
          });
        });
      }

      async function toggleItens(containerTbody, pedidoId, buttonEl){
        const icon = buttonEl?.querySelector('span');
        const pedTr = containerTbody.querySelector(`tr.ped-row[data-ped="${pedidoId}"]`);
        const next = pedTr?.nextElementSibling;
        if (next && next.classList.contains('items-row')) {
          next.remove(); if (icon) icon.style.transform='rotate(0deg)'; return;
        }

        let itens = itemsCache.get(pedidoId);
        if (!itens) {
          const resp = await ipcRenderer.invoke('relfatcliente:itensByPedido', { pedidoId });
          itens = Array.isArray(resp?.itens) ? resp.itens : [];
          itemsCache.set(pedidoId, itens);
        }

        const itensHTML = itens.length
          ? itens.map(it => `
              <tr>
                <td colspan="2"></td>
                <td>${it.produto}</td>
                <td class="txt-right">
                  ${Number(it.qtde).toLocaleString('pt-BR')} × ${moeda(it.valorunit)}
                  ${Number(it.desconto||0) ? ` (desc. ${moeda(it.desconto)})` : ''}
                  = <b>${moeda(it.total)}</b>
                </td>
              </tr>
            `).join('')
          : `<tr><td colspan="4" class="muted">Sem itens</td></tr>`;

        const rowHTML = `
          <tr class="items-row">
            <td colspan="4">
              <div class="subbox" style="background:#fdfefe">
                <table class="tbl subtbl">
                  <thead>
                    <tr>
                      <th style="width:40px"></th>
                      <th style="width:110px"></th>
                      <th>Produto</th>
                      <th class="txt-right" style="width:260px">Qtde × Vlr Un. (desc) = Total</th>
                    </tr>
                  </thead>
                  <tbody>${itensHTML}</tbody>
                </table>
              </div>
            </td>
          </tr>`;
        pedTr.insertAdjacentHTML('afterend', rowHTML);
        if (icon) icon.style.transform='rotate(90deg)';
      }

      $('fpc-aplicar').onclick = load;

      $('fpc-limpar').onclick = ()=>{
        $('fpc-dtini').value = firstOfMonth();
        $('fpc-dtfim').value  = todayISO();
        $('fpc-telefone').value = '';
        $('fpc-cli').value=''; $('fpc-cli-id').value='';
        $('fpc-emp').value=''; $('fpc-emp-id').value='';
        $('fpc-ordby').value='total'; $('fpc-orddir').value='DESC';
        $('fpc-pdf-modo').value='resumo';
        colState.clear(); ['cliente','telefone','qtd','total'].forEach(c=>colState.add(c));
        load();
      };

      // Emissão do PDF (Resumo ou Expandido em cascata de itens por cliente)
      $('fpc-pdf').onclick = async ()=>{
        const { resumo, filters } = last;
        const modo = $('fpc-pdf-modo').value; // 'resumo' | 'expandido'
        const cols = Array.from(colState);

        const filtroDe = filters?.dtini ? filters.dtini.split('-').reverse().join('/') : '';
        const filtroAte= filters?.dtfim ? filters.dtfim.split('-').reverse().join('/') : '';
        const filtroTel = filters?.telefone ? ` • Telefone: <b>${filters.telefone}</b>` : '';
        const filtroCli = filters?.cliforId ? ' • Cliente: <b>Filtrado</b>' : '';
        const filtroEmp = filters?.empresaId ? ' • Empresa: <b>Filtrada</b>' : '';

        const baseHead = `
          ${cols.includes('cliente') ? '<th>Cliente</th>' : ''}
          ${cols.includes('telefone') ? '<th style="width:130px">Telefone</th>' : ''}
          ${cols.includes('qtd') ? '<th class="right" style="width:120px">Qtd.</th>' : ''}
          ${cols.includes('total') ? '<th class="right" style="width:130px">Total (R$)</th>' : ''}
        `;

        const baseRows = (resumo && resumo.length)
          ? resumo.map(r => `
              <tr>
                ${cols.includes('cliente') ? `<td>${r.cliente||'(Sem cliente)'}</td>` : ''}
                ${cols.includes('telefone') ? `<td>${r.telefone||''}</td>` : ''}
                ${cols.includes('qtd') ? `<td class="right">${Number(r.qtd_pedidos||0)}</td>` : ''}
                ${cols.includes('total') ? `<td class="right">${moeda(r.total)}</td>` : ''}
              </tr>
            `).join('')
          : `<tr><td colspan="${cols.length||1}" class="muted">Sem dados</td></tr>`;

        // RESUMO: somente a tabela de totais
        if (modo === 'resumo') {
          const html = `
            <html><head><meta charset="utf-8"/><title>Relatório: Faturamento por Cliente</title>
            <style>
              @page{size:A4;margin:18mm 14mm}
              body{font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#0f2544}
              h1{font-size:20px;margin:0 0 4px 0}
              .muted{color:#6b7a90}
              .cap{font-size:12px;margin:2px 0 12px 0}
              table{width:100%;border-collapse:separate;border-spacing:0}
              thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:8px;text-align:left}
              td{border-bottom:1px solid #eef2f7;padding:8px}
              .right{text-align:right}
              .sec{border:1px solid #e8eef7;border-radius:10px;padding:10px 12px;margin-top:14px}
            </style></head><body>
              <h1>Relatório: Faturamento por Cliente</h1>
              <div class="cap muted">De: <b>${filtroDe}</b> • Até: <b>${filtroAte}</b>${filtroTel}${filtroCli}${filtroEmp} • Ordenado por: <b>${filters.sortBy}/${filters.sortDir}</b></div>
              <div class="sec">
                <h3 style="margin:0 0 6px 0">Totais por Cliente</h3>
                <table>
                  <thead><tr>${baseHead}</tr></thead>
                  <tbody>${baseRows}</tbody>
                </table>
              </div>
            </body></html>`;
          const w = window.open('', '_blank'); w.document.write(html); w.document.close();
          setTimeout(()=>{ try{w.focus();w.print();} finally{w.close();} }, 300);
          return;
        }

        // EXPANDIDO: para cada cliente, uma tabela única de ITENS (cascata), sem títulos repetidos
        // Busca sequencial por clareza e estabilidade.
        let blocosClientes = '';
        for (const cli of (resumo || [])) {
          const { docs } = await ipcRenderer.invoke('relfatcliente:docsByCliente', { ...filters, cliforId: Number(cli.chaveclifor) }) || { docs: [] };

          // Concatena todos os itens do cliente num único array, anotando pedido e data
          let itensCliente = [];
          for (const d of (docs || [])) {
            const { itens } = await ipcRenderer.invoke('relfatcliente:itensByPedido', { pedidoId: Number(d.codigo) }) || { itens: [] };
            (itens || []).forEach(it => {
              itensCliente.push({
                pedido: d.codigo,
                data: d.data,
                produto: it.produto,
                qtde: Number(it.qtde||0),
                vlr: Number(it.valorunit||0),
                desc: Number(it.desconto||0),
                total: Number(it.total||0)
              });
            });
          }

          // Ordena por data (desc), depois por pedido
          itensCliente.sort((a,b)=>{
            const da = new Date(a.data).getTime() || 0;
            const db = new Date(b.data).getTime() || 0;
            if (db !== da) return db - da;
            return Number(a.pedido) - Number(b.pedido);
          });

          const itensRows = itensCliente.length
            ? itensCliente.map(it => `
                <tr>
                  <td style="width:90px">${it.pedido}</td>
                  <td style="width:120px">${toBr(it.data)}</td>
                  <td>${it.produto}</td>
                  <td class="right" style="width:70px">${it.qtde.toLocaleString('pt-BR')}</td>
                  <td class="right" style="width:90px">${moeda(it.vlr)}</td>
                  <td class="right" style="width:90px">${moeda(it.desc)}</td>
                  <td class="right" style="width:110px"><b>${moeda(it.total)}</b></td>
                </tr>
              `).join('')
            : `<tr><td colspan="7" class="muted">Sem itens no período</td></tr>`;

          const subTot = itensCliente.reduce((s,x)=>s + (x.total||0), 0);

          // Cabeçalho sintético do cliente (uma única vez)
          const headerCli = `
            <table style="margin-top:6px">
              <thead><tr>${baseHead}</tr></thead>
              <tbody>
                <tr>
                  ${cols.includes('cliente') ? `<td>${cli.cliente||'(Sem cliente)'}</td>` : ''}
                  ${cols.includes('telefone') ? `<td>${cli.telefone||''}</td>` : ''}
                  ${cols.includes('qtd') ? `<td class="right">${Number(cli.qtd_pedidos||0)}</td>` : ''}
                  ${cols.includes('total') ? `<td class="right">${moeda(cli.total)}</td>` : ''}
                </tr>
              </tbody>
            </table>`;

          const tabelaItens = `
            <table style="margin-top:8px">
              <thead>
                <tr>
                  <th style="width:90px">Pedido</th>
                  <th style="width:120px">Data</th>
                  <th>Produto</th>
                  <th class="right" style="width:70px">Qtde</th>
                  <th class="right" style="width:90px">Vlr Un.</th>
                  <th class="right" style="width:90px">Desc.</th>
                  <th class="right" style="width:110px">Total</th>
                </tr>
              </thead>
              <tbody>${itensRows}</tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="right"><b>Subtotal do cliente</b></td>
                  <td class="right"><b>${moeda(subTot)}</b></td>
                </tr>
              </tfoot>
            </table>`;

          blocosClientes += `
            <div class="sec">
              ${headerCli}
              ${tabelaItens}
            </div>`;
        }

        const html = `
          <html><head><meta charset="utf-8"/><title>Relatório: Faturamento por Cliente (Expandido)</title>
          <style>
            @page{size:A4;margin:18mm 14mm}
            body{font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#0f2544}
            h1{font-size:20px;margin:0 0 4px 0}
            .muted{color:#6b7a90}
            .cap{font-size:12px;margin:2px 0 12px 0}
            table{width:100%;border-collapse:separate;border-spacing:0}
            thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:8px;text-align:left}
            td{border-bottom:1px solid #eef2f7;padding:8px}
            .right{text-align:right}
            .sec{border:1px solid #e8eef7;border-radius:10px;padding:10px 12px;margin-top:14px}
          </style></head><body>
            <h1>Relatório: Faturamento por Cliente (Expandido)</h1>
            <div class="cap muted">De: <b>${filtroDe}</b> • Até: <b>${filtroAte}</b>${filtroTel}${filtroCli}${filtroEmp} • Ordenado por: <b>${filters.sortBy}/${filters.sortDir}</b></div>

            <div class="sec">
              <h3 style="margin:0 0 6px 0">Totais por Cliente</h3>
              <table>
                <thead><tr>${baseHead}</tr></thead>
                <tbody>${baseRows}</tbody>
              </table>
            </div>

            ${blocosClientes || '<div class="sec muted">Sem clientes/pedidos no período</div>'}
          </body></html>`;
        const w = window.open('', '_blank'); w.document.write(html); w.document.close();
        setTimeout(()=>{ try{w.focus();w.print();} finally{w.close();} }, 300);
      };

      // Lookups e atalho F8
      const wire = (btn, input, ent)=>{ $(btn).onclick=()=> (typeof openLookup==='function'
        ? openLookup(ent, ({id,label})=>{ $(input).value=label; const hid=document.getElementById($(input).getAttribute('data-target-id')); if (hid) hid.value=String(id); })
        : alert('Lookup não disponível')); };
      wire('fpc-cli-lupa','fpc-cli','clientes');
      wire('fpc-emp-lupa','fpc-emp','empresas');

      window.addEventListener('keydown',(ev)=>{
        if(ev.key==='F8'){
          ev.preventDefault();
          const a=document.activeElement;
          if(a&&a.id==='fpc-cli') $('fpc-cli-lupa').click();
          else $('fpc-emp-lupa').click();
        }
      });

      // Primeira carga
      renderHead();
      load();
    }
  };
};
