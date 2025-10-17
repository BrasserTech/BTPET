import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

// Importando todas as páginas que criamos
import Dashboard from './pages/Dashboard.jsx';
import Agenda from './pages/Agenda.jsx';
import Login from './pages/Login.jsx';
import Perfil from './pages/Perfil.jsx';
import Configuracoes from './pages/Configuracoes.jsx';

// Páginas de Cadastro
import CadastroClientes from './pages/cadastros/clientes.jsx';
import CadastroProdutos from './pages/cadastros/produtos.jsx';
import CadastroServicos from './pages/cadastros/servicos.jsx';
import CadastroAnimais from './pages/cadastros/animais.jsx';

// Páginas de Consulta
import ConsultaClientes from './pages/consultas/Clientes.jsx';
import ConsultaProdutos from './pages/consultas/Produtos.jsx';
import ConsultaServicos from './pages/consultas/Servicos.jsx';
import ConsultaAnimais from './pages/consultas/Animais.jsx';

function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        {/* Rotas de Autenticação */}
        <Route path="/login" element={<Login />} />

        {/* Rotas Principais */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/configuracoes" element={<Configuracoes />} />

        {/* Rotas de Cadastro */}
        <Route path="/cadastros/clientes" element={<CadastroClientes />} />
        <Route path="/cadastros/produtos" element={<CadastroProdutos />} />
        <Route path="/cadastros/servicos" element={<CadastroServicos />} />
        <Route path="/cadastros/animais" element={<CadastroAnimais />} />

        {/* Rotas de Consulta */}
        <Route path="/consultas/clientes" element={<ConsultaClientes />} />
        <Route path="/consultas/produtos" element={<ConsultaProdutos />} />
        <Route path="/consultas/servicos" element={<ConsultaServicos />} />
        <Route path="/consultas/animais" element={<ConsultaAnimais />} />

        {/* Rota "Catch-all" para páginas não encontradas */}
        <Route path="*" element={<div><h2>Página não encontrada (404)</h2></div>} />
      </Routes>
    </HashRouter>
  );
}

export default AppRouter;