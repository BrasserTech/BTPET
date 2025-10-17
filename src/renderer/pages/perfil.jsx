import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// --- Setup do IPC ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

// --- O Componente React ---
function Perfil() {
  // --- ESTADO (useState) ---
  const [user, setUser] = useState({
    nome: '',
    email: '',
    cpf_cnpj: '',
    perfil: 'operador',
  });
  const [passwords, setPasswords] = useState({ senha1: '', senha2: '' });
  const [message, setMessage] = useState({ text: '', isError: false });
  const navigate = useNavigate(); // Hook para navegação

  // --- LÓGICA DE DADOS ---
  const carregarPerfil = async () => {
    if (!ipcRenderer) return;
    try {
      const res = await ipcRenderer.invoke('perfil:getActive');
      if (res?.ok && res.user) {
        setUser(res.user);
        setMessage({ text: '', isError: false });
      } else {
        setMessage({ text: 'Não foi possível carregar seu perfil.', isError: true });
      }
    } catch (err) {
      console.error('[perfil] load error:', err);
      setMessage({ text: 'Erro ao carregar o perfil.', isError: true });
    }
  };

  // --- EVENT HANDLERS ---
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    // Mapeia o id do input para a chave do estado (ex: 'pf-nome' -> 'nome')
    const key = id.replace('pf-', '');
    setUser(prevUser => ({ ...prevUser, [key]: value }));
  };

  const handlePasswordChange = (e) => {
    const { id, value } = e.target;
    setPasswords(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if (!ipcRenderer) return;

    if (passwords.senha1 && passwords.senha1 !== passwords.senha2) {
      setMessage({ text: 'As senhas não coincidem.', isError: true });
      return;
    }

    try {
      const payload = {
        nome: user.nome.trim() || undefined,
        novaSenha: passwords.senha1 || undefined,
      };

      const res = await ipcRenderer.invoke('perfil:updateActive', payload);

      if (!res?.ok) {
        setMessage({ text: res?.error || 'Falha ao salvar.', isError: true });
        return;
      }
      
      setMessage({ text: res.msg || 'Alterações salvas com sucesso.', isError: false });
      setPasswords({ senha1: '', senha2: '' }); // Limpa campos de senha
      carregarPerfil(); // Recarrega os dados para atualizar o título/nome
    } catch (err) {
      console.error('[perfil] save error:', err);
      setMessage({ text: 'Erro ao salvar alterações.', isError: true });
    }
  };
  
  const handleLogout = () => {
    try {
      localStorage.removeItem('AUTH_TOKEN');
    } catch {}
    navigate('/login'); // Usa o roteador para navegar para a tela de login
  };

  // --- EFEITOS (useEffect) ---
  useEffect(() => {
    carregarPerfil();
  }, []); // Roda apenas uma vez ao montar o componente

  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <div className="card" style={{ maxWidth: '900px', margin: '40px auto', padding: '20px' }}>
      <h2>Meu perfil – {user.nome}</h2>
      <p className="muted">Gerencie suas informações e segurança.</p>
      
      {message.text && (
        <div style={{ color: message.isError ? '#b91c1c' : '#64748b', marginBottom: '10px' }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
        <div>
          <label>Nome</label>
          <input id="nome" value={user.nome} onChange={handleInputChange} className="input" placeholder="Seu nome" />
        </div>
        <div>
          <label>E-mail (somente leitura)</label>
          <input id="email" value={user.email} className="input" readOnly />
        </div>
        <div>
          <label>CPF ou CNPJ</label>
          <input id="cpf_cnpj" value={user.cpf_cnpj} className="input" readOnly />
        </div>
        <div>
          <label>Perfil</label>
          <input id="perfil" value={user.perfil} className="input" readOnly />
        </div>
        <div>
          <label>Nova senha (opcional)</label>
          <input id="senha1" type="password" value={passwords.senha1} onChange={handlePasswordChange} className="input" placeholder="Deixe em branco para manter" />
        </div>
        <div>
          <label>Confirmar nova senha</label>
          <input id="senha2" type="password" value={passwords.senha2} onChange={handlePasswordChange} className="input" placeholder="Repita a senha" />
        </div>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleSave} className="button">Salvar alterações</button>
        <button onClick={handleLogout} className="button secondary">Sair da conta</button>
      </div>
    </div>
  );
}

export default Perfil;