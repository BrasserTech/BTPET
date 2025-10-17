// ===============================
// src/renderer/views/monitor-pedidos.js
// ===============================
// Tela de monitoramento em tempo real (via banco)
window.renderMonitorPedidos = function () {
  return {
    title: 'Monitor de Pedidos',
    html: `
      <style>
        .mon-wrap{display:flex;flex-direction:column;gap:16px}
        .mon-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .card{background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06);padding:14px}
        .card h4{margin:0 0 4px;color:#64748b;font-weight:700}
        .card .val{font-size:34px;font-weight:900}
        .kpi-prep{border-top:4px solid #2563eb;background:linear-gradient(0deg,#f4f8ff,#fff)}
        .kpi-saiu{border-top:4px solid #0891b2;background:linear-gradient(0deg,#f0fbff,#fff)}
        .kpi-done{border-top:4px solid #1d4ed8}
        .toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .muted{color:#6b7280}
        .tbl{width:100%;border-collapse:separate;border-spacing:0}
        .tbl thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:10px;text-align:left}
        .tbl td{border-bottom:1px solid #eef2f7;padding:10px;vertical-align:top}
        .pill{padding:6px 10px;border-radius:999px;font-weight:700;font-size:12px;display:inline-block}
        .st-1{background:#eff6ff;color:#2563eb;border:1px solid rgba(37,99,235,.35)}
        .st-2{background:#ecfeff;color:#0891b2;border:1px solid rgba(8,145,178,.35)}
        .st-3{background:#eef2ff;color:#4338ca;border:1px solid rgba(67,56,202,.35)}
        .sub{color:#64748b;font-size:12px}
        .sel{appearance:none;border:1px solid #dbe1f1;border-radius:8px;padding:6px 8px}
      </style>

      <div class="mon-wrap">
        <div class="toolbar card">
          <div class="muted">Exibição</div>
          <label><input type="checkbox" id="mon-apenas-hoje" checked /> Apenas hoje</label>
          <span class="muted">Atualiza a cada 5s</span>
          <button class="button" id="mon-reload">Atualizar agora</button>
        </div>

        <div class="mon-kpis">
          <div class="card kpi-done">
            <h4>Pedidos finalizados</h4>
            <div class="val" id="kpi-done">0</div>
          </div>
          <div class="card kpi-prep">
            <h4>Em preparo</h4>
            <div class="val" id="kpi-prep">0</div>
          </div>
          <div class="card kpi-saiu">
            <h4>Saiu para entrega</h4>
            <div class="val" id="kpi-saiu">0</div>
          </div>
        </div>

        <div class="card">
          <h4 style="margin:0 0 8px">Fila de pedidos</h4>
          <div class="muted" id="mon-info" style="margin-bottom:8px;display:none"></div>
          <div class="muted" id="mon-erro" style="margin-bottom:8px;color:#b91c1c;display:none"></div>

          <table class="tbl">
            <thead>
              <tr>
                <th style="width:80px">Hora</th>
                <th>Cliente</th>
                <th>Itens do pedido</th>
                <th style="width:60px">Qtd</th>
                <th>Contato</th>
                <th>Endereço</th>
                <th style="width:190px">Status</th>
                <th style="width:120px">Total (R$)</th>
                <th style="width:140px">Ações</th>
              </tr>
            </thead>
            <tbody id="mon-tbody"></tbody>
          </table>
        </div>
      </div>
    `,
    afterRender() {
      const { ipcRenderer } = require('electron');
      const $ = (id)=>document.getElementById(id);
      const money = (n)=> (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

      let dataset = [];
      let timer;

      function toast(msg, err=false){
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = `position:fixed;right:16px;bottom:16px;background:${err?'#fee2e2':'#ecfeff'};border:1px solid #e5eaf0;border-radius:10px;padding:8px 12px;box-shadow:0 8px 22px rgba(15,23,42,.08);z-index:9999;color:#0f172a`;
        document.body.appendChild(t);
        setTimeout(()=>t.remove(),3000);
      }

      function statusPill(code){
        if (code==='1') return '<span class="pill st-1">Em preparo</span>';
        if (code==='2') return '<span class="pill st-2">Saiu para entrega</span>';
        if (code==='3') return '<span class="pill st-3">Pronto</span>';
        return '<span class="pill">—</span>';
      }

      function render(){
        const tBody = $('mon-tbody');
        tBody.innerHTML = '';

        const ordenado = [...dataset].sort((a,b)=> new Date(b.horaRaw||0) - new Date(a.horaRaw||0));

        if (!ordenado.length){
          $('mon-info').style.display='block';
          $('mon-info').textContent='Nenhum pedido em andamento para o filtro atual.';
        } else {
          $('mon-info').style.display='none';
        }

        ordenado.forEach(p=>{
          const tr = document.createElement('tr');
          const clienteNome = p.cliente || '';
          const clienteContato = p.contato || '';

          // ==================================================================
          // ALTERAÇÃO PRINCIPAL AQUI
          // Decide o que renderizar na coluna de ações com base na flag 'clienteExiste'
          // ==================================================================
          const acaoHtml = p.clienteExiste
            ? `<span class="sub" style="font-style:italic;">Já cadastrado</span>`
            : `<button
                class="button outline mon-create-client"
                data-nome="${clienteNome}"
                data-contato="${clienteContato}"
                style="padding: 4px 8px; font-size: 12px;"
                title="Deseja criar o cadastro do cliente?"
              >
                Criar Cadastro
              </button>`;

          tr.innerHTML = `
            <td>${p.hora || '—'}</td>
            <td>${clienteNome}</td>
            <td><div>${p.item || '—'}</div><div class="sub">Obs: ${p.observacao||'—'}</div></td>
            <td>${p.qtd || 1}</td>
            <td>${clienteContato}</td>
            <td>${p.local || '—'}</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center">
                ${statusPill(p.statusCode)}
                <select class="sel mon-status" data-id="${p.id}">
                  <option value="1" ${p.statusCode==='1'?'selected':''}>Em preparo</option>
                  <option value="2" ${p.statusCode==='2'?'selected':''}>Saiu para entrega</option>
                  <option value="3" ${p.statusCode==='3'?'selected':''}>Pronto</option>
                </select>
              </div>
            </td>
            <td>${money(p.valor)}</td>
            <td>${acaoHtml}</td>
          `;
          tBody.appendChild(tr);
        });
      }

      async function load(){
        try{
          $('mon-erro').style.display='none';
          const apenasHoje = $('mon-apenas-hoje').checked;
          const resp = await ipcRenderer.invoke('monitor:list', { apenasHoje, fallback: 20 });
          if (!resp?.ok) throw new Error(resp?.error || 'Falha ao listar pedidos');
          dataset = resp.data || [];

          // KPIs
          $('kpi-done').textContent = resp.kpi?.totalPronto ?? 0;
          $('kpi-prep').textContent = resp.kpi?.emPreparo ?? 0;
          $('kpi-saiu').textContent = resp.kpi?.saiuEntrega ?? 0;

          render();
        }catch(err){
          $('mon-erro').textContent = 'Erro: ' + (err?.message || err);
          $('mon-erro').style.display = 'block';
        }
      }

      async function onChangeStatus(e){
        if (!e.target.classList.contains('mon-status')) return;
        const el = e.target;
        const id = el.dataset.id;
        const status = el.value;
        el.disabled = true;
        try{
          const r = await ipcRenderer.invoke('monitor:update-status', { id, status });
          if (!r?.ok) throw new Error(r?.error || 'Falha na atualização');
          const idx = dataset.findIndex(x => String(x.id) === String(id));
          if (idx >= 0) dataset[idx].statusCode = String(status);
          render();
        }catch(err){
          $('mon-erro').textContent = 'Erro ao atualizar status: ' + (err?.message || err);
          $('mon-erro').style.display = 'block';
        }finally{
          el.disabled = false;
        }
      }

      async function onCreateClient(e) {
        const btn = e.target.closest('.mon-create-client');
        if (!btn) return;

        const nome = btn.dataset.nome;
        const telefone = btn.dataset.contato;

        if (!nome || !telefone) {
          toast('Nome ou telefone do cliente não encontrado no pedido.', true);
          return;
        }

        const confirmed = confirm(`Deseja criar um novo cadastro de cliente?\n\nNome: ${nome}\nTelefone: ${telefone}`);
        if (!confirmed) return;

        btn.disabled = true;
        btn.textContent = 'Aguarde...';

        try {
          const resp = await ipcRenderer.invoke('clientes:create-from-pedido', { nome, telefone });
          if (!resp?.ok) throw new Error(resp?.error || 'Ocorreu um erro desconhecido.');
          toast(`Cliente "${nome}" cadastrado com sucesso!`);
          
          // Recarrega a lista para que a mudança (botão sumir) apareça imediatamente
          load();

        } catch (err) {
          toast(`Erro ao cadastrar cliente: ${err.message}`, true);
          btn.disabled = false;
          btn.textContent = 'Criar Cadastro';
        }
      }

      // Adiciona um único listener na tabela para tratar os dois tipos de eventos
      $('mon-tbody').addEventListener('click', onCreateClient);
      $('mon-tbody').addEventListener('change', onChangeStatus);

      $('mon-reload').addEventListener('click', load);
      $('mon-apenas-hoje').addEventListener('change', load);

      // primeira carga + auto refresh
      load();
      clearInterval(timer);
      timer = setInterval(load, 5000);
    }
  };
};