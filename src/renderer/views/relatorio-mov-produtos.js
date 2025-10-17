window.renderRelatorioMovProdutos = function(){
  let dtIni='', dtFim='', rows=[];
  async function buscar(){
    const r = await window.api.invoke('relatorios:movProdutos', {
      dtIni: dtIni?dtIni+' 00:00:00':null, dtFim: dtFim?dtFim+' 23:59:59':null
    });
    if(r?.ok){ rows=r.rows; render(); } else alert('Erro: '+r.error);
  }
  function render(){
    const body = rows.map(x=>`<tr><td>${x.produto_id}</td><td>${x.nome}</td><td>${x.entradas}</td><td>${x.saidas}</td></tr>`).join('');
    document.getElementById('app-view').innerHTML = `
      <h2>Movimentação de Produtos</h2>
      <div class="card">
        <div class="row">
          <input id="di" type="date" value="${dtIni}"><input id="df" type="date" value="${dtFim}">
          <button id="buscar">Buscar</button>
        </div>
        <table class="grid"><thead><tr><th>ID</th><th>Produto</th><th>Entradas</th><th>Saídas</th></tr></thead><tbody>${body}</tbody></table>
      </div>`;
    document.getElementById('buscar').onclick=()=>{dtIni=document.getElementById('di').value;dtFim=document.getElementById('df').value;buscar();};
  }
  render();
  return { title:'Movimentação de Produtos' };
};
