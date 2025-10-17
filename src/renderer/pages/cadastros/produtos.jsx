import React, { useState } from 'react';

// --- Setup do IPC e Helpers ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const toastSafe = (m, e = false) => {
  console[e ? 'error' : 'log'](m);
  alert(m); // Usando alert como placeholder para toasts
};

// --- O Componente React ---
function Produtos() {
  // --- ESTADO (useState) ---
  const initialFormState = {
    nome: '',
    vcompra: '0',
    vvenda: '',
    emp: '',
    empId: '',
    valid: '',
    obs: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [status, setStatus] = useState({ visible: false, message: '', isError: false });
  const [isSaving, setIsSaving] = useState(false);

  // --- EVENT HANDLERS ---
  const handleChange = (e) => {
    const { id, value } = e.target;
    // Mapeia o id do input para a chave do estado (ex: 'p-nome' -> 'nome')
    const key = id.replace('p-', '');
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  const showStatus = (message, isError = false) => {
    setStatus({ visible: true, message, isError });
    setTimeout(() => setStatus(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleClear = () => {
    setFormData(initialFormState);
    showStatus('Formulário limpo.');
    document.getElementById('p-nome').focus(); // Foca no campo nome após limpar
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || !ipcRenderer) return;
    
    if (!formData.nome.trim()) {
      showStatus('Informe o nome do produto.', true);
      document.getElementById('p-nome').focus();
      return;
    }

    const payload = {
      nome: formData.nome.trim(),
      valorcompra: Number(formData.vcompra || '0'),
      valorvenda: formData.vvenda === '' ? null : Number(formData.vvenda),
      chaveemp: Number(formData.empId || '') || null,
      validade: formData.valid || null,
      obs: formData.obs.trim() || null,
      categoria: 1, // Mantendo o valor fixo do seu código original
    };

    try {
      setIsSaving(true);
      await ipcRenderer.invoke('produtos:criar', payload);
      showStatus('Produto salvo!');
      handleClear();
    } catch (err) {
      showStatus('Erro ao salvar: ' + (err?.message || String(err)), true);
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <div className="card">
      <form onSubmit={handleSubmit} autoComplete="off">
        {status.visible && (
          <div style={{
            marginBottom: '10px',
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '14px',
            background: status.isError ? '#fee2e2' : '#ecfdf5',
            color: status.isError ? '#991b1b' : '#065f46',
            border: status.isError ? '1px solid #fecaca' : '1px solid #a7f3d0',
          }}>
            {status.message}
          </div>
        )}

        <div className="form-fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Nome*</label>
            <input id="p-nome" value={formData.nome} onChange={handleChange} className="input" required maxLength="100" placeholder="Ex.: Camiseta Algodão" />
          </div>

          <div>
            <label className="label">Valor de compra* (R$)</label>
            <input id="p-vcompra" value={formData.vcompra} onChange={handleChange} className="input" type="number" step="0.01" min="0" required />
          </div>

          <div>
            <label className="label">Valor de venda (R$)</label>
            <input id="p-vvenda" value={formData.vvenda} onChange={handleChange} className="input" type="number" step="0.01" min="0" placeholder="Em branco = igual à compra" />
          </div>

          <div>
            <label className="label">Empresa (referência) — opcional</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input id="p-emp" value={formData.emp} onChange={handleChange} className="input" placeholder="Pesquisar empresa" />
              <button type="button" onClick={() => toastSafe('Lookup não implementado.')} className="button outline" title="Pesquisar">??</button>
            </div>
          </div>

          <div>
            <label className="label">Validade (opcional)</label>
            <input id="p-valid" value={formData.valid} onChange={handleChange} className="input" type="date" />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Observações</label>
            <textarea id="p-obs" value={formData.obs} onChange={handleChange} className="textarea" rows="3" maxLength="300" placeholder="Detalhes do produto..."></textarea>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button" disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={handleClear} className="button outline">Limpar</button>
        </div>
      </form>
    </div>
  );
}

export default Produtos;