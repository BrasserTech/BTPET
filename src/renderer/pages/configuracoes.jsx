import React, { useState, useEffect } from 'react';

// --- Helpers e Setup do IPC (fora do componente) ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const toastSafe = (m, e = false) => {
  // Integre com sua biblioteca de toast preferida ou use alert
  console[e ? 'error' : 'log'](m);
  alert(m);
};

// Função de validação do Sheet ID, exatamente como a sua.
function extractSpreadsheetId(input) {
  const raw = (input || '').trim();
  if (!raw) return { ok: false, value: '', reason: 'vazio' };
  const m = raw.match(/\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m && m[1]) return { ok: true, value: m[1] };
  const looksLikeId = /^[a-zA-Z0-9-_]{20,}$/.test(raw);
  if (looksLikeId) return { ok: true, value: raw };
  return { ok: false, value: '', reason: 'formato' };
}


// --- O Componente React ---
function Configuracoes() {
  // --- ESTADO (useState) ---
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState({
    id: '',
    json: '',
    sheetId: '',
    range: 'IA!A2:N',
  });
  const [sheetIdWarning, setSheetIdWarning] = useState('');
  const [testStatus, setTestStatus] = useState({ visible: false, type: 'warn', message: '' });

  // --- LÓGICA DE DADOS ---
  const loadList = async () => {
    if (!ipcRenderer) return;
    try {
      const rows = await ipcRenderer.invoke('apigs:config:list');
      setConfigs(rows || []);
    } catch (err) {
      toastSafe(err?.message || String(err), true);
    }
  };

  // --- EVENT HANDLERS ---
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setForm(prevForm => ({ ...prevForm, [id]: value }));
  };
  
  const handleSheetIdChange = (e) => {
    const res = extractSpreadsheetId(e.target.value);
    if (!res.ok) {
      setSheetIdWarning('Formato inválido. Use o ID ou a URL completa.');
    } else {
      setSheetIdWarning('');
      // Atualiza o valor no formulário para a versão limpa
      setForm(prevForm => ({ ...prevForm, sheetId: res.value }));
    }
  };

  const handleNew = () => {
    setForm({ id: '', json: '', sheetId: '', range: 'IA!A2:N' });
    setSheetIdWarning('');
    setTestStatus({ visible: false });
  };
  
  const handleSave = async (e) => {
    e.preventDefault();
    if (!ipcRenderer) return;

    const res = extractSpreadsheetId(form.sheetId);
    if (!res.ok) {
      return toastSafe('O Google Sheet ID parece inválido.', true);
    }
    
    try {
      const payload = {
        chave: form.id || undefined,
        service_json: form.json,
        google_sheet_id: res.value,
        google_sheet_range: form.range || 'IA!A2:N'
      };
      const resp = await ipcRenderer.invoke('apigs:config:save', payload);
      toastSafe(payload.chave ? 'Configuração atualizada!' : 'Configuração salva!');
      if (resp?.chave) setForm(prev => ({...prev, id: resp.chave}));
      loadList();
    } catch (err) {
      toastSafe(err?.message || String(err), true);
    }
  };

  const handleTest = async (configData) => {
    if (!ipcRenderer) return;
    try {
      const payload = configData.id 
        ? { id: configData.id } 
        : { service_json: form.json, google_sheet_id: form.sheetId, google_sheet_range: form.range };
      
      const out = await ipcRenderer.invoke(configData.id ? 'apigs:sheets:testById' : 'apigs:sheets:test', payload);
      toastSafe(`Teste: ${out.ok ? 'sucesso' : 'falha'}${out.note ? ' | ' + out.note : ''}`, !out.ok);
    } catch (err) {
       toastSafe(err?.message || String(err), true);
    }
  };
  
  const handleDelete = async (id) => {
    if (!ipcRenderer || !confirm('Excluir esta configuração?')) return;
    try {
      await ipcRenderer.invoke('apigs:config:delete', String(id));
      loadList();
      handleNew(); // Limpa o formulário se a config deletada estava sendo editada
    } catch (err) {
      toastSafe(err?.message || String(err), true);
    }
  };

  const handleEdit = async (id) => {
    if (!ipcRenderer) return;
    try {
      const row = await ipcRenderer.invoke('apigs:config:get', String(id));
      const reconstructedJson = {
        type: "service_account",
        project_id: row.project_id,
        private_key: row.private_key,
        client_email: row.client_email,
      };
      setForm({
        id: row.chave || '',
        json: JSON.stringify(reconstructedJson, null, 2),
        sheetId: row.google_sheet_id || '',
        range: row.google_sheet_range || 'IA!A2:N',
      });
    } catch (err) {
      toastSafe(err?.message || String(err), true);
    }
  };


  // --- EFEITOS (useEffect) ---
  useEffect(() => {
    // Carrega a lista de configurações quando o componente é montado pela primeira vez
    loadList();
  }, []); // O array vazio [] significa que este efeito roda apenas uma vez.

  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <>
      <style>{`
        /* ... Cole seu CSS original aqui ... */
        /* Pequenos ajustes para React */
        .button, .input, .textarea { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; }
        .button { cursor: pointer; }
        .textarea { width: 100%; font-family: monospace; }
      `}</style>
      
      <div className="cfg-wrap">
        <div className="cfg-head">
          <div style={{fontWeight: 800, color: '#0f2544'}}>Integração Google Sheets</div>
          <div className="muted">Cole o service-account.json, informe o Google Sheet ID e o Range.</div>
        </div>

        <div className="cfg-body">
          <form onSubmit={handleSave} className="grid">
            <div className="col-12">
              <label className="label">Service Account JSON</label>
              <textarea id="json" value={form.json} onChange={handleInputChange} className="textarea" rows="8" placeholder='{ "type":"service_account", ... }'></textarea>
            </div>

            <div className="col-6">
              <label className="label">Google Sheet ID</label>
              <input id="sheetId" value={form.sheetId} onChange={handleInputChange} onBlur={handleSheetIdChange} className="input" placeholder="Cole a URL completa ou o ID"/>
              {sheetIdWarning && <div className="inline-warn">{sheetIdWarning}</div>}
            </div>
            <div className="col-6">
              <label className="label">Range (ex.: IA!A2:N)</label>
              <input id="range" value={form.range} onChange={handleInputChange} className="input" />
            </div>

            <div className="col-12 hr"></div>

            <div className="col-12 actions" style={{marginTop: '6px'}}>
              <button type="submit" className="button">Salvar</button>
              <button type="button" className="button outline" onClick={handleNew}>Novo</button>
              <button type="button" className="button" onClick={() => handleTest(form)}>Testar planilha</button>
              {/* Lógica de remover teste pode ser adicionada depois */}
            </div>
          </form>

          <div className="list">
            <h3 style={{margin: '8px 0'}}>Configurações salvas</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{width: '70px'}}>#</th>
                  <th>Sheet ID</th>
                  <th>client_email</th>
                  <th>Range</th>
                  <th style={{width: '220px'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(cfg => (
                  <tr key={cfg.chave}>
                    <td>{cfg.chave}</td>
                    <td>{cfg.google_sheet_id}</td>
                    <td>{cfg.client_email}</td>
                    <td>{cfg.google_sheet_range}</td>
                    <td style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                      <button className="button outline" onClick={() => handleEdit(cfg.chave)}>Editar</button>
                      <button className="button outline" onClick={() => handleDelete(cfg.chave)}>Excluir</button>
                      <button className="button" onClick={() => handleTest({ id: cfg.chave })}>Testar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default Configuracoes;