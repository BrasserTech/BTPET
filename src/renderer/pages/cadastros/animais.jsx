import React, { useState } from 'react';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const toastSafe = (m, e = false) => {
  console[e ? 'error' : 'log'](m);
  alert(m);
};

function Animais() {
  const currentSegment = localStorage.getItem('bt-agenda-segment');
  const initialFormState = { nome: '', tutorNome: '', tutorId: '', especie: '', raca: '', obs: '' };
  const [formData, setFormData] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    const key = id.replace('pet-', '');
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleClear = () => {
    setFormData(initialFormState);
    document.getElementById('pet-nome').focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || !ipcRenderer) return;
    if (!formData.nome.trim() || !formData.tutorNome.trim()) {
      toastSafe('Informe o nome do Pet e o nome do Tutor.', true);
      return;
    }

    // A CORREÇÃO ESTÁ AQUI
    const payload = {
      nome: formData.nome.trim(),
      tutor_chave: Number(formData.tutorId) || null, // Corrigido de 'chave_tutor' para 'tutor_chave'
      especie: formData.especie.trim() || null,
      raca: formData.raca.trim() || null,
      obs: formData.obs.trim() || null,
    };

    try {
      setIsSaving(true);
      await ipcRenderer.invoke('animais:criar', payload);
      toastSafe('Animal salvo com sucesso!');
      handleClear();
    } catch (err) {
      toastSafe('Erro ao salvar animal: ' + (err?.message || err), true);
    } finally {
      setIsSaving(false);
    }
  };

  if (currentSegment !== 'petshop') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Módulo Indisponível</h2>
        <p>O cadastro de animais está disponível apenas para o segmento de <strong>Pet Shop</strong>.</p>
        <p>Você pode alterar o segmento do seu negócio em <a href="#/configuracoes">Configurações</a>.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Cadastro de Animais (Pets)</h3>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="form-fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label className="label">Nome do Pet*</label>
            <input id="pet-nome" value={formData.nome} onChange={handleChange} className="input" required placeholder="Ex.: Thor" />
          </div>
          <div>
            <label className="label">Tutor (Dono)*</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
              <input id="pet-tutorNome" value={formData.tutorNome} onChange={handleChange} className="input" required placeholder="Pesquisar tutor..." />
              <button type="button" onClick={() => toastSafe('Lookup de tutores não implementado.')} className="button outline" title="Pesquisar Tutor">??</button>
            </div>
          </div>
          <div>
            <label className="label">Espécie</label>
            <input id="pet-especie" value={formData.especie} onChange={handleChange} className="input" placeholder="Ex.: Cachorro, Gato" />
          </div>
          <div>
            <label className="label">Raça</label>
            <input id="pet-raca" value={formData.raca} onChange={handleChange} className="input" placeholder="Ex.: Golden Retriever" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Observações</label>
            <textarea id="pet-obs" value={formData.obs} onChange={handleChange} className="textarea" rows="3" placeholder="Alergias, comportamento, etc."></textarea>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="button" disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar Animal'}
          </button>
          <button type="button" onClick={handleClear} className="button outline">Limpar</button>
        </div>
      </form>
    </div>
  );
}

export default Animais;