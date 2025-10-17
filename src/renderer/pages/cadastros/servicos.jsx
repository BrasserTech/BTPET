import React, { useState } from 'react';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const toastSafe = (m, e = false) => {
  console[e ? 'error' : 'log'](m);
  alert(m);
};

function Servicos() {
  const initialFormState = {
    nome: '',
    valor: '0.00',
    duracao: '30',
    obs: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    const key = id.replace('srv-', '');
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleClear = () => {
    setFormData(initialFormState);
    document.getElementById('srv-nome').focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || !ipcRenderer) return;
    if (!formData.nome.trim()) {
      toastSafe('Informe o nome do serviço.', true);
      document.getElementById('srv-nome').focus();
      return;
    }

    // A CORREÇÃO ESTÁ AQUI
    const payload = {
      nome: formData.nome.trim(),
      valorvenda: Number(formData.valor || '0'), // Corrigido de 'valor' para 'valorvenda'
      duracao_minutos: Number(formData.duracao || '0'),
      obs: formData.obs.trim() || null,
    };

    try {
      setIsSaving(true);
      await ipcRenderer.invoke('servicos:criar', payload);
      toastSafe('Serviço salvo com sucesso!');
      handleClear();
    } catch (err) {
      toastSafe('Erro ao salvar serviço: ' + (err?.message || err), true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card">
      <h3>Cadastro de Serviços</h3>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="form-fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Nome do Serviço*</label>
            <input id="srv-nome" value={formData.nome} onChange={handleChange} className="input" required placeholder="Ex.: Corte de Cabelo Masculino" />
          </div>
          <div>
            <label className="label">Valor* (R$)</label>
            <input id="srv-valor" value={formData.valor} onChange={handleChange} className="input" type="number" step="0.01" min="0" required />
          </div>
          <div>
            <label className="label">Duração (em minutos)</label>
            <input id="srv-duracao" value={formData.duracao} onChange={handleChange} className="input" type="number" step="5" min="0" placeholder="Ex.: 30" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Observações</label>
            <textarea id="srv-obs" value={formData.obs} onChange={handleChange} className="textarea" rows="3" placeholder="Detalhes ou produtos utilizados no serviço..."></textarea>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="button" disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar Serviço'}
          </button>
          <button type="button" onClick={handleClear} className="button outline">Limpar</button>
        </div>
      </form>
    </div>
  );
}

export default Servicos;