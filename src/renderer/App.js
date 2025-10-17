(function init() {
  const menu = document.getElementById('menu');

  const acc1 = window.Accordion({
    icon:'<span>➕</span>',
    title:'Cadastrar',
    items:[
      { route:'cad:produtos', label:'Produtos' },
      { route:'cad:clientes', label:'Clientes' },
      { route:'cad:pedidos',  label:'Pedidos' }
    ]
  });
  const acc2 = window.Accordion({
    icon:'<span>🔎</span>',
    title:'Consultar',
    items:[
      { route:'cons:produtos', label:'Produtos' },
      { route:'cons:clientes', label:'Clientes' },
      { route:'cons:pedidos',  label:'Pedidos' },
    ]
  });
  const acc3 = window.Accordion({
    icon:'<span>📊</span>',
    title:'Relatórios',
    items:[
      { route:'rel:faturamento', label:'Faturamento' },
      { route:'rel:faturamentoCliente', label:'Faturamento por Cliente' },
      { route:'rel:movProdutos', label:'Mov. Produtos' },
    ]
  });
  const acc4 = window.Accordion({
    icon:'<span>🏠</span>',
    title:'Dashboard',
    items:[ { route:'dash:home', label:'Dashboard' } ]
  });

  // >>> NOVO acordeão: Monitor em tempo real (via banco)
  const acc5 = window.Accordion({
    icon:'<span>🖥️</span>',
    title:'Operação',
    items:[ { route:'mon:pedidos', label:'Monitor de Pedidos' } ]
  });

  menu.innerHTML = `
    <div class="logo"><div class="badge">BT</div> Estamparia ERP</div>
    ${acc1.html} ${acc2.html} ${acc3.html} ${acc4.html} ${acc5.html}
    <div style="margin-top:16px" class="accordion">
      <div class="acc-head"><div class="title">⚙️ Configurações</div><div>▾</div></div>
      <div class="acc-body"><a data-route="cfg:app">Configurações</a></div>
    </div>
    <div class="accordion">
      <div class="acc-head"><div class="title">👤 Perfil</div><div>▾</div></div>
      <div class="acc-body"><a data-route="user:perfil">Perfil</a></div>
    </div>
  `;
  window.mountAccordions(menu);

  // abre dashboard inicialmente
  window.navigate('dash:home');
})();
