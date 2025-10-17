import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// 1. Encontra a div 'root' no index.html.
const rootElement = document.getElementById('root');

// 2. Cria a raiz da aplicação React dentro desse elemento.
const root = ReactDOM.createRoot(rootElement);

// 3. Renderiza o componente principal 'App' dentro da raiz.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);