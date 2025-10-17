// src/renderer/views/cardapio.js
window.renderCardapio = function () {
  const html = `
    <style>
      .cdp-tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
      .cdp-grid{display:grid;grid-template-columns:160px 1fr 1fr 160px 160px;gap:8px;align-items:center}
      .cdp-head{font-weight:800;color:#0f2544}
      .cdp-row{background:#fff;border:1px solid #e6ecf5;border-radius:12px;padding:8px;box-shadow:0 4px 12px rgba(15,23,42,.04)}
      .money{text-align:right}
      .help{font-size:12px;color:#64748b}
    </style>

    <div class="card">
      <h3>Cardápio (pagCardapio)</h3>

      <div class="cdp-tools">
        <button id="btn-sync" class="button">Carregar do Sheets</button>
        <button id="btn-save" class="button">Salvar (Banco + Sheets)</button>
        <span id="cdp-status" class="muted"></span>
      </div>

      <div class="cdp-grid cdp-head">
        <div>Dia da semana</div>
        <div>Almoço</div>
        <div>Janta</div>
        <div>Preço almoço</div>
        <div>Preço janta</div>
      </div>

      <div id="cdp-body"></div>

      <div class="help" style="margin-top:8px">
        A coluna <b>A</b> (diaSemana) é fixa; o sistema atualiza as colunas <b>B..E</b>.
      </div>
    </div>
  `;

  const DIAS = [
    { idx:1, label:'segunda-feira' },
    { idx:2, label:'terça-feira'   },
    { idx:3, label:'quarta-feira'  },
    { idx:4, label:'quinta-feira'  },
    { idx:5, label:'sexta-feira'   },
    { idx:6, label:'sabado'        },
    { idx:7, label:'domingo'       },
  ];

  const $ = (id) => document.getElementById(id);
  const parseMoney = (s)=>{
    if (s===''||s==null) return null;
    const n = Number(String(s).replace(/\./g,'').replace(',','.').replace(/^R\$\s*/,''));
    return Number.isFinite(n) ? n : null;
  };

  function makeRow(d){
    const id = `dia-${d.idx}`;
    return `
      <div class="cdp-grid cdp-row" data-dia="${d.idx}">
        <div><b>${d.label}</b></div>
        <div><textarea class="textarea" rows="2" id="${id}-almoco"></textarea></div>
        <div><textarea class="textarea" rows="2" id="${id}-janta"></textarea></div>
        <div><input class="input money" id="${id}-pal" placeholder="0,00"/></div>
        <div><input class="input money" id="${id}-pjan" placeholder="0,00"/></div>
      </div>
    `;
  }

  function capture(){
    const rows = [];
    for (const d of DIAS){
      const id = `dia-${d.idx}`;
      rows.push({
        dia_semana: d.idx,
        almoco: ($(`${id}-almoco`).value||'').trim(),
        janta:  ($(`${id}-janta`).value||'').trim(),
        preco_almoco: parseMoney($(`${id}-pal`).value),
        preco_janta:  parseMoney($(`${id}-pjan`).value),
      });
    }
    return rows;
  }

  function fill(rows){
    const map = new Map(rows.map(r => [Number(r.dia_semana), r]));
    for (const d of DIAS){
      const id = `dia-${d.idx}`;
      const r = map.get(d.idx) || {};
      $(`${id}-almoco`).value = r.almoco || '';
      $(`${id}-janta`).value  = r.janta  || '';
      $(`${id}-pal`).value    = (r.preco_almoco!=null) ? String(r.preco_almoco).replace('.',',') : '';
      $(`${id}-pjan`).value   = (r.preco_janta !=null) ? String(r.preco_janta ).replace('.',',') : '';
    }
  }

  return {
    title: 'Cardápio',
    html,
    afterRender(){
      const { ipcRenderer } = require('electron');
      $('cdp-body').innerHTML = DIAS.map(makeRow).join('');

      $('btn-sync').onclick = async ()=>{
        $('cdp-status').textContent = 'Sincronizando do Sheets…';
        try{
          const r = await ipcRenderer.invoke('cardapio:sync-from-sheet');
          $('cdp-status').textContent = `Planilha lida (${r.rows} linhas).`;
          const rows = await ipcRenderer.invoke('cardapio:list');
          fill(rows);
        }catch(e){
          $('cdp-status').textContent = 'Falha ao ler planilha.';
          (window.toast||console.error)(e.message||String(e), true);
        }
      };

      $('btn-save').onclick = async ()=>{
        const rows = capture();
        $('cdp-status').textContent = 'Salvando…';
        try{
          const r = await ipcRenderer.invoke('cardapio:save', { rows });
          $('cdp-status').textContent = r.ok ? 'Salvo em banco e planilha.' : 'Salvo apenas no banco.';
          (window.toast||console.log)('Cardápio salvo.');
        }catch(e){
          $('cdp-status').textContent = 'Falha ao salvar.';
          (window.toast||console.error)(e.message||String(e), true);
        }
      };

      // Inicial: carrega do banco
      (async ()=>{
        try{
          const rows = await ipcRenderer.invoke('cardapio:list');
          fill(rows);
        }catch {}
      })();
    }
  };
};
