import React, { useState } from 'react';

// --- Setup do IPC e Helpers ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const toastSafe = (m, e = false) => {
  console[e ? 'error' : 'log'](m);
  alert(m);
};

// --- O Componente React ---
function Clientes() {
  const initialFormState = {
    nome: '', fisjur: 'F', tipo: '1', doc: '', emp: '', email: '', fone: '', ender: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  const handleChange = (e) => {
    const { id, value } = e.target;
    const key = id.replace('cli-', '');
    setFormData(prevData => ({ ...prevData, [key]: value }));
  };

  const handleClear = () => { setFormData(initialFormState); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ipcRenderer) return;
    
    if (!formData.nome.trim()) {
      toastSafe('Informe o nome do cliente.', true);
      return;
    }

    // A CORREÇÃO ESTÁ AQUI
    const payload = {
      nome: formData.nome.trim(),
      fisjur: formData.fisjur,
      tipo: Number(formData.tipo),
      documento: formData.doc.trim() || null, // Corrigido de 'cpf' para 'documento'
      email: formData.email.trim() || null,
      telefone: formData.fone.trim() || null,
      endereco: formData.ender.trim() || null,
    };
    
    try {
      await ipcRenderer.invoke('clientes:save', payload);
      toastSafe('Cliente salvo com sucesso.');
      handleClear();
    } catch (err) {
      toastSafe('Falha ao salvar: ' + (err?.message || err), true);
    }
  };

  return (
    <div className="card" style={{ padding: '16px' }}>
      <h3>Cadastro de Clientes</h3>
      <form onSubmit={handleSubmit} className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="full">
          <label className="label">Nome*</label>
          <input id="cli-nome" value={formData.nome} onChange={handleChange} className="input" placeholder="Cliente Exemplo" />
        </div>
        <div>
          <label className="label">Fis./Jur.*</label>
          <select id="cli-fj" value={formData.fisjur} onChange={handleChange} className="select">
            <option value="F">Física</option>
            <option value="J">Jurídica</option>
          </select>
        </div>
        <div>
          <label className="label">Tipo*</label>
          <select id="cli-tipo" value={formData.tipo} onChange={handleChange} className="select">
            <option value="1">Cliente</option>
            <option value="2">Fornecedor</option>
            <option value="3">Ambos</option>
          </select>
        </div>
        <div className="full">
          <label className="label">Documento (CPF/CNPJ)</label>
          <input id="cli-doc" value={formData.doc} onChange={handleChange} className="input" placeholder="000.000.000-00 ou 00.000.000/0000-00" />
        </div>
        <div className="full">
          <label className="label">Empresa (referência) — opcional</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
            <input id="cli-emp" value={formData.emp} onChange={handleChange} className="input" placeholder="Pesquisar empresa" />
            <button type="button" onClick={() => toastSafe('Lookup não implementado.')} className="button outline" title="Pesquisar">??</button>
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input id="cli-email" type="email" value={formData.email} onChange={handleChange} className="input" placeholder="contato@email.com" />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input id="cli-fone" value={formData.fone} onChange={handleChange} className="input" placeholder="(00) 00000-0000" />
        </div>
        <div className="full">
          <label className="label">Endereço</label>
          <input id="cli-ender" value={formData.ender} onChange={handleChange} className="input" placeholder="Rua, nº, bairro, cidade" />
        </div>
        <div className="form-actions full">
          <button type="submit" className="button">Salvar</button>
          <button type="button" onClick={handleClear} className="button outline">Limpar</button>
        </div>
      </form>
      <style>{`.form{display:grid;gap:16px;margin-top:20px;}.full{grid-column:1 / -1;}.form-actions{display:flex;gap:12px;}.input,.select{width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;}`}</style>
    </div>
  );
}

export default Clientes;