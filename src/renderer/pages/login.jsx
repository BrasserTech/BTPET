import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// --- Constantes e Setup do IPC ---
const AUTH_KEY = 'AUTH_TOKEN';
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

// --- O Componente React ---
function Login() {
  // --- ESTADO (useState) ---
  const [isLoginView, setIsLoginView] = useState(true); // Controla se mostra Login ou Cadastro
  const [formData, setFormData] = useState({ email: '', password: '', nome: '' });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // --- EFEITOS (useEffect) ---
  // Verifica se o usuário já está logado ao carregar a página
  useEffect(() => {
    if (localStorage.getItem(AUTH_KEY)) {
      navigate('/'); // Se já tem token, redireciona para o Dashboard
    }
  }, []);

  // --- EVENT HANDLERS ---
  const handleChange = (e) => {
    const { id, value } = e.target;
    // Mapeia o id do input para a chave do estado (ex: 'cd-nome' -> 'nome')
    const key = id.split('-')[1]; 
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !ipcRenderer) return;

    setIsSubmitting(true);
    setMessage('Enviando...');

    try {
      let out;
      if (isLoginView) {
        // --- Lógica de Login ---
        if (!formData.email || !formData.password) {
          throw new Error('Preencha e-mail e senha.');
        }
        out = await ipcRenderer.invoke('auth:login', { 
          email: formData.email, 
          senha: formData.password 
        });
      } else {
        // --- Lógica de Cadastro (do seu antigo cadastro.js) ---
        if (!formData.nome || !formData.email || !formData.password) {
          throw new Error('Preencha todos os campos.');
        }
        if (formData.password.length < 6) {
          throw new Error('A senha deve ter no mínimo 6 caracteres.');
        }
        out = await ipcRenderer.invoke('auth:signup', {
          nome: formData.nome,
          email: formData.email,
          senha: formData.password,
        });
      }

      if (!out?.ok) {
        throw new Error(out?.error || 'Ocorreu uma falha.');
      }

      localStorage.setItem(AUTH_KEY, out.token);
      setMessage(isLoginView ? 'Login efetuado! Redirecionando...' : 'Conta criada! Redirecionando...');
      navigate('/'); // Redireciona para o Dashboard em caso de sucesso

    } catch (err) {
      setMessage(err?.message || 'Erro desconhecido');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const toggleView = (e) => {
    e.preventDefault();
    setIsLoginView(!isLoginView);
    setFormData({ email: '', password: '', nome: '' });
    setMessage('');
  };

  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <div className="card" style={{ maxWidth: '520px', margin: '80px auto' }}>
      <h2 style={{ margin: '0 0 12px' }}>
        {isLoginView ? 'Entrar na Conta' : 'Criar Conta'}
      </h2>
      <div className="muted" style={{ marginBottom: '12px' }}>
        {isLoginView ? 'Bem-vindo de volta!' : 'Preencha os dados abaixo.'}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!isLoginView && (
          <input id="cd-nome" value={formData.nome} onChange={handleChange} className="input" placeholder="Nome completo" required />
        )}
        <input id="cd-email" value={formData.email} onChange={handleChange} className="input" type="email" placeholder="E-mail" required />
        <input id="cd-password" value={formData.password} onChange={handleChange} className="input" type="password" placeholder="Senha" required />
        
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? 'Aguarde...' : (isLoginView ? 'Entrar' : 'Cadastrar')}
        </button>

        <div className="muted">
          {isLoginView ? 'Não tem conta?' : 'Já tem conta?'}
          <a href="#" onClick={toggleView} style={{ marginLeft: '5px' }}>
            {isLoginView ? 'Cadastre-se' : 'Entrar'}
          </a>
        </div>
        
        {message && <div className="muted">{message}</div>}
      </form>
    </div>
  );
}

export default Login;