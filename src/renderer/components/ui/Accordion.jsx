import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Um componente de acorde�o reutiliz�vel para o menu lateral.
 * @param {object} props
 * @param {string} props.icon - O emoji ou �cone para o t�tulo.
 * @param {string} props.title - O texto do t�tulo do acorde�o.
 * @param {array} props.items - Um array de objetos de link, ex: [{ route: '/path', label: 'Label', icon: '??' }]
 */
function Accordion({ icon, title, items = [] }) {
  // 1. Estado para controlar se o acorde�o est� aberto ou fechado.
  const [isOpen, setIsOpen] = useState(false);

  // 2. Fun��o para inverter o estado quando o cabe�alho � clicado.
  const handleToggle = () => {
    setIsOpen(prevIsOpen => !prevIsOpen);
  };

  return (
    <div className="accordion">
      {/* O evento onClick � declarado diretamente no JSX */}
      <div className="acc-head" onClick={handleToggle}>
        <div className="title">
          {icon && <span className="icon">{icon}</span>}
          {title}
        </div>
        {/* A classe 'open' � adicionada condicionalmente para anima��es CSS */}
        <div className={`caret ${isOpen ? 'open' : ''}`}>?</div>
      </div>

      {/* 3. O corpo do acorde�o s� � renderizado se o estado 'isOpen' for verdadeiro. */}
      {isOpen && (
        <div className="acc-body">
          {items.map((item, index) => (
            // 4. Usamos o componente <Link> do react-router-dom para navega��o.
            <Link to={item.route} key={index} className="submenu-link">
              {item.icon && <span className="icon">{item.icon}</span>}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Accordion;