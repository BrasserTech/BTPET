import React, { useState, useEffect, useCallback } from 'react';

// --- Helpers e Setup do IPC ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const PAGE_SIZE = 10;
const toastSafe = (m, e = false) => {
  console[e ? 'error' : 'log'](m);
  alert(m);
};
const money = (n) => `R$ ${Number(n ?? 0).toFixed(2).replace('.', ',')}`;
const dt = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '';

// --- O Componente React ---
function ConsultaServicos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [services, setServices] = useState([]);
  const [page, setPage] = useState(1);

  const loadServices = useCallback(async () => {
    if (!ipcRenderer) return;
    try {
      const filtro = searchTerm.trim() || null;
      const allServices = await ipcRenderer.invoke('servicos:listar', filtro);
      setServices(allServices || []);
      setPage(1);
    } catch (err) {
      toastSafe('Erro ao carregar serviços: ' + (err?.message || err), true);
    }
  }, [searchTerm]);

  const handleDelete = async (serviceId) => {
    if (!ipcRenderer || !confirm('Confirma excluir este serviço?')) return;
    try {
      await ipcRenderer.invoke('servicos:excluir', { chave: serviceId });
      toastSafe('Serviço excluído.');
      const allServices = await ipcRenderer.invoke('servicos:listar', searchTerm.trim() || null);
      setServices(allServices || []);
    } catch (err) {
      toastSafe('Erro ao excluir: ' + (err?.message || err), true);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const totalPages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
  const paginatedServices = services.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="card">
      <h3>Consulta de Serviços</h3>
      <div className="prod-tools">
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" placeholder="Buscar por nome do serviço..." onKeyDown={(e) => e.key === 'Enter' && loadServices()} />
        <button className="button" onClick={loadServices}>Buscar</button>
        <button className="button outline" onClick={() => setSearchTerm('')}>Limpar</button>
      </div>
      <table className="prod-table">
        <thead>
          <tr>
            <th className="col-codigo">Código</th>
            <th className="col-nome">Nome</th>
            <th className="col-venda">Valor</th>
            <th style={{width: '120px', textAlign: 'center'}}>Duração (min)</th>
            <th className="col-data">Data Cadastro</th>
            <th className="col-acoes">Ações</th>
          </tr>
        </thead>
        <tbody>
          {paginatedServices.length > 0 ? (
            paginatedServices.map(s => (
              <tr key={s.chave}>
                <td className="col-codigo">{s.chave}</td>
                <td className="col-nome">{s.nome}</td>
                <td className="col-venda">{money(s.valorvenda)}</td>
                <td style={{textAlign: 'center'}}>{s.duracao_minutos}</td>
                <td className="col-data">{dt(s.datahoracad)}</td>
                <td className="col-acoes"><button className="btn-mini" title="Excluir" onClick={() => handleDelete(s.chave)}>×</button></td>
              </tr>
            ))
          ) : (<tr><td colSpan="6" style={{ textAlign: 'center', color: '#78909c', padding: '16px' }}>Nenhum serviço encontrado</td></tr>)}
        </tbody>
      </table>
      <div className="prod-pager">
        <button className="button outline" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Anterior</button>
        <span>Página {page} de {totalPages} — {services.length} registro(s)</span>
        <button className="button outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Próximo</button>
      </div>
    </div>
  );
}

export default ConsultaServicos;