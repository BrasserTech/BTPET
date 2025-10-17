// src/renderer/views/dashboard.js
// UI do Dashboard (somente dados do banco). Botão "Sincronizar Sheets" + auto-sync 1 min.
// Status: "Linhas lidas: X | novas: Y | atualizadas: Z | erros: W".

window.renderDashboard = function () {
  return {
    title: 'Dashboard',
    html: `
      <style>
        .dash-toolbar{display:grid;grid-template-columns:repeat(5,minmax(220px,1fr)) auto;gap:12px;align-items:end;margin-bottom:12px}
        .dash-summary{
          background:#f5f8fe;border:1px solid #e6eef9;border-radius:12px;
          padding:10px 12px;color:#0f2544;display:flex;gap:16px;align-items:center;flex-wrap:wrap
        }
        .kpi-pill{background:#fff;border:1px solid #dfe7f7;border-radius:999px;padding:6px 10px;font-weight:700}
        .label{font-size:12px;color:#64748b;margin-bottom:4px;display:block}

        .dash-grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:320px;gap:16px}
        @media (max-width:1100px){ .dash-grid{grid-template-columns:1fr} }

        .chart-card{
          background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06);
          display:flex;flex-direction:column;min-height:0
        }
        .chart-title{font-weight:800;color:#0f2544;padding:10px 12px 4px}
        .chart-wrap{flex:1;min-height:0;padding:8px}
        .chart-wrap canvas{width:100%;height:100%}

        .card-mini{background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06); margin-top:16px}
        .tbl{width:100%;border-collapse:separate;border-spacing:0}
        .tbl thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:10px;text-align:left}
        .tbl td{border-bottom:1px solid #eef2f7;padding:10px}
        .muted{color:#6b7280}
        .input,.select{width:100%}
        .btn-sync{white-space:nowrap}
      </style>

      <div class="card">
        <div class="dash-toolbar">
          <div>
            <label class="label">Início</label>
            <input id="dt-inicio" class="input" type="date" />
          </div>
          <div>
            <label class="label">Fim</label>
            <input id="dt-fim" class="input" type="date" />
          </div>
          <div>
            <label class="label">Atalho</label>
            <select id="kpi-atalho" class="select">
              <option>Últimos 3 meses</option>
              <option selected>Últimos 6 meses</option>
              <option>Últimos 12 meses</option>
            </select>
          </div>
          <div>
            <label class="label">Origem</label>
            <select id="kpi-origem" class="select">
              <option value="Todos" selected>Todos</option>
              <option value="WhatsApp">WhatsApp (Sheets)</option>
              <option value="App">App (manual)</option>
            </select>
          </div>
          <div>
            <button class="button" id="btn-reload">Atualizar</button>
          </div>
          <div>
            <button class="button btn-sync" id="btn-sync">Sincronizar Sheets</button>
          </div>
        </div>

        <div class="dash-summary">
          <span>Total no período: <b id="sum-fat">--</b></span>
          <span class="kpi-pill">Pedidos: <span id="sum-ped">--</span></span>
          <span class="kpi-pill" id="gs-status">Pronto</span>
        </div>
      </div>

      <div class="dash-grid" style="margin-top:12px">
        <div class="chart-card">
          <div class="chart-title">Total no período</div>
          <div class="chart-wrap"><canvas id="ch-receita"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-title">Quantidade de pedidos no período</div>
          <div class="chart-wrap"><canvas id="ch-qtd"></canvas></div>
        </div>
      </div>

      <div class="card-mini">
        <div class="chart-title" style="padding:12px">Últimos pedidos (somente banco sincronizado)</div>
        <div style="padding:0 12px 12px">
          <table class="tbl">
            <thead>
              <tr>
                <th style="width:180px">Data</th>
                <th>Cliente</th>
                <th style="width:160px">Status</th>
                <th style="width:160px">Total (R$)</th>
                <th style="width:180px">Origem</th>
              </tr>
            </thead>
            <tbody id="gs-last"></tbody>
          </table>
        </div>
      </div>
    `,
    afterRender() {
      const { ipcRenderer } = require('electron');

      // helpers
      function moneyBR(n){ return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
      function clearCanvas(cv){
        const ctx=cv.getContext('2d');
        const r=cv.getBoundingClientRect();
        cv.width=Math.max(300,Math.floor(r.width));
        cv.height=Math.max(200,Math.floor(r.height));
        ctx.clearRect(0,0,cv.width,cv.height);
        return ctx;
      }
      function drawBars(cv,labels,values){
        const ctx=clearCanvas(cv); const W=cv.width,H=cv.height,pad=36,base=H-pad;
        const max=Math.max(1,Math.max(...values.map(v=>+v||0)));
        const bw=Math.max(10,(W-pad*2)/Math.max(1,labels.length*1.3));
        ctx.strokeStyle='#e5eaf3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad,base+.5);ctx.lineTo(W-pad,base+.5);ctx.stroke();
        labels.forEach((lb,i)=>{const v=+values[i]||0;const x=pad+i*(bw*1.3);const h=Math.round((v/max)*(H-pad*2));
          ctx.fillStyle='#0ea5e9';ctx.fillRect(x,base-h,bw,h);
          ctx.fillStyle='#475569';ctx.font='12px ui-sans-serif, system-ui';ctx.textAlign='center';ctx.fillText(lb,x+bw/2,H-10);
        });
        ctx.fillStyle='#0f172a';ctx.font='12px ui-sans-serif, system-ui';ctx.textAlign='center';
        labels.forEach((_,i)=>{const v=+values[i]||0;const x=pad+i*(bw*1.3)+bw/2;const h=Math.round((v/max)*(H-pad*2));const y=base-h-6;
          if(h>14) ctx.fillText(String(v).replace('.',','),x,y);
        });
      }
      function drawLine(cv, labels, values){
        const ctx=clearCanvas(cv); const W=cv.width,H=cv.height,pad=36,base=H-pad;
        const max=Math.max(1,Math.max(...values.map(v=>+v||0))); const step=Math.max(10,(W-pad*2)/Math.max(1,labels.length-1));
        ctx.strokeStyle='#e5eaf3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad,base+.5);ctx.lineTo(W-pad,base+.5);ctx.stroke();
        ctx.strokeStyle='#2563eb';ctx.lineWidth=2;ctx.beginPath();
        values.forEach((v,i)=>{const x=pad+i*step; const y=base-Math.round(((+v||0)/max)*(H-pad*2)); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);});
        ctx.stroke(); ctx.fillStyle='#2563eb';
        values.forEach((v,i)=>{const x=pad+i*step; const y=base-Math.round(((+v||0)/max)*(H-pad*2)); ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();});
        ctx.fillStyle='#475569';ctx.font='12px ui-sans-serif, system-ui';ctx.textAlign='center';
        labels.forEach((lb,i)=>{const x=pad+i*step;ctx.fillText(lb,x,H-10);});
      }
      function formatDateBR(isoOrDate){
        try {
          const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate);
          return d.toLocaleString('pt-BR');
        } catch { return '—'; }
      }

      // refs
      const dtInicio = document.getElementById('dt-inicio');
      const dtFim    = document.getElementById('dt-fim');
      const atalho   = document.getElementById('kpi-atalho');
      const origemEl = document.getElementById('kpi-origem');
      const btnReload= document.getElementById('btn-reload');
      const btnSync  = document.getElementById('btn-sync');

      const sumF  = document.getElementById('sum-fat');
      const sumP  = document.getElementById('sum-ped');
      const gsStatus = document.getElementById('gs-status');

      const cvRec = document.getElementById('ch-receita');
      const cvQtd = document.getElementById('ch-qtd');
      const gsLast= document.getElementById('gs-last');

      // estado local
      let cache = { labels: [], receita: [], pedidos: [] };
      function render() {
        drawLine(cvRec, cache.labels, cache.receita.map(v=>Number(v).toFixed(0)));
        drawBars(cvQtd, cache.labels, cache.pedidos.map(v=>Number(v).toFixed(0)));
      }

      function periodParams() {
        return {
          inicio: dtInicio.value ? new Date(dtInicio.value).toISOString() : undefined,
          fim:    dtFim.value    ? new Date(dtFim.value).toISOString()    : undefined,
          atalho: atalho.value,
          origem: origemEl.value
        };
      }

      async function carregar() {
        try {
          const params = periodParams();

          const fatQty = await ipcRenderer.invoke('dashboard:fat-qty', params);
          cache.labels   = fatQty.labels || [];
          cache.receita  = fatQty.faturamento || [];
          cache.pedidos  = fatQty.pedidos || [];
          sumF.textContent = moneyBR(fatQty.totalFaturamento || 0);
          sumP.textContent = String(fatQty.totalPedidos || 0);
          render();

          const last = await ipcRenderer.invoke('dashboard:last', params);
          renderLast(last);

          gsStatus.textContent = 'Pronto';
        } catch (err) {
          (window.toast || console.error)('Erro no dashboard: ' + (err && (err.message || err)));
          gsStatus.textContent = 'Erro ao carregar';
        }
      }

      function renderLast(rows){
        const data = (rows || []).slice(0,20);
        if (!data.length) {
          gsLast.innerHTML = '<tr><td colspan="5" class="muted">Sem registros</td></tr>';
          return;
        }
        gsLast.innerHTML = data.map(r =>
          '<tr>' +
            '<td>' + formatDateBR(r.data) + '</td>' +
            '<td>' + (r.cliente || '') + '</td>' +
            '<td>' + (r.status || '') + '</td>' +
            '<td>' + moneyBR(r.total || 0) + '</td>' +
            '<td>' + (r.origem || '') + '</td>' +
          '</tr>'
        ).join('');
      }

      async function syncNow() {
        try {
          gsStatus.textContent = 'Sincronizando…';
          const res = await ipcRenderer.invoke('sheets:sync-now');
          const lidas = res?.lidas ?? 0;
          const novas = res?.novas ?? 0;
          const atual = res?.atualizadas ?? 0;
          const erros = res?.erros ?? 0;
          gsStatus.textContent = `Linhas lidas: ${lidas} | novas: ${novas} | atualizadas: ${atual} | erros: ${erros}`;
        } catch (e) {
          gsStatus.textContent = 'Falha ao sincronizar';
        } finally {
          carregar();
        }
      }

      btnReload.addEventListener('click', carregar);
      btnSync.addEventListener('click', syncNow);
      [dtInicio, dtFim, atalho, origemEl].forEach(el => el.addEventListener('change', carregar));

      // inicial
      carregar();

      // auto-sync a cada 1 minuto
      setInterval(syncNow, 60 * 1000);

      let t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(render, 120); });
    }
  };
};
