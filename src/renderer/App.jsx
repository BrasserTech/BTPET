import React from 'react';
import AppRouter from './router.jsx'; // 1. Importa o roteador
// Importaremos a Sidebar real em breve
// import Sidebar from './components/layout/Sidebar.jsx'; 

function App() {
  // Por enquanto, vamos manter uma sidebar placeholder
  // e colocar o roteador no lugar do conteúdo.
  return (
    <div className="app"> {/* Usando a classe 'app' do seu CSS */}
      
      {/* A Sidebar será um componente separado e fixo */}
      <aside className="sidebar">
         {/* Conteúdo da Sidebar virá aqui */}
         <div className="brand">
            <div className="logo">BT</div>
            <div className="brand-name">BT Agenda</div>
         </div>
         <nav className="nav">
            <p style={{padding: '20px', color: 'white'}}>Menu de Navegação virá aqui...</p>
         </nav>
      </aside>

      {/* O 'content' envolve o Topbar e a área onde as páginas são renderizadas */}
      <main className="content">
        <header className="topbar">
          <h1 id="page-title">Dashboard</h1>
          <div className="userbar">
            <div className="avatar">O</div>
            <div className="name">Operador</div>
          </div>
        </header>

        <section className="view-root">
          {/* 2. O Roteador é colocado aqui! */}
          <AppRouter />
        </section>
      </main>
    </div>
  );
}

export default App;