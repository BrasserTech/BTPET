import React, { useState, useEffect, useCallback } from 'react';

// --- Helpers e Setup do IPC ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const PAGE_SIZE = 10;
const toastSafe = (m, e = false) => {
  console[e ? 'error' : 'log'](m);
  alert(m);
};
const dt = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '';

// --- O Componente React ---
function ConsultaAnimais() {
  const currentSegment = localStorage.getItem('bt-agenda-segment');
  const [searchTerm, setSearchTerm] = useState('');
  const [animais, setAnimais] = useState([]);
  const [page, setPage] = useState(1);

  const loadAnimais = useCallback(async () => {
    if (!ipcRenderer) return;
    try {
      const filtro = searchTerm.trim() || null;
      const allAnimais = await ipcRenderer.invoke('animais:listar', filtro);
      setAnimais(allAnimais || []);
      setPage(1);
    } catch (err) {
      toastSafe('Erro ao carregar animais: ' + (err?.message || err), true);
    }
  }, [searchTerm]);

  const handleDelete = async (animalId) => {
    if (!ipcRenderer || !confirm('Confirma excluir este animal?')) return;
    try {
      await ipcRenderer.invoke('animais:excluir', { chave: animalId });
      toastSafe('Animal excluído.');
      const allAnimais = await ipcRenderer.invoke('animais:listar', searchTerm.trim() || null);
      setAnimais(allAnimais || []);
    } catch (err) {
      toastSafe('Erro ao excluir: ' + (err?.message || err), true);
    }
  };

  useEffect(() => {
    if (currentSegment === 'petshop') {
      loadAnimais();
    }
  }, [currentSegment, loadAnimais]);

  if (currentSegment !== 'petshop') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Módulo Indisponível</h2>
        <p>A consulta de animais está disponível apenas para o segmento de <strong>Pet Shop</strong>.</p>
        <p>Você pode alterar o segmento do seu negócio em <a href="#/configuracoes">Configurações</a>.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(animais.length / PAGE_SIZE));
  const paginatedAnimais = animais.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="card">
      <h3>Consulta de Animais (Pets)</h3>
      <div className="prod-tools">
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" placeholder="Buscar por nome do pet ou tutor..." onKeyDown={(e) => e.key === 'Enter' && loadAnimais()} />
        <button className="button" onClick={loadAnimais}>Buscar</button>
        <button className="button outline" onClick={() => setSearchTerm('')}>Limpar</button>
      </div>
      <table className="prod-table">
        <thead>
          <tr>
            <th className="col-codigo">Código</th>
            <th className="col-nome">Nome do Pet</th>
            <th className="col-nome">Tutor</th>
            <th className="col-categ">Espécie</th>
            <th className="col-categ">Raça</th>
            <th className="col-data">Data Cadastro</th>
            <th className="col-acoes">Ações</th>
          </tr>
        </thead>
        <tbody>
          {paginatedAnimais.length > 0 ? (
            paginatedAnimais.map(a => (
              <tr key={a.chave}>
                <td className="col-codigo">{a.chave}</td>
                <td className="col-nome">{a.nome}</td>
                <td className="col-nome">{a.tutor_nome}</td>
                <td className="col-categ">{a.especie}</td>
                <td className="col-categ">{a.raca}</td>
                <td className="col-data">{dt(a.datahoracad)}</td>
                <td className="col-acoes"><button className="btn-mini" title="Excluir" onClick={() => handleDelete(a.chave)}>×</button></td>
              </tr>
            ))
          ) : (<tr><td colSpan="7" style={{ textAlign: 'center', color: '#78909c', padding: '16px' }}>Nenhum animal encontrado</td></tr>)}
        </tbody>
      </table>
      <div className="prod-pager">
        <button className="button outline" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Anterior</button>
        <span>Página {page} de {totalPages} — {animais.length} registro(s)</span>
        <button className="button outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Próximo</button>
      </div>
    </div>
  );
}

export default ConsultaAnimais;