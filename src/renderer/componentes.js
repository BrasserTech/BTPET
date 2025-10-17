window.Accordion = function ({ icon, title, items=[] }) {
  const id = 'acc-' + Math.random().toString(36).slice(2);
  const html = `
    <div class="accordion" id="${id}">
      <div class="acc-head">
        <div class="title">${icon || ''} ${title}</div>
        <div>▾</div>
      </div>
      <div class="acc-body">
        ${items.map(it => `<a data-route="${it.route}">${it.icon||''} ${it.label}</a>`).join('')}
      </div>
    </div>`;
  return { id, html };
};

window.mountAccordions = function (el) {
  el.querySelectorAll('.accordion').forEach(acc => {
    const head = acc.querySelector('.acc-head');
    const body = acc.querySelector('.acc-body');
    head.onclick = () => { body.style.display = body.style.display==='block' ? 'none' : 'block'; };
    body.querySelectorAll('a[data-route]').forEach(a => a.onclick = () => window.navigate(a.dataset.route));
  });
};
