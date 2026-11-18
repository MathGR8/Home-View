// Janelas: projetos, nuvem, novo cômodo, móvel personalizado, ajuda, perguntas.
import { app, $, parseLen, fmtIn } from './ctx.js';
import { store, newProject, sampleProject, roomAt } from './state.js';
import { local, cloud, syncAll } from './storage.js';
import { thumbSVG } from './plan.js';
import { icon } from './icons.js';
import { esc, parseNum, uid, fmtMoney } from './geometry.js';
import { ROOM_NAMES, FLOOR_COLORS, SYMBOLS, COLORS, STATUS, OUTDOOR_NAMES } from './catalog.js';
import { previewSVG } from './symbols.js';
import * as A from './actions.js';

const dlg = () => $('#dlg');

export function openDialog(title, body, foot = '', { wide = false } = {}) {
  const d = dlg();
  d.innerHTML = `<form class="dlg" method="dialog"><div class="dlg-h"><h2>${title}</h2><button class="ib sm" value="cancel" formnovalidate aria-label="Fechar">${icon('x')}</button></div><div class="dlg-b">${body}</div>${foot ? `<div class="dlg-f">${foot}</div>` : ''}</form>`;
  d.style.width = wide ? 'min(860px, calc(100vw - 24px))' : '';
  d.querySelector('form').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const pri = d.querySelector('.dlg-f .btn.pri');
    if (!pri) return;
    if (pri.type === 'button') pri.click(); else d.close(pri.value);
  });
  if (!d.open) d.showModal();
  return d;
}
export const closeDialog = () => { const d = dlg(); if (d.open) d.close(); };

// ---------- perguntas ----------
app.prompt = (title, label, value, unit = 'cm') => new Promise((res) => {
  const d = openDialog(title, `<label class="fld"><span>${label}</span><div class="unit"><input class="inp" id="pIn" inputmode="decimal" value="${esc(value)}" autocomplete="off"><em>${unit}</em></div></label>`,
    `<button class="btn" value="cancel">Cancelar</button><button class="btn pri" value="ok" id="pOk">OK</button>`);
  const inp = $('#pIn'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
  d.onclose = () => { d.onclose = null; res(d.returnValue === 'ok' ? inp.value : null); };
});

app.confirm = (msg, options) => new Promise((res) => {
  const opts = options || ['Sim'];
  const d = openDialog('Confirmar', `<p style="margin:0">${esc(msg)}</p>`,
    `<button class="btn" value="cancel">Cancelar</button>${opts.map((o, i) => `<button class="btn ${i === 0 ? 'pri' : ''}" value="${i}">${esc(o)}</button>`).join('')}`);
  d.onclose = () => { d.onclose = null; const v = d.returnValue; if (v === 'cancel' || v === '') res(options ? -1 : false); else res(options ? +v : true); };
});

// ---------- novo cômodo ----------
export function dlgRoom() {
  const t = store.p.settings.wallT;
  const body = `
    <div class="chips" style="margin-bottom:10px">${ROOM_NAMES.map((n) => `<button type="button" class="chip" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <label class="fld"><span>Nome</span><input class="inp" id="rName" value="Sala" autocomplete="off"></label>
    <h3>Formato</h3>
    <div class="seg" id="rShape"><button type="button" data-s="rect" class="on">Retangular</button><button type="button" data-s="L">Em L</button></div>
    <h3>Medidas internas (de parede a parede)</h3>
    <div class="grid2">
      <label class="fld"><span>Largura</span><div class="unit"><input class="inp" id="rW" inputmode="decimal" value="3,5"><em>m</em></div></label>
      <label class="fld"><span>Profundidade</span><div class="unit"><input class="inp" id="rH" inputmode="decimal" value="3"><em>m</em></div></label>
    </div>
    <div id="rL" hidden>
      <div class="grid3" style="margin-top:8px">
        <label class="fld"><span>Recorte largura</span><div class="unit"><input class="inp" id="rCW" inputmode="decimal" value="1,2"><em>m</em></div></label>
        <label class="fld"><span>Recorte prof.</span><div class="unit"><input class="inp" id="rCH" inputmode="decimal" value="1,2"><em>m</em></div></label>
        <label class="fld"><span>Canto</span><select class="inp" id="rCorner"><option value="tr">Sup. direito</option><option value="tl">Sup. esquerdo</option><option value="br">Inf. direito</option><option value="bl">Inf. esquerdo</option></select></label>
      </div>
    </div>
    <div class="grid2" style="margin-top:8px">
      <label class="fld"><span>Pé-direito</span><div class="unit"><input class="inp" id="rHt" inputmode="decimal" value="2,6"><em>m</em></div></label>
      <label class="fld"><span>Espessura da parede</span><div class="unit"><input class="inp" id="rT" inputmode="decimal" value="${t}"><em>cm</em></div></label>
    </div>
    <p class="tiny">Pode digitar em metros (3,5) ou em centímetros (350). Depois dá para ajustar cada parede e arrastar os cantos.</p>
    <h3>Piso</h3><div class="swatches" id="rFloor">${FLOOR_COLORS.map((c, i) => `<button type="button" class="swatch ${i === 0 ? 'on' : ''}" style="--c:${c}" data-c="${c}"></button>`).join('')}</div>
    <label class="check" style="margin-top:12px"><span>Sem paredes (área externa, quintal)</span><input type="checkbox" id="rOut"></label>
    <p class="err-msg" id="rErr"></p>`;
  const d = openDialog('Novo cômodo', body, `<button class="btn" value="cancel">Cancelar</button><button class="btn pri" type="button" id="rOk">Adicionar</button>`);
  let shape = 'rect', floor = FLOOR_COLORS[0];
  const pickFloor = (c) => { floor = c; d.querySelectorAll('#rFloor .swatch').forEach((x) => x.classList.toggle('on', x.dataset.c === c)); };
  d.querySelectorAll('[data-name]').forEach((b) => b.onclick = () => {
    $('#rName').value = b.dataset.name;
    const out = OUTDOOR_NAMES.has(b.dataset.name);
    $('#rOut').checked = out;
    if (out) pickFloor('#8fbf6a');
  });
  d.querySelectorAll('#rShape button').forEach((b) => b.onclick = () => { shape = b.dataset.s; d.querySelectorAll('#rShape button').forEach((x) => x.classList.toggle('on', x === b)); $('#rL').hidden = shape !== 'L'; });
  d.querySelectorAll('#rFloor .swatch').forEach((b) => b.onclick = () => { floor = b.dataset.c; d.querySelectorAll('#rFloor .swatch').forEach((x) => x.classList.toggle('on', x === b)); });
  $('#rOk').onclick = () => {
    const w = parseLen($('#rW').value, true), h = parseLen($('#rH').value, true);
    const height = parseLen($('#rHt').value, true), wallT = parseLen($('#rT').value, false);
    if (!(w >= 30 && h >= 30)) { $('#rErr').textContent = 'Confira a largura e a profundidade.'; return; }
    const o = { name: $('#rName').value.trim() || 'Cômodo', shape, w, h, height: height > 0 ? height : 260, wallT: wallT > 0 ? wallT : t, floor, noWalls: $('#rOut').checked };
    if (shape === 'L') {
      o.cw = parseLen($('#rCW').value, true); o.ch = parseLen($('#rCH').value, true); o.corner = $('#rCorner').value;
      if (!(o.cw > 0 && o.cw < w && o.ch > 0 && o.ch < h)) { $('#rErr').textContent = 'O recorte do L precisa ser menor que o cômodo.'; return; }
    }
    closeDialog();
    A.addRoom(o);
    app.toast(`${o.name} adicionado`);
    if (app.isMobile()) app.closeSheets();
  };
}

// ---------- móvel personalizado ----------
export function dlgCustomItem() {
  const body = `
    <div class="row" style="align-items:flex-start;gap:14px">
      <div id="ciPrev" style="width:96px;height:96px;flex:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:12px;background:var(--panel2)"></div>
      <div style="flex:1;display:grid;gap:8px">
        <label class="fld"><span>Nome</span><input class="inp" id="ciName" value="Meu móvel" autocomplete="off"></label>
        <label class="fld"><span>Desenho</span><select class="inp" id="ciSym">${SYMBOLS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
      </div>
    </div>
    <h3>Medidas (cm)</h3>
    <div class="grid3">
      <label class="fld"><span>Largura</span><div class="unit"><input class="inp" id="ciW" inputmode="decimal" value="100"><em>cm</em></div></label>
      <label class="fld"><span>Profundidade</span><div class="unit"><input class="inp" id="ciD" inputmode="decimal" value="50"><em>cm</em></div></label>
      <label class="fld"><span>Altura</span><div class="unit"><input class="inp" id="ciH" inputmode="decimal" value="80"><em>cm</em></div></label>
    </div>
    <div class="grid2" style="margin-top:8px">
      <label class="fld"><span>Formato</span><select class="inp" id="ciShape"><option value="rect">Retangular</option><option value="round">Redondo / oval</option></select></label>
      <label class="fld"><span>Fica</span><select class="inp" id="ciLayer"><option value="normal">No chão</option><option value="floor">Tapete (por baixo)</option><option value="wall">Na parede / suspenso</option></select></label>
    </div>
    <h3>Cor</h3><div class="swatches" id="ciCol">${COLORS.map((c, i) => `<button type="button" class="swatch ${i === 0 ? 'on' : ''}" style="--c:${c}" data-c="${c}"></button>`).join('')}<input type="color" class="swatch-in" id="ciColIn" value="${COLORS[0]}"></div>
    <label class="check" style="margin-top:12px"><span>Guardar em “Meus móveis” para usar de novo</span><input type="checkbox" id="ciLib" checked></label>
    <p class="err-msg" id="ciErr"></p>`;
  const d = openDialog('Criar móvel', body, `<button class="btn" value="cancel">Cancelar</button><button class="btn pri" type="button" id="ciOk">Adicionar na planta</button>`);
  let color = COLORS[0];
  const def = () => ({ n: $('#ciName').value.trim() || 'Móvel', sym: $('#ciSym').value, shape: $('#ciShape').value, w: parseNum($('#ciW').value), d: parseNum($('#ciD').value), h: parseNum($('#ciH').value), color, layer: $('#ciLayer').value, elev: $('#ciLayer').value === 'wall' ? 120 : 0 });
  const prev = () => { const x = def(); if (x.w > 0 && x.d > 0) $('#ciPrev').innerHTML = previewSVG(x, 84); };
  d.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', prev));
  d.querySelectorAll('#ciCol .swatch').forEach((b) => b.onclick = () => { color = b.dataset.c; d.querySelectorAll('#ciCol .swatch').forEach((x) => x.classList.toggle('on', x === b)); prev(); });
  $('#ciColIn').addEventListener('input', (e) => { color = e.target.value; d.querySelectorAll('#ciCol .swatch').forEach((x) => x.classList.remove('on')); prev(); });
  $('#ciSym').addEventListener('change', () => { const s = $('#ciSym').value; if (['roundtable', 'stool', 'lamp', 'plant', 'officechair', 'petbed'].includes(s)) $('#ciShape').value = 'round'; if (s === 'rug') $('#ciLayer').value = 'floor'; prev(); });
  prev();
  $('#ciOk').onclick = () => {
    const x = def();
    if (!(x.w > 0 && x.d > 0 && x.h >= 0)) { $('#ciErr').textContent = 'Confira as medidas.'; return; }
    x.k = 'lib' + uid();
    closeDialog();
    if ($('#ciLib')?.checked !== false) store.change((p) => p.library.push(x));
    A.addItem(x);
    app.toast(`${x.n} adicionado`);
  };
}

// ---------- projetos ----------
const fmtDate = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function dlgProjects() {
  const render = () => {
    const idx = local.list().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const user = cloud.user;
    let h = `<div class="cloudbox">${user
      ? `<div class="row wrap"><span style="color:var(--ok)">${icon('cloud')}</span><div class="grow"><b>Conectado como ${esc(user)}</b><div class="tiny">Seus projetos ficam salvos na nuvem e aparecem em qualquer aparelho em que você entrar.</div></div><button class="btn sm" type="button" data-pa="sync">${icon('sync', 16)}Sincronizar</button><button class="btn sm" type="button" data-pa="logout">${icon('logout', 16)}Sair</button></div>`
      : `<div class="row wrap"><span style="color:var(--text3)">${icon('cloud')}</span><div class="grow"><b>Salvo só neste aparelho</b><div class="tiny">Crie uma conta (só usuário e senha) para guardar na nuvem e abrir no celular e no computador.</div></div><button class="btn pri sm" type="button" data-pa="login">Entrar / criar conta</button></div>`}</div>`;
    h += `<div class="btnrow" style="margin-bottom:12px"><button class="btn pri" type="button" data-pa="new">${icon('plus', 16)}Novo projeto</button><button class="btn" type="button" data-pa="sample">${icon('home', 16)}Abrir exemplo</button><button class="btn" type="button" data-pa="import">${icon('upload', 16)}Importar arquivo</button></div>`;
    h += `<div class="projs">`;
    for (const e of idx) {
      const on = store.p?.id === e.id;
      const synced = user && e.syncedAt && e.syncedAt >= (e.updatedAt || 0);
      h += `<div class="proj ${on ? 'on' : ''}"><button type="button" class="th" data-pa="open" data-id="${e.id}" style="border:0;cursor:pointer">${e.thumb || ''}</button>
        <div class="meta"><b title="${esc(e.name)}">${esc(e.name)}</b><small>${fmtDate(e.updatedAt)}${user ? (synced ? ' · na nuvem' : ' · só aqui') : ''}</small></div>
        <div class="pa"><button type="button" class="ib sm" data-pa="open" data-id="${e.id}" title="Abrir">${icon('folder', 17)}</button><button type="button" class="ib sm" data-pa="rename" data-id="${e.id}" title="Renomear">${icon('edit', 17)}</button><button type="button" class="ib sm" data-pa="dup" data-id="${e.id}" title="Duplicar">${icon('copy', 17)}</button><button type="button" class="ib sm" data-pa="del" data-id="${e.id}" title="Apagar" style="color:var(--danger)">${icon('trash', 17)}</button></div></div>`;
    }
    h += '</div>';
    if (!idx.length) h += `<p class="muted">Nenhum projeto salvo ainda.</p>`;
    return h;
  };
  const d = openDialog('Projetos', render(), '', { wide: true });
  const body = d.querySelector('.dlg-b');
  const refresh = () => { body.innerHTML = render(); };
  body.onclick = async (e) => {
    const b = e.target.closest('[data-pa]'); if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.pa) {
      case 'open': closeDialog(); await app.openProject(id); break;
      case 'new': {
        const name = await askText('Novo projeto', 'Nome do projeto', 'Minha casa nova');
        if (name === null) return dlgProjects();
        const p = newProject(name || 'Novo projeto');
        app.saveNow(p); app.loadProject(p);
        app.toast('Projeto criado — comece adicionando os cômodos');
        app.tab = 'rooms'; app.renderLeft();
        if (app.isMobile()) app.openSheet('rooms');
        break;
      }
      case 'sample': { closeDialog(); const p = sampleProject(); app.saveNow(p); app.loadProject(p); break; }
      case 'import': closeDialog(); $('#fileIn').click(); break;
      case 'rename': {
        const e2 = local.list().find((x) => x.id === id);
        const name = await askText('Renomear', 'Nome do projeto', e2?.name || '');
        if (name) {
          if (store.p?.id === id) { store.change((p) => { p.name = name; }); }
          else { const p = local.get(id); if (p) { p.name = name; p.updatedAt = Date.now(); app.saveNow(p); } }
        }
        dlgProjects(); break;
      }
      case 'dup': {
        const src = store.p?.id === id ? store.p : local.get(id) || (cloud.user ? (await cloud.obter(id)).dados : null);
        if (!src) return;
        const p = JSON.parse(JSON.stringify(src)); p.id = uid('p'); p.name = src.name + ' (cópia)'; p.createdAt = p.updatedAt = Date.now();
        app.saveNow(p); refresh(); break;
      }
      case 'del': {
        const e2 = local.list().find((x) => x.id === id);
        const ok = await app.confirm(`Apagar o projeto “${e2?.name}”? Isso não pode ser desfeito.`);
        if (ok) {
          local.remove(id);
          if (cloud.user) cloud.apagar(id).catch(() => {});
          if (store.p?.id === id) { const next = local.list().sort((a, b) => b.updatedAt - a.updatedAt)[0]; if (next) await app.openProject(next.id); else { const p = sampleProject(); app.saveNow(p); app.loadProject(p); } }
        }
        dlgProjects(); break;
      }
      case 'login': dlgCloud(); break;
      case 'logout': await cloud.sair(); app.updateSaveState(); refresh(); app.toast('Você saiu da conta. Os projetos continuam neste aparelho.'); break;
      case 'sync': b.disabled = true; try { await app.syncNow(true); } finally { refresh(); } break;
    }
  };
}

function askText(title, label, value) {
  return new Promise((res) => {
    const d = openDialog(title, `<label class="fld"><span>${label}</span><input class="inp" id="tIn" value="${esc(value)}" autocomplete="off"></label>`, `<button class="btn" value="cancel">Cancelar</button><button class="btn pri" value="ok">OK</button>`);
    const inp = $('#tIn'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
    d.onclose = () => { d.onclose = null; res(d.returnValue === 'ok' ? inp.value.trim() : null); };
  });
}

// ---------- conta na nuvem ----------
export function dlgCloud() {
  const body = `<p class="muted" style="margin-top:0">Com uma conta, seus projetos ficam guardados na nuvem e você abre os mesmos projetos no celular e no computador. Não pedimos e-mail: guarde bem seu usuário e sua senha.</p>
    <div class="seg" id="cMode" style="margin-bottom:12px"><button type="button" data-m="entrar" class="on">Entrar</button><button type="button" data-m="criar">Criar conta</button></div>
    <div style="display:grid;gap:8px">
      <label class="fld"><span>Usuário</span><input class="inp" id="cUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ex.: joao.silva"></label>
      <label class="fld"><span>Senha</span><input class="inp" id="cPass" type="password" autocomplete="current-password" placeholder="mínimo 6 caracteres"></label>
      <label class="fld" id="cPass2Wrap" hidden><span>Repita a senha</span><input class="inp" id="cPass2" type="password" autocomplete="new-password"></label>
    </div><p class="err-msg" id="cErr"></p>`;
  const d = openDialog('Salvar na nuvem', body, `<button class="btn" value="cancel">Cancelar</button><button class="btn pri" type="button" id="cOk">Entrar</button>`);
  let mode = 'entrar';
  d.querySelectorAll('#cMode button').forEach((b) => b.onclick = () => {
    mode = b.dataset.m; d.querySelectorAll('#cMode button').forEach((x) => x.classList.toggle('on', x === b));
    $('#cPass2Wrap').hidden = mode !== 'criar'; $('#cOk').textContent = mode === 'criar' ? 'Criar conta' : 'Entrar';
    $('#cPass').autocomplete = mode === 'criar' ? 'new-password' : 'current-password';
  });
  const go = async () => {
    const u = $('#cUser').value.trim().toLowerCase(), s = $('#cPass').value;
    const err = $('#cErr');
    if (!/^[a-z0-9._-]{3,32}$/.test(u)) { err.textContent = 'Usuário: 3 a 32 letras, números, ponto, hífen ou _ (sem espaços).'; return; }
    if (s.length < 6) { err.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    if (mode === 'criar' && s !== $('#cPass2').value) { err.textContent = 'As senhas não são iguais.'; return; }
    $('#cOk').disabled = true; err.textContent = '';
    try {
      if (mode === 'criar') await cloud.criar(u, s); else await cloud.entrar(u, s);
      closeDialog();
      app.toast(mode === 'criar' ? 'Conta criada! Enviando seus projetos…' : 'Conectado! Sincronizando…');
      await app.syncNow(true);
    } catch (e) {
      err.textContent = e.status === 404 && !e.message.startsWith('Usu') ? 'A nuvem só funciona no site publicado (Cloudflare).' : e.message;
      $('#cOk').disabled = false;
    }
  };
  $('#cOk').onclick = go;
}

// ---------- ajuda ----------
export function dlgHelp() {
  const body = `<div class="help">
    <h3>Começando</h3>
    <ol class="muted" style="padding-left:18px;margin:0;display:grid;gap:6px">
      <li><b>Cômodos</b> → “Novo cômodo”: digite largura e profundidade (pode ser em metros). Os próximos cômodos encostam ao lado; arraste para encaixar parede com parede.</li>
      <li>Toque no cômodo para adicionar <b>portas, janelas e vãos</b> em cada parede, mudar o pé-direito e a cor do piso.</li>
      <li><b>Móveis</b>: escolha no catálogo ou crie com as medidas do seu móvel. Ele aparece no meio da tela.</li>
      <li>Arraste os móveis. Com o <b>ímã</b> ligado, eles grudam nas paredes, nos cantos e nos outros móveis.</li>
      <li>Veja o resultado no <b>3D</b> (botão no topo).</li>
    </ol>
    <h3>Mezanino e escadas</h3>
    <ol class="muted" style="padding-left:18px;margin:0;display:grid;gap:6px">
      <li><b>Móveis → Estrutura → Mezanino metálico</b>: ajuste largura, profundidade, altura do piso, guarda-corpo e cores.</li>
      <li>Adicione uma <b>Escada</b>, gire no ângulo que precisar (bolinha de giro ou digitando) e escolha a inclinação. <b>Encaixar no mezanino</b> leva o topo dela até a beirada e iguala a altura; o guarda-corpo abre sozinho ali.</li>
      <li>Para pôr móveis em cima: selecione o mezanino e escolha o móvel, ou no móvel use <b>Andar → Em cima do mezanino</b>.</li>
      <li>Mezanino preso nas paredes: <b>Pilares → Nenhum</b>, ou no 3D toque num pilar e escolha <b>Tirar este pilar</b>.</li>
      <li><b>Pegar o que está embaixo</b>: toque de novo no mesmo lugar (ou escolha na barra “Aqui tem…”). Na planta, o botão de camadas mostra <b>só o térreo</b> (mezanino transparente) ou <b>só o mezanino</b>. No 3D, o <b>Raio-X</b> deixa mezanino e escadas transparentes e o toque passa por eles.</li>
    </ol>
    <h3>Paredes, área externa e pessoas</h3>
    <ol class="muted" style="padding-left:18px;margin:0;display:grid;gap:6px">
      <li><b>Cortar parede</b>: no cômodo, botão <b>Corte</b> na parede (largura e mureta ajustáveis) ou <b>Tirar parede</b> para remover a parede inteira. No 3D, toque na parede e escolha <b>Cortar aqui</b>. Sobrou um pilarzinho no canto? Toque nele e escolha <b>Tirar este pilar</b>.</li>
      <li><b>Banheiro embaixo da escada</b>: corte a parede onde for preciso e feche com <b>Área externa → Parede divisória</b> e <b>Parede inclinada</b> (altura diferente no início e no fim acompanha a escada).</li>
      <li><b>Área externa</b>: cômodo “Quintal” ou “Área externa” (sem paredes), pisos de grama/concreto/deck, muros, grades (vertical, diagonal, losango) e portões.</li>
      <li><b>Pessoas</b>: coloque um homem e uma mulher com as alturas reais para comparar com móveis e bancadas. <b>Ver pelos olhos no 3D</b> mostra o ambiente na altura dos olhos dela/dele.</li>
      <li><b>Luz</b>: lâmpadas, plafons, spots, pendentes e iluminação industrial acendem no 3D no modo <b>Noite</b>. Com <b>Presa no teto</b> ligada, a altura acompanha o pé-direito (ou o piso do mezanino); <b>Centralizar no cômodo</b> põe a luz no meio.</li>
      <li><b>Pisos</b>: no cômodo escolha liso, madeira, porcelanato, cerâmica, cimento queimado, concreto, deck, grama, terra ou pedrisco.</li>
      <li><b>Garagem e escritório</b>: carros (hatch, sedã, SUV), moto, computador, monitores, notebook, teclado e impressora.</li>
    </ol>
    <h3>Andar no 3D</h3>
    <dl>
      <dt>Andar</dt><dd>botão “Andar” no 3D: você fica na altura dos olhos, sobe a escada e anda no mezanino</dd>
      <dt>Dois controles</dt><dd>o da <b>esquerda</b> anda (frente, trás, para os lados); o da <b>direita</b> gira a câmera: para a direita gira no sentido horário, para a esquerda no anti-horário, para cima/baixo olha para cima/baixo</dd>
      <dt><span class="kbd">W</span> <span class="kbd">A</span> <span class="kbd">S</span> <span class="kbd">D</span></dt><dd>andar (Shift: mais rápido) · <span class="kbd">←</span> <span class="kbd">→</span> girar · <span class="kbd">↑</span> <span class="kbd">↓</span> frente/trás · arrastar: olhar em volta</dd>
      <dt><span class="kbd">E</span> <span class="kbd">Q</span></dt><dd>subir / descer (modo Voar, atravessa tudo)</dd>
      <dt>Toque / clique</dt><dd>num objeto: seleciona e mostra opções (apagar, tirar pilar, cortar parede…). Toque de novo no mesmo lugar para pegar o que está atrás/embaixo</dd>
      <dt>Mouse (computador)</dt><dd>no modo Andar, clique na cena: o mouse olha em volta como num jogo, <b>W A S D</b> anda, Shift corre, clique seleciona o que está na mira (+), <b>Esc</b> solta o mouse</dd>
      <dt>Controle flutuante</dt><dd>no celular, o controle da direita aparece onde você tocar dentro da zona do canto de baixo à direita (ajuste a zona em “Controles”)</dd>
      <dt>Escada</dt><dd>andando, você não cai de beirada alta (mezanino, lado da escada); para descer sem escada use “Voar”</dd>
      <dt>Controles</dt><dd>botão “Controles” no 3D: sensibilidade, visibilidade (transparência) e tamanho de cada controle, e <b>Mover na tela</b> para arrastar cada um para onde quiser</dd>
      <dt>Toque duplo</dt><dd>no chão ou no mezanino: vai até lá</dd>
    </dl>
    <h3>No computador</h3>
    <dl>
      <dt>Seta (ferramentas)</dt><dd>toque de novo na seta para alternar entre <b>mover objetos</b> e <b>mover a planta</b> (mãozinha: arrastar só move a planta, tocar ainda seleciona)</dd>
      <dt>Tela cheia</dt><dd>botão no topo (ou menu ⋮): esconde a barra do navegador; toque de novo para sair</dd>
      <dt>Arrastar no vazio</dt><dd>move a planta · roda do mouse: zoom</dd>
      <dt>Shift + clique</dt><dd>seleciona vários · Shift + arrastar no vazio: seleção por área</dd>
      <dt>Shift ao arrastar</dt><dd>desliga o ímã momentaneamente / giro livre</dd>
      <dt><span class="kbd">R</span> <span class="kbd">Shift R</span></dt><dd>girar 90°</dd>
      <dt><span class="kbd">Setas</span></dt><dd>mover 1 cm (com Shift: 10 cm)</dd>
      <dt><span class="kbd">Ctrl D</span> <span class="kbd">Ctrl C</span> <span class="kbd">Ctrl V</span></dt><dd>duplicar, copiar e colar</dd>
      <dt><span class="kbd">Delete</span></dt><dd>apagar</dd>
      <dt><span class="kbd">Ctrl Z</span> <span class="kbd">Ctrl Y</span></dt><dd>desfazer / refazer</dd>
      <dt><span class="kbd">M</span> <span class="kbd">V</span></dt><dd>régua / selecionar</dd>
      <dt><span class="kbd">F</span></dt><dd>ver tudo</dd>
    </dl>
    <h3>No celular</h3>
    <dl>
      <dt>Um dedo</dt><dd>arrasta móveis; no vazio, move a planta</dd>
      <dt>Dois dedos</dt><dd>zoom e mover</dd>
      <dt>Segurar o dedo</dt><dd>num móvel liga a seleção de vários</dd>
      <dt>Toque duplo</dt><dd>num móvel abre todas as opções</dd>
    </dl>
    <h3>Cores e avisos</h3>
    <p class="muted" style="margin:0">Contorno <b style="color:#e53e3e">vermelho</b>: móvel batendo em outro ou atravessando parede. Tracejado <b style="color:#c05621">laranja</b>: item para comprar. Linhas azuis: distâncias até a parede/móvel (toque para digitar a medida exata).</p>
  </div>`;
  openDialog('Como usar', body, `<button class="btn pri" value="ok">Entendi</button>`);
}

// ---------- lista em planilha ----------
export function exportCSV() {
  const p = store.p;
  const rows = [['Cômodo', 'Item', 'Largura (cm)', 'Profundidade (cm)', 'Altura (cm)', 'Status', 'Preço', 'Anotações']];
  for (const it of p.items) {
    if (it.sym === 'person') continue;
    const r = roomAt(p, it.x, it.y);
    rows.push([r ? r.name : 'Fora dos cômodos', it.name, Math.round(it.w), Math.round(it.d), Math.round(it.h), STATUS[it.status]?.n || '', String(it.price || 0).replace('.', ','), it.note || '']);
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  app.download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${p.name} - lista.csv`);
}

export { fmtMoney, fmtIn };
