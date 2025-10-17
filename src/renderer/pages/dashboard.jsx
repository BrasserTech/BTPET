import React, { useState, useEffect, useRef } from 'react';

// Suas funções helper podem ser movidas para fora do componente, pois não dependem de estado.
// Elas são puras e reutilizáveis.
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

function moneyBR(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDateBR(isoOrDate) {
  try {
    const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate);
    return d.toLocaleString('pt-BR');
  } catch { return '—'; }
}

// Suas funções de desenho de gráfico, adaptadas para receber o elemento canvas diretamente.
function drawBars(cv, labels, values) {
  if (!cv) return;
  const ctx=cv.getContext('2d'); const r=cv.getBoundingClientRect(); cv.width=Math.max(300,Math.floor(r.width)); cv.height=Math.max(200,Math.floor(r.height)); ctx.clearRect(0,0,cv.width,cv.height);
  const W=cv.width,H=cv.height,pad=36,base=H-pad; const max=Math.max(1,Math.max(...values.map(v=>+v||0))); const bw=Math.max(10,(W-pad*2)/Math.max(1,labels.length*1.3));
  ctx.strokeStyle='#e5eaf3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad,base+.5);ctx.lineTo(W-pad,base+.5);ctx.stroke();
  labels.forEach((lb,i)=>{const v=+values[i]||0;const x=pad+i*(bw*1.3);const h=Math.round((v/max)*(H-pad*2)); ctx.fillStyle='#0ea5e9';ctx.fillRect(x,base-h,bw,h); ctx.fillStyle='#475569';ctx.font='12px ui-sans-serif, system-ui';ctx.textAlign='center';ctx.fillText(lb,x+bw/2,H-10);});
  ctx.fillStyle='#0f172a';ctx.font='12px ui-sans-serif, system-ui';ctx.textAlign='center';
  labels.forEach((_,i)=>{const v=+values[i]||0;const x=pad+i*(bw*1.3)+bw/2;const h=Math.round((v/max)*(H-pad*2));const y=base-h-6; if(h>14) ctx.fillText(String(v).replace('.',','),x,y);});
}
function drawLine(cv, labels, values) {
  if (!cv) return;
  const ctx=cv.getContext('2d'); const r=cv.getBoundingClientRect(); cv.width=Math.max(300,Math.floor(r.width)); cv.height=Math.max(200,Math.floor(r.height)); ctx.clearRect(0,0,cv.width,cv.height);
  const W=cv.width,H=cv.height,pad=36,base=H-pad; const max=Math.max(1,Math.max(...values.map(v=>+v||0))); const step=Math.max(10,(W-pad*2)/Math.max(1,labels.length-1));
  ctx.strokeStyle='#e5eaf3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad,base+.5);ctx.lineTo(W-pad,base+.5);ctx.stroke(); ctx.strokeStyle='#2563eb';ctx.lineWidth=2;ctx.beginPath();
  values.forEach((v,i)=>{const x=pad+i*step; const y=base-Math.round(((+v||0)/max)*(H-pad*2)); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);});
  ctx.stroke(); ctx.fillStyle='#2563eb';
  values.forEach((v,i)=>{const x=pad+i*step; const y=base-Math.round(((+v||0)/max)*(H-pad*2)); ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle='#475569';ctx.font='12px ui-sans-serif, system-ui';ctx.textAlign='center';
  labels.forEach((lb,i)=>{const x=pad+i*step;ctx.fillText(lb,x,H-10);});
}


// O componente React
function Dashboard() {
  // --- ESTADO (useState) ---
  // Guarda os dados que, ao mudarem, devem atualizar a tela.
  const [filters, setFilters] = useState({ atalho: 'Últimos 6 meses', origem: 'Todos' });
  const [summary, setSummary] = useState({ faturamento: 0, pedidos: 0 });
  const [chartData, setChartData] = useState({ labels: [], receita: [], pedidos: [] });
  const [lastOrders, setLastOrders] = useState([]);
  const [syncStatus, setSyncStatus] = useState('Pronto');

  // --- REFERÊNCIAS (useRef) ---
  // Para acessar os elementos <canvas> diretamente para desenhar neles.
  const receitaCanvasRef = useRef(null);
  const qtdCanvasRef = useRef(null);

  // --- LÓGICA DE DADOS ---
  const carregarDados = async () => {
    if (!ipcRenderer) return;
    try {
      const params = { atalho: filters.atalho, origem: filters.origem };
      
      const fatQty = await ipcRenderer.invoke('dashboard:fat-qty', params);
      setChartData({
        labels: fatQty.labels || [],
        receita: fatQty.faturamento || [],
        pedidos: fatQty.pedidos || [],
      });
      setSummary({
        faturamento: fatQty.totalFaturamento || 0,
        pedidos: fatQty.totalPedidos || 0,
      });

      const last = await ipcRenderer.invoke('dashboard:last', params);
      setLastOrders(last || []);
      
    } catch (err) {
      console.error('Erro no dashboard:', err);
      setSyncStatus('Erro ao carregar');
    }
  };

  const syncNow = async () => {
    if (!ipcRenderer) return;
    try {
      setSyncStatus('Sincronizando…');
      const res = await ipcRenderer.invoke('sheets:sync-now');
      setSyncStatus(`Linhas lidas: ${res?.lidas ?? 0} | novas: ${res?.novas ?? 0} | atualizadas: ${res?.atualizadas ?? 0} | erros: ${res?.erros ?? 0}`);
    } catch (e) {
      setSyncStatus('Falha ao sincronizar');
    } finally {
      carregarDados();
    }
  };
  
  // --- EFEITOS (useEffect) ---

  // 1. Roda uma vez quando o componente é montado para carregar dados iniciais.
  useEffect(() => {
    carregarDados();
  }, []);

  // 2. Roda sempre que os dados dos gráficos (chartData) mudam, para redesenhá-los.
  useEffect(() => {
    drawLine(receitaCanvasRef.current, chartData.labels, chartData.receita.map(v => Number(v).toFixed(0)));
    drawBars(qtdCanvasRef.current, chartData.labels, chartData.pedidos.map(v => Number(v).toFixed(0)));
  }, [chartData]); // Dependência: re-executa quando `chartData` mudar.

  // 3. Configura o auto-sync e o limpa quando o componente é desmontado.
  useEffect(() => {
    const intervalId = setInterval(syncNow, 60 * 1000);
    return () => clearInterval(intervalId); // Função de limpeza
  }, []);

  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <>
      {/* O CSS pode ser injetado diretamente aqui ou movido para o arquivo styles.css global */}
      <style>{`
        .dash-toolbar{display:grid;grid-template-columns:repeat(5,minmax(220px,1fr)) auto;gap:12px;align-items:end;margin-bottom:12px}
        .dash-summary{background:#f5f8fe;border:1px solid #e6eef9;border-radius:12px;padding:10px 12px;color:#0f2544;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
        .kpi-pill{background:#fff;border:1px solid #dfe7f7;border-radius:999px;padding:6px 10px;font-weight:700}
        .label{font-size:12px;color:#64748b;margin-bottom:4px;display:block}
        .dash-grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:320px;gap:16px}
        @media (max-width:1100px){ .dash-grid{grid-template-columns:1fr} }
        .chart-card{background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06);display:flex;flex-direction:column;min-height:0}
        .chart-title{font-weight:800;color:#0f2544;padding:10px 12px 4px}
        .chart-wrap{flex:1;min-height:0;padding:8px}
        .chart-wrap canvas{width:100%;height:100%}
        .card-mini{background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06); margin-top:16px}
        .tbl{width:100%;border-collapse:separate;border-spacing:0}
        .tbl thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:10px;text-align:left}
        .tbl td{border-bottom:1px solid #eef2f7;padding:10px}
        .muted{color:#6b7280}
        .input,.select{width:100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        .button{ padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
        .btn-sync{white-space:nowrap}
      `}</style>
      
      <div className="card">
        <div className="dash-toolbar">
          {/* Removi os filtros de data por simplicidade, podemos adicioná-los depois */}
          <div>
            <label className="label">Atalho</label>
            <select className="select" value={filters.atalho} onChange={e => setFilters({...filters, atalho: e.target.value})}>
              <option>Últimos 3 meses</option>
              <option>Últimos 6 meses</option>
              <option>Últimos 12 meses</option>
            </select>
          </div>
          <div>
            <label className="label">Origem</label>
            <select className="select" value={filters.origem} onChange={e => setFilters({...filters, origem: e.target.value})}>
              <option value="Todos">Todos</option>
              <option value="WhatsApp">WhatsApp (Sheets)</option>
              <option value="App">App (manual)</option>
            </select>
          </div>
          <div>
            <button className="button" onClick={carregarDados}>Atualizar</button>
          </div>
          <div>
            <button className="button btn-sync" onClick={syncNow}>Sincronizar Sheets</button>
          </div>
        </div>

        <div className="dash-summary">
          <span>Total no período: <b>{moneyBR(summary.faturamento)}</b></span>
          <span className="kpi-pill">Pedidos: <span>{summary.pedidos}</span></span>
          <span className="kpi-pill">{syncStatus}</span>
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: '12px' }}>
        <div className="chart-card">
          <div className="chart-title">Total no período</div>
          <div className="chart-wrap"><canvas ref={receitaCanvasRef}></canvas></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Quantidade de pedidos no período</div>
          <div className="chart-wrap"><canvas ref={qtdCanvasRef}></canvas></div>
        </div>
      </div>

      <div className="card-mini">
        <div className="chart-title" style={{ padding: '12px' }}>Últimos pedidos (somente banco sincronizado)</div>
        <div style={{ padding: '0 12px 12px' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:'180px'}}>Data</th>
                <th>Cliente</th>
                <th style={{width:'160px'}}>Status</th>
                <th style={{width:'160px'}}>Total (R$)</th>
                <th style={{width:'180px'}}>Origem</th>
              </tr>
            </thead>
            <tbody>
              {lastOrders.length > 0 ? (
                lastOrders.slice(0, 20).map((r, index) => (
                  <tr key={index}> {/* Idealmente usar um r.id aqui */}
                    <td>{formatDateBR(r.data)}</td>
                    <td>{r.cliente || ''}</td>
                    <td>{r.status || ''}</td>
                    <td>{moneyBR(r.total || 0)}</td>
                    <td>{r.origem || ''}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="muted">Sem registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default Dashboard;