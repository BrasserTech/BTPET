import React from 'react';
import AppRouter from './router.jsx'; // 1. Importa o roteador
// Importaremos a Sidebar real em breve
// import Sidebar from './components/layout/Sidebar.jsx'; 

function App() {
  // Por enquanto, vamos manter uma sidebar placeholder
  // e colocar o roteador no lugar do conte�do.
  return (
    <div className="app"> {/* Usando a classe 'app' do seu CSS */}
      
      {/* A Sidebar ser� um componente separado e fixo */}
      <aside className="sidebar">
         {/* Conte�do da Sidebar vir� aqui */}
         <div className="brand">
            <div className="logo">BT</div>
            <div className="brand-name">BT Agenda</div>
         </div>
         <nav className="nav">
            <p style={{padding: '20px', color: 'white'}}>Menu de Navega��o vir� aqui...</p>
         </nav>
      </aside>

      {/* O 'content' envolve o Topbar e a �rea onde as p�ginas s�o renderizadas */}
      <main className="content">
        <header className="topbar">
          <h1 id="page-title">Dashboard</h1>
          <div className="userbar">
            <div className="avatar">O</div>
            <div className="name">Operador</div>
          </div>
        </header>

        <section className="view-root">
          {/* 2. O Roteador � colocado aqui! */}
          <AppRouter />
        </section>
      </main>
    </div>
  );
}

export default App;