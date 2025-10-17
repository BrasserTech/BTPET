import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Helpers e Setup do IPC ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const PAGE_SIZE = 10;

function maskDoc(doc) {
  const d = (doc || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc || '';
}

function fmtDate(v) {
  if (!v) return '';
  const dt = (v instanceof Date) ? v : new Date(v);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}


// --- O Componente React ---
function ConsultaClientes() {
  // --- ESTADO ---
  const [searchTerm, setSearchTerm] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchWrapperRef = useRef(null);

  // --- LÓGICA DE DADOS ---
  const loadData = useCallback(async () => {
    if (!ipcRenderer) return;
    try {
      const payload = { q: query, page, pageSize: PAGE_SIZE };
      const resp = await ipcRenderer.invoke('clientes:search', payload);
      setData({
        rows: Array.isArray(resp?.rows) ? resp.rows : [],
        total: Number(resp?.total || 0),
      });
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setData({ rows: [], total: 0 });
    }
  }, [query, page]);

  // --- EFEITOS ---
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (searchTerm.length < 2) {
      setShowSuggestions(false); setSuggestions([]); return;
    }
    const timerId = setTimeout(async () => {
      if (!ipcRenderer) return;
      try {
        const res = await ipcRenderer.invoke('clientes:search-for-autocomplete', searchTerm);
        setSuggestions(res || []); setShowSuggestions(true); setHighlightedIndex(-1);
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

  // --- EVENT HANDLERS ---
  const handleSearch = () => {
    setQuery(searchTerm); setPage(1); setShowSuggestions(false);
  };
  const handleClear = () => {
    setSearchTerm(''); setQuery(''); setPage(1); setShowSuggestions(false);
  };
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) { if (e.key === 'Enter') handleSearch(); return; }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % suggestions.length); break;
      case 'ArrowUp': e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length); break;
      case 'Enter': e.preventDefault(); if (highlightedIndex > -1) { handleSuggestionClick(suggestions[highlightedIndex]); } break;
      case 'Escape': setShowSuggestions(false); break;
    }
  };
  const handleSuggestionClick = (suggestion) => {
    const selectedText = `${suggestion.chave} - ${suggestion.nome}`;
    setSearchTerm(selectedText); setQuery(selectedText); setPage(1); setShowSuggestions(false);
  };

  // --- LÓGICA DE RENDERIZAÇÃO ---
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="card">
      <h3>Consulta de Clientes</h3>
      <style>{`.cc-qwrap{position:relative;}.cc-suggest{position:absolute;left:0;right:0;top:38px;border:1px solid #e5eaf0;border-radius:10px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.10);z-index:1000;max-height:260px;overflow-y:auto;}.cc-suggest .s-item{padding:10px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;}.cc-suggest .s-item:last-child{border-bottom:none;}.cc-suggest .s-item:hover,.cc-suggest .s-item.highlight{background:#f8fafc;}.cc-suggest small{color:#64748b;margin-left:6px;}`}</style>
      <div className="form" style={{ gridTemplateColumns: '1fr auto auto', alignItems: 'end' }}>
        <div className="cc-qwrap" ref={searchWrapperRef}>
          <label className="label">Buscar por nome, documento ou e-mail...</label>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown} className="input" placeholder="Digite para buscar..." />
          {showSuggestions && (
            <div className="cc-suggest">
              {suggestions.length > 0 ? (
                suggestions.map((s, i) => (
                  <div key={s.chave} onClick={() => handleSuggestionClick(s)} className={`s-item ${i === highlightedIndex ? 'highlight' : ''}`}>
                    <b>{s.chave}</b> — {s.nome}<small>{s.documento ? `• ${maskDoc(s.documento)}` : ''}{s.telefone ? `• ${s.telefone}` : ''}</small>
                  </div>
                ))
              ) : (<div className="s-item" style={{ cursor: 'default', color: '#94a3b8' }}>Nenhum cliente encontrado</div>)}
            </div>
          )}
        </div>
        <button onClick={handleSearch} className="button" style={{ height: '38px' }}>Buscar</button>
        <button onClick={handleClear} className="button outline" style={{ height: '38px' }}>Limpar</button>
      </div>
      <div className="datagrid" style={{ marginTop: '12px' }}>
        <div className="dg-row dg-head" style={{ gridTemplateColumns: '100px minmax(200px, 2fr) 70px 90px minmax(160px, 1fr) minmax(200px, 1.5fr) 170px' }}>
          <div className="dg-cell">Código</div>
          <div className="dg-cell">Nome</div>
          <div className="dg-cell">F/J</div>
          <div className="dg-cell">Tipo</div>
          <div className="dg-cell">Documento</div>
          <div className="dg-cell">Email</div>
          <div className="dg-cell">Data</div>
        </div>
        {data.rows.length > 0 ? (
          data.rows.map(r => (
            <div key={r.chave} className="dg-row" style={{ gridTemplateColumns: '100px minmax(200px, 2fr) 70px 90px minmax(160px, 1fr) minmax(200px, 1.5fr) 170px' }}>
              <div className="dg-cell">{r.chave}</div>
              <div className="dg-cell">{r.nome}</div>
              <div className="dg-cell">{r.fisjur}</div>
              <div className="dg-cell">{r.tipo}</div>
              <div className="dg-cell">{maskDoc(r.documento)}</div>
              <div className="dg-cell">{r.email}</div>
              <div className="dg-cell">{fmtDate(r.datahoracad)}</div>
            </div>
          ))
        ) : (<div className="card" style={{ gridColumn: '1/-1', background: '#fff', border: '1px dashed #e2e8f0', marginTop: '8px' }}><div style={{ padding: '10px 12px', color: '#64748b' }}>Sem registros.</div></div>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
        <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="button outline">Anterior</button>
        <span style={{ color: '#64748b', fontSize: '12px' }}>Página {page} de {totalPages} — {data.total} registro(s)</span>
        <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="button outline">Próximo</button>
      </div>
    </div>
  );
}

export default ConsultaClientes;