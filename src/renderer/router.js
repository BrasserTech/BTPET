// src/renderer/router.js
// Router baseado em hash (sem rotas de auth; login é popup separado).
// Versão atualizada: normaliza hash, evita renders repetidos, mantém
// comportamento compatível (mesmos PATHS e nomes de views).

/* ====================== Mapa de caminhos ====================== */
const PATHS = {
  '#/':                            'dash:home',
  '#/dashboard':                  'dash:home',

  '#/cadastro/produtos':          'cad:produtos',
  '#/cadastro/clientes':          'cad:clientes',
  '#/cadastro/pedidos':           'cad:pedidos',

  '#/consulta/produtos':          'con:produtos',
  '#/consulta/clientes':          'con:clientes',
  '#/consulta/pedidos':           'con:pedidos',

  '#/relatorios/faturamento':     'rel:faturamento',
  '#/relatorios/fat-por-cliente': 'rel:fat-por-cliente',
  '#/relatorios/mov-produtos':    'rel:mov-produtos',

  '#/monitor-pedidos':            'mon:pedidos',

  '#/cardapio':                   'cardapio',

  '#/configuracoes':              'cfg',
  '#/perfil':                     'perfil'
};

/* ====================== Resolvedor de rotas ====================== */
function resolveRoutes() {
  return {
    'dash:home'           : window.renderDashboard,
    'cad:produtos'        : window.renderCadastroProdutos,
    'cad:clientes'        : window.renderCadastroClientes,
    'cad:pedidos'         : window.renderCadastroPedidos,
    'con:produtos'        : window.renderConsultaProdutos,
    'con:clientes'        : window.renderConsultaClientes,
    'con:pedidos'         : window.renderConsultaPedidos,
    'rel:faturamento'     : window.renderRelFaturamento,
    'rel:fat-por-cliente' : window.renderRelFatPorCliente,
    'rel:mov-produtos'    : window.renderRelMovProdutos,
    'cardapio'            : window.renderCardapio,
    'mon:pedidos'         : window.renderMonitorPedidos,
    'cfg'                 : window.renderConfiguracoes,
    'perfil'              : window.renderPerfil
  };
}

/* ====================== Utilidades ====================== */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function all(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

/**
 * Normaliza o hash removendo query/fragmentos extras, preservando apenas o caminho.
 * Exemplos:
 *   "#/dashboard?x=1" → "#/dashboard"
 *   ""                → "#/"
 */
function normalizeHash(h) {
  const raw = h || window.location.hash || '#/';
  const noQuery = raw.split('?')[0].split('&')[0];
  return noQuery || '#/';
}

function getRouteKeyFromHash() {
  const h = normalizeHash();
  return PATHS[h] || 'dash:home';
}

function setActiveMenu(routeKey) {
  all('.nav a[data-menu]').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.nav a[data-menu="${routeKey}"]`);
  if (link) link.classList.add('active');
}

function closeSubpanelIfOpen() {
  const app = document.getElementById('app');
  if (app && app.classList.contains('subopen')) {
    app.classList.remove('subopen');
    const spBody = document.getElementById('subpanel-body');
    if (spBody) spBody.innerHTML = '';
    document.querySelectorAll('.nav-item.active').forEach(n => n.classList.remove('active'));
  }
}

/* ====================== Renderização ====================== */
let __lastRouteKey = null;
let __hashRenderTick = null;

function renderCurrentRoute() {
  const ROUTES = resolveRoutes();
  const key = getRouteKeyFromHash();

  // Evita renderizações duplicadas para o mesmo hash em sequência
  if (key === __lastRouteKey) return;
  __lastRouteKey = key;

  const fn  = ROUTES[key];
  const root = document.getElementById('view-root');
  const titleEl = document.getElementById('page-title');
  if (!root || !titleEl) return;

  closeSubpanelIfOpen();

  let out = {};
  if (typeof fn === 'function') {
    try { out = fn() || {}; }
    catch (e) {
      console.error('Erro ao executar view:', key, e);
      out = {
        title: 'Erro',
        html: `<div class="card" style="padding:16px">
                 <h3>Falha ao renderizar</h3>
                 <pre style="white-space:pre-wrap">${String(e?.message || e)}</pre>
               </div>`
      };
    }
  } else {
    out = {
      title: 'View não encontrada',
      html: `<div class="card" style="padding:16px">
               <h3>View não encontrada</h3>
               <p>Não há view registrada para <code>${key}</code>.</p>
               <p>Confirme se o arquivo da view foi incluído <strong>antes</strong> de <code>router.js</code> no <code>index.html</code>.</p>
             </div>`
    };
  }

  titleEl.textContent = out.title || '—';
  root.innerHTML = out.html || '<div class="card" style="padding:16px">Sem conteúdo.</div>';

  if (typeof out.afterRender === 'function') {
    try { out.afterRender(); } catch (e) { console.error('afterRender error:', e); }
  }

  setActiveMenu(key);
}

/* ====================== Eventos ====================== */
// Debounce leve para evitar renders múltiplos em alterações rápidas do hash.
function scheduleRender() {
  if (__hashRenderTick) cancelAnimationFrame(__hashRenderTick);
  __hashRenderTick = requestAnimationFrame(renderCurrentRoute);
}

window.addEventListener('hashchange', scheduleRender, { passive: true });
window.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('footer-date');
  if (el) {
    const d = new Date();
    el.textContent = d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long'
    });
  }
  scheduleRender();
});
