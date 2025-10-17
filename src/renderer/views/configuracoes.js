// src/renderer/views/configuracoes.js
// UI atualizada: placeholder do range = "IA!A2:N"

window.renderConfiguracoes = function () {
  return {
    title: 'Configurações - Google Sheets',
    html: `
      <style>
        .cfg-wrap{background:#fff;border:1px solid #e8eef7;border-radius:14px;box-shadow:0 8px 18px rgba(21,78,210,.06)}
        .cfg-head{padding:14px 16px;border-bottom:1px solid #eef2f7;display:flex;gap:10px;align-items:center;justify-content:space-between}
        .cfg-body{padding:16px}
        .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px}
        @media (max-width:1000px){ .grid{grid-template-columns:repeat(6,1fr)} }
        @media (max-width:700px){ .grid{grid-template-columns:repeat(2,1fr)} }
        .col-4{grid-column:span 4}
        .col-6{grid-column:span 6}
        .col-12{grid-column:span 12}
        .list{margin-top:16px}
        .tbl{width:100%;border-collapse:separate;border-spacing:0}
        .tbl thead th{background:#f7f9ff;border-bottom:1px solid #e8eef7;padding:10px;text-align:left}
        .tbl td{border-bottom:1px solid #eef2f7;padding:10px}
        .muted{color:#64748b}
        .hr{height:1px;background:#eef2f7;margin:8px 0}
        .actions{display:flex;gap:10px;flex-wrap:wrap}
        .note{font-size:12px;color:#64748b}
        .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;border:1px solid #e5e7eb;background:#f8fafc}
        .pill.ok{border-color:#c7f0d0;background:#f0fff4;color:#165a2c}
        .pill.warn{border-color:#fde68a;background:#fffbeb;color:#92400e}
        .pill.err{border-color:#fecaca;background:#fff1f2;color:#991b1b}
        .btn[disabled]{opacity:.6;cursor:not-allowed}
        .help{font-size:12px;color:#475569;margin-top:4px}
        .inline-warn{font-size:12px;color:#b45309}
      </style>

      <div class="cfg-wrap">
        <div class="cfg-head">
          <div style="font-weight:800;color:#0f2544">Integração Google Sheets</div>
          <div class="muted">Cole o service-account.json, informe o Google Sheet ID e o Range (ex.: <em>IA!A2:N</em>).</div>
        </div>

        <div class="cfg-body">
          <form id="f-cfg" class="grid">
            <input type="hidden" id="cfg-id"/>

            <div class="col-12">
              <label class="label">Service Account JSON</label>
              <textarea id="cfg-json" class="textarea" rows="10" placeholder='{ "type":"service_account", "project_id":"...", "private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n", "client_email":"...", ... }'></textarea>
              <div class="help">Compartilhe a planilha com o <em>client_email</em> da Service Account.</div>
            </div>

            <div class="col-6">
              <label class="label">Google Sheet ID (entre /d/ e /edit)</label>
              <input id="cfg-sheetid" class="input" placeholder="1FeZ9C…K-Dk ou cole a URL completa"/>
              <div id="sheetid-warn" class="inline-warn" style="display:none"></div>
            </div>
            <div class="col-6">
              <label class="label">Range (ex.: IA!A2:N)</label>
              <input id="cfg-range" class="input" placeholder="IA!A2:N" value="IA!A2:N"/>
            </div>

            <div class="col-12 hr"></div>

            <div class="col-12 actions" style="margin-top:6px">
              <button class="button" id="btn-save">Salvar</button>
              <button type="button" class="button outline" id="btn-new">Novo</button>
              <button type="button" class="button" id="btn-test">Testar planilha</button>
              <button type="button" class="button danger" id="btn-remove-test" disabled>Remover teste</button>
              <span id="test-status" class="pill warn" style="display:none"></span>
            </div>

            <div class="col-12 note" style="margin-top:4px">
              <strong>Atenção:</strong> salvar sobrepõe a configuração carregada.
            </div>
          </form>

          <div class="list">
            <h3 style="margin:8px 0">Configurações salvas</h3>
            <table class="tbl" id="cfg-table">
              <thead><tr>
                <th style="width:70px">#</th>
                <th>Sheet ID</th>
                <th>client_email</th>
                <th>project_id</th>
                <th>Range</th>
                <th style="width:260px">Ações</th>
              </tr></thead>
              <tbody id="cfg-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    afterRender() {
      const ipc = window.electron?.ipcRenderer || require('electron').ipcRenderer;
      const $ = (id) => document.getElementById(id);
      const toastSafe = (m, e=false) => { try { toast(m, e); } catch(_) { console[e?'error':'log'](m); } };

      function extractSpreadsheetId(input) {
        const raw = (input || '').trim();
        if (!raw) return { ok:false, value:'', reason:'vazio' };
        const m = raw.match(/\/d\/([a-zA-Z0-9-_]{20,})/);
        if (m && m[1]) return { ok:true, value:m[1] };
        const looksLikeId = /^[a-zA-Z0-9-_]{20,}$/.test(raw);
        const looksLikeApiKey = /^AIza[0-9A-Za-z_\-]{10,}$/.test(raw);
        const looksLikeOauth = /^GOCSP[XA][0-9A-Za-z_\-]+$/.test(raw) || raw.includes('.apps.googleusercontent.com');
        if (looksLikeApiKey || looksLikeOauth) {
          return { ok:false, value:'', reason:'credencial' };
        }
        if (looksLikeId) return { ok:true, value:raw };
        return { ok:false, value:'', reason:'formato' };
      }

      function showSheetIdWarning(reason) {
        const el = $('sheetid-warn');
        if (!reason) { el.style.display='none'; el.textContent=''; return; }
        el.style.display='block';
        if (reason === 'credencial') {
          el.textContent = 'Valor parece uma credencial (OAuth/API key), não um Spreadsheet ID.';
        } else if (reason === 'formato') {
          el.textContent = 'ID inválido. Use o trecho entre /d/ e /edit da URL.';
        } else {
          el.textContent = 'Informe o Spreadsheet ID (ou cole a URL completa).';
        }
      }

      function normalizeAndValidateSheetId() {
        const res = extractSpreadsheetId($('cfg-sheetid').value);
        if (!res.ok) { showSheetIdWarning(res.reason); return null; }
        showSheetIdWarning(null);
        $('cfg-sheetid').value = res.value;
        return res.value;
      }

      function setRemoveTestEnabled(on, msg) {
        const btn = $('btn-remove-test');
        const badge = $('test-status');
        btn.disabled = !on;
        badge.style.display = 'inline-flex';
        if (on) { badge.className = 'pill ok'; badge.textContent = msg || 'Teste encontrado'; }
        else    { badge.className = 'pill warn'; badge.textContent = msg || 'Sem linha de teste'; }
      }

      async function checkTestPresence() {
        try {
          const jsonTxt = ($('cfg-json').value||'').trim();
          const sheetId = normalizeAndValidateSheetId();
          const range   = ($('cfg-range').value||'').trim() || 'IA!A2:N';
          if (!jsonTxt || !sheetId) { setRemoveTestEnabled(false, 'Preencha JSON e Sheet ID'); return; }
          const out = await ipc.invoke('apigs:sheets:hasTest', {
            service_json: jsonTxt,
            google_sheet_id: sheetId,
            google_sheet_range: range
          });
          if (out?.ok && Number(out.count) > 0) setRemoveTestEnabled(true, `Teste(s): ${out.count}`);
          else setRemoveTestEnabled(false, 'Sem linha de teste');
        } catch {
          setRemoveTestEnabled(false, 'Não foi possível verificar');
        }
      }

      $('cfg-sheetid').addEventListener('change', normalizeAndValidateSheetId);

      $('btn-new').onclick = (e)=>{
        e.preventDefault();
        ['cfg-id','cfg-json','cfg-sheetid','cfg-range'].forEach(id=>$(id).value='');
        $('cfg-range').value = 'IA!A2:N';
        showSheetIdWarning(null);
        setRemoveTestEnabled(false, 'Sem linha de teste');
      };

      $('btn-save').onclick = async (e)=>{
        e.preventDefault();
        try{
          const jsonTxt = ($('cfg-json').value||'').trim();
          const sheetId = normalizeAndValidateSheetId();
          const range   = ($('cfg-range').value||'').trim() || 'IA!A2:N';
          if (!jsonTxt) return toastSafe('Cole o conteúdo do service-account.json.', true);
          if (!sheetId) return;
          const payload = {
            chave: $('cfg-id').value ? $('cfg-id').value : undefined,
            service_json: jsonTxt,
            google_sheet_id: sheetId,
            google_sheet_range: range
          };
          const resp = await ipc.invoke('apigs:config:save', payload);
          toastSafe(payload.chave ? 'Configuração atualizada!' : 'Configuração salva!');
          if (resp?.chave) $('cfg-id').value = resp.chave;
          loadList();
          checkTestPresence();
        }catch(err){
          console.error('[CFG] save error:', err);
          toastSafe(err?.message || String(err), true);
        }
      };

      $('btn-test').onclick = async (e)=>{
        e.preventDefault();
        try{
          const jsonTxt = ($('cfg-json').value||'').trim();
          const sheetId = normalizeAndValidateSheetId();
          const range   = ($('cfg-range').value||'').trim() || 'IA!A2:N';
          if (!jsonTxt || !sheetId) return;
          const out = await ipc.invoke('apigs:sheets:test', {
            service_json: jsonTxt,
            google_sheet_id: sheetId,
            google_sheet_range: range
          });
          toastSafe(`Teste: ${out.ok ? 'sucesso' : 'falha'}${out.note ? ' | ' + out.note : ''}`, !out.ok);
          if (out.ok) setRemoveTestEnabled(true, 'Teste adicionado');
        }catch(err){
          console.error('[CFG] test error:', err);
          toastSafe(err?.message || String(err), true);
        }
      };

      $('btn-remove-test').onclick = async (e)=>{
        e.preventDefault();
        try{
          if ($('btn-remove-test').disabled) return toastSafe('Não há linha de teste para remover.', true);
          const jsonTxt = ($('cfg-json').value||'').trim();
          const sheetId = normalizeAndValidateSheetId();
          const range   = ($('cfg-range').value||'').trim() || 'IA!A2:N';
          if (!jsonTxt || !sheetId) return;
          const out = await ipc.invoke('apigs:sheets:removeTest', {
            service_json: jsonTxt,
            google_sheet_id: sheetId,
            google_sheet_range: range
          });
          if (out?.ok) {
            toastSafe(`Removido(s): ${out.removed || 0}`);
            setRemoveTestEnabled(false, 'Sem linha de teste');
          } else {
            toastSafe(out?.error || 'Falha ao remover teste.', true);
          }
        }catch(err){
          console.error('[CFG] remove test error:', err);
          toastSafe(err?.message || String(err), true);
        }
      };

      async function loadList(){
        try{
          const rows = await ipc.invoke('apigs:config:list');
          $('cfg-tbody').innerHTML = (rows||[]).map(r=>(
            `<tr>
              <td>${r.chave}</td>
              <td>${r.google_sheet_id || ''}</td>
              <td>${r.client_email || ''}</td>
              <td>${r.project_id || ''}</td>
              <td>${r.google_sheet_range || ''}</td>
              <td style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="button outline btn-edit" data-id="${r.chave}">Editar</button>
                <button class="button outline btn-del"  data-id="${r.chave}">Excluir</button>
                <button class="button btn-quicktest" data-id="${r.chave}">Testar</button>
                <button class="button danger btn-quickremove" data-id="${r.chave}">Remover teste</button>
              </td>
            </tr>`
          )).join('');

          document.querySelectorAll('.btn-edit').forEach(b=>{
            b.onclick = async ()=>{
              try{
                const row = await ipc.invoke('apigs:config:get', String(b.dataset.id));
                $('cfg-id').value   = row.chave || '';
                const reconstructedJson = {
                  type: "service_account",
                  project_id: row.project_id,
                  private_key: row.private_key,
                  client_email: row.client_email,
                };
                $('cfg-json').value = JSON.stringify(reconstructedJson, null, 2);
                $('cfg-sheetid').value = row.google_sheet_id || '';
                $('cfg-range').value   = row.google_sheet_range || 'IA!A2:N';
                showSheetIdWarning(null);
                checkTestPresence();
              }catch(err){
                console.error('[CFG] edit load error:', err);
                toastSafe(err?.message || String(err), true);
              }
            };
          });
          document.querySelectorAll('.btn-del').forEach(b=>{
            b.onclick = async ()=>{
              if(!confirm('Excluir esta configuração?')) return;
              try{ await ipc.invoke('apigs:config:delete', String(b.dataset.id)); loadList(); }
              catch(err){
                console.error('[CFG] delete error:', err);
                toastSafe(err?.message || String(err), true);
              }
            };
          });
          document.querySelectorAll('.btn-quicktest').forEach(b=>{
            b.onclick = async ()=>{
              try{
                const out = await ipc.invoke('apigs:sheets:testById', String(b.dataset.id));
                toastSafe(`Teste: ${out.ok ? 'sucesso' : 'falha'}${out.note ? ' | ' + out.note : ''}`, !out.ok);
              }catch(err){
                console.error('[CFG] quick test error:', err);
                toastSafe(err?.message || String(err), true);
              }
            };
          });
          document.querySelectorAll('.btn-quickremove').forEach(b=>{
            b.onclick = async ()=>{
              try{
                const out = await ipc.invoke('apigs:sheets:removeTestById', String(b.dataset.id));
                if (out?.ok) toastSafe(`Removido(s): ${out.removed || 0}`); else toastSafe(out?.error || 'Falha ao remover', true);
              }catch(err){
                console.error('[CFG] quick remove error:', err);
                toastSafe(err?.message || String(err), true);
              }
            };
          });

        }catch(err){
          console.error('[CFG] list error:', err);
          toastSafe(err?.message || String(err), true);
        }
      }

      loadList();
      ['cfg-json','cfg-sheetid','cfg-range'].forEach(id=>{
        $(id).addEventListener('change', checkTestPresence);
      });
    }
  };
};

window.views = window.views || {};
window.views['cfg'] = window.renderConfiguracoes;
