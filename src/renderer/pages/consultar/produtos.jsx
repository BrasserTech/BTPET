import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Helpers e Setup do IPC ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const PAGE_SIZE = 10;
const toastSafe = (m, e = false) => {
  console[e ? 'error' : 'log'](m);
  alert(m);
};
const money = (n) => Number(n ?? 0).toFixed(2).replace('.', ',');
const dt = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '';

function resolveVenda(r) {
  return r.valorvenda == null ? r.valorcompra : r.valorvenda;
}

// --- O Componente React ---
function ConsultaProdutos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef(null);

  const loadProducts = useCallback(async () => {
    if (!ipcRenderer) return;
    try {
      const filtro = searchTerm.trim() || null;
      const allProducts = await ipcRenderer.invoke('produtos:listar', filtro);
      setProducts(allProducts || []);
      setPage(1);
    } catch (err) {
      toastSafe('Erro ao carregar produtos: ' + (err?.message || err), true);
    }
  }, [searchTerm]);

  const handleDelete = async (product) => {
    if (!ipcRenderer || !confirm('Confirma excluir este produto?')) return;
    try {
      await ipcRenderer.invoke('produtos:excluir', { chave: product.chave });
      toastSafe('Produto excluído.');
      const allProducts = await ipcRenderer.invoke('produtos:listar', searchTerm.trim() || null);
      setProducts(allProducts || []);
    } catch (err) {
      toastSafe('Erro ao excluir: ' + (err?.message || err), true);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(`${suggestion.chave} - ${suggestion.nome}`);
    setShowSuggestions(false);
  };
  
  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    if (searchTerm.length < 2) { setShowSuggestions(false); return; }
    const timerId = setTimeout(async () => {
      if (!ipcRenderer) return;
      try {
        const res = await ipcRenderer.invoke('produtos:search-for-autocomplete', searchTerm);
        setSuggestions(res || []);
        setShowSuggestions(true);
      } catch (err) { console.error('Erro no autocomplete:', err); }
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const paginatedProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="card">
      <div className="prod-tools">
        <div className="q-wrapper" ref={searchWrapperRef} style={{ position: 'relative', width: '360px' }}>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" placeholder="Buscar por nome ou código..." />
          {showSuggestions && (
            <div id="q-suggest" style={{ display: 'block', position: 'absolute', width: '100%', top: '38px', border: '1px solid #e5eaf0', borderRadius: '10px', background: '#fff', boxShadow: '0 8px 22px rgba(15,23,42,.10)', zIndex: 1000, maxHeight: '260px', overflowY: 'auto' }}>
              {suggestions.length > 0 ? (
                suggestions.map(s => (
                  <div key={s.chave} onClick={() => handleSuggestionClick(s)} className="s-item" style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                    <b>{s.chave}</b> — {s.nome} <small style={{ color: '#64748b', marginLeft: '6px' }}>• R$ {money(resolveVenda(s))}</small>
                  </div>
                ))
              ) : (<div className="s-item" style={{ cursor: 'default', color: '#94a3b8', padding: '10px 12px' }}>Nenhum produto encontrado</div>)}
            </div>
          )}
        </div>
        <button className="button" onClick={loadProducts}>Buscar</button>
        <button className="button outline" onClick={() => setSearchTerm('')}>Limpar</button>
      </div>
      <table className="prod-table">
        <thead>
          <tr>
            <th className="col-codigo">Código</th>
            <th className="col-nome">Nome</th>
            <th className="col-venda">Venda (R$)</th>
            <th className="col-data">Data</th>
            <th className="col-acoes">Ações</th>
          </tr>
        </thead>
        <tbody>
          {paginatedProducts.length > 0 ? (
            paginatedProducts.map(p => (
              <tr key={p.chave}>
                <td className="col-codigo">{p.chave}</td>
                <td className="col-nome">{p.nome}</td>
                <td className="col-venda">{money(resolveVenda(p))}</td>
                <td className="col-data">{dt(p.datahoracad)}</td>
                <td className="col-acoes"><button className="btn-mini" title="Excluir" onClick={() => handleDelete(p)}>×</button></td>
              </tr>
            ))
          ) : (<tr><td colSpan="5" style={{ textAlign: 'center', color: '#78909c', background: '#fff', border: '1px solid #e6ecf5', borderRadius: '12px', padding: '16px' }}>Nenhum registro</td></tr>)}
        </tbody>
      </table>
      <div className="prod-pager">
        <button className="button outline" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Anterior</button>
        <span>Página {page} de {totalPages} — {products.length} registro(s)</span>
        <button className="button outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Próximo</button>
      </div>
    </div>
  );
}

export default ConsultaProdutos;