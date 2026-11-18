// Painéis: à esquerda (cômodos, catálogo, lista) e propriedades (à direita / folha no celular).
import { app, $, $$, parseLen, fmtIn } from './ctx.js';
import { store, analyze, roomAt } from './state.js';
import { CATALOG, COLORS, FLOOR_COLORS, STATUS, OPENING_TYPES, SYMBOLS, FENCE_PATTERNS, GATE_STYLES, GROUND_TEX, CAT_COATS, LIGHT_SYMS } from './catalog.js';
import { previewSVG } from './symbols.js';
import { icon } from './icons.js';
import { esc, fmtLen, fmtArea, fmtMoney, signedArea, bbox, edgesOf, pointInPoly, parseNum, normAng } from './geometry.js';
import * as A from './actions.js';
import { dlgRoom, dlgCustomItem, exportCSV } from './dialogs.js';
import { isMezz, isStair, stairInfo, setStairRun, mezzCols, STEEL_COLORS, DECK_COLORS, SIDE_NAMES, STRUCT_KEYS } from './struct.js';

// ---------- utilitários de HTML ----------
const numF = (label, f, v, unit = 'cm', extra = '') => `<label class="fld"><span>${label}</span><div class="unit"><input class="inp" data-f="${f}" inputmode="decimal" autocomplete="off" value="${fmtIn(v)}" ${extra}><em>${unit}</em></div></label>`;
const ib = (act, ic, title, cls = '', data = '') => `<button class="ib ${cls}" data-act="${act}" ${data} title="${title}" aria-label="${title}">${icon(ic)}</button>`;
const btn = (act, label, cls = '', data = '', ic = '') => `<button class="btn ${cls}" data-act="${act}" ${data}>${ic ? icon(ic, 16) : ''}${label}</button>`;
const isRectRoom = (r) => r.points.length === 4 && edgesOf(r.points).every((e) => Math.abs(e.dir[0]) < 0.001 || Math.abs(e.dir[1]) < 0.001);

let catFilter = 'Todos';
let catQuery = '';
let listFilter = 'todos';

// ================= painel da esquerda =================
export function renderLeft() {
  const body = $('#leftBody');
  $$('#left .tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === app.tab));
  if (!store.p) { body.innerHTML = ''; return; }
  const keepScroll = body.dataset.tab === app.tab ? body.scrollTop : 0;
  const focusId = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart;
  body.dataset.tab = app.tab;
  if (app.tab === 'rooms') body.innerHTML = roomsHTML();
  else if (app.tab === 'catalog') body.innerHTML = catalogHTML();
  else body.innerHTML = listHTML();
  body.scrollTop = keepScroll;
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* ignora */ } } }
}

function roomsHTML() {
  const p = store.p;
  const total = p.rooms.reduce((s, r) => s + Math.abs(signedArea(r.points)), 0);
  let h = `<button class="btn pri full" data-act="newRoom">${icon('plus', 16)}Novo cômodo</button>`;
  h += `<p class="tiny" style="margin:8px 2px 4px">Toque num cômodo para editar medidas, paredes, portas e janelas. Arraste as paredes ou os cantos para mudar o formato.</p>`;
  if (!p.rooms.length) return h + `<p class="muted" style="margin-top:16px">Nenhum cômodo ainda. Comece adicionando a sala, os quartos, a cozinha…</p>`;
  h += `<div class="group-h"><span>${p.rooms.length} cômodo${p.rooms.length > 1 ? 's' : ''}</span><span>${fmtArea(total)}</span></div><div class="lst">`;
  for (const r of p.rooms) {
    const b = bbox(r.points);
    const n = p.items.filter((i) => pointInPoly(i.x, i.y, r.points)).length;
    const on = store.sel?.kind === 'room' && store.sel.id === r.id;
    h += `<button class="li ${on ? 'on' : ''}" data-act="pickRoom" data-id="${r.id}"><span class="sw" style="--c:${esc(r.floor)}"></span><span class="grow"><b>${esc(r.name)}</b><small>${fmtLen(b.x2 - b.x1, 'm')} × ${fmtLen(b.y2 - b.y1, 'm')} · ${fmtArea(Math.abs(signedArea(r.points)))} · ${n} ite${n === 1 ? 'm' : 'ns'}</small></span></button>`;
  }
  return h + '</div>';
}

function catalogHTML() {
  const p = store.p;
  const cats = ['Todos', ...(p.library.length ? ['Meus móveis'] : []), ...CATALOG.map((c) => c.cat)];
  let h = `<div class="search">${icon('search', 16)}<input class="inp" id="catSearch" placeholder="Buscar móvel (ex.: cama, mesa)" value="${esc(catQuery)}" autocomplete="off"></div>`;
  h += `<div class="chips">${cats.map((c) => `<button class="chip ${c === catFilter ? 'on' : ''}" data-act="catFilter" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  const q = catQuery.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = (d) => !q || d.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
  const groups = [];
  if (p.library.length && (catFilter === 'Todos' || catFilter === 'Meus móveis')) groups.push({ cat: 'Meus móveis', items: p.library, lib: true });
  for (const c of CATALOG) if (catFilter === 'Todos' || catFilter === c.cat) groups.push(c);
  let first = true;
  for (const g of groups) {
    const items = g.items.filter(match);
    if (!items.length && !(first && !q)) continue;
    h += `<div class="cat-h">${esc(g.cat)}</div><div class="cards">`;
    if (first && !q) h += `<button class="card new" data-act="customItem">${icon('plus', 22)}Criar móvel com suas medidas</button>`;
    first = false;
    for (const d of items) {
      h += `<button class="card" data-act="addItem" data-k="${esc(d.k)}" data-lib="${g.lib ? 1 : ''}" title="${esc(d.n)}">${previewSVG(d)}<b>${esc(d.n)}</b><small>${d.w} × ${d.d} cm</small></button>`;
    }
    h += '</div>';
  }
  if (first) h += `<p class="muted">Nada encontrado. Que tal <button class="btn sm" data-act="customItem">criar um móvel</button> com as medidas que você quer?</p>`;
  return h;
}

function listHTML() {
  const p = store.p;
  const filters = [['todos', 'Todos'], ...Object.entries(STATUS).map(([k, v]) => [k, v.n])];
  let h = `<div class="chips">${filters.map(([k, n]) => `<button class="chip ${listFilter === k ? 'on' : ''}" data-act="listFilter" data-k="${k}">${n} <span class="tiny">${p.items.filter((i) => i.sym !== 'person' && (k === 'todos' || i.status === k)).length}</span></button>`).join('')}</div>`;
  const items = p.items.filter((i) => i.sym !== 'person' && (listFilter === 'todos' || i.status === listFilter));
  const groups = new Map();
  for (const it of items) {
    const r = roomAt(p, it.x, it.y);
    const key = r ? r.name : 'Fora dos cômodos';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  if (!items.length) h += `<p class="muted" style="margin-top:14px">Nenhum móvel ${listFilter === 'todos' ? 'ainda' : 'com esse status'}.</p>`;
  for (const [name, its] of groups) {
    h += `<div class="group-h"><span>${esc(name)}</span><span>${its.length}</span></div><div class="lst">`;
    for (const it of its) {
      const st = STATUS[it.status] || STATUS.tenho;
      h += `<button class="li ${store.isSel(it.id) ? 'on' : ''}" data-act="pickItem" data-id="${it.id}"><span class="sw" style="--c:${esc(it.color)}"></span><span class="grow"><b>${esc(it.name)}</b><small>${Math.round(it.w)} × ${Math.round(it.d)} × ${Math.round(it.h)} cm${it.price ? ' · ' + fmtMoney(it.price) : ''}</small></span><span class="pill" style="--c:${st.c}">${st.n}</span></button>`;
    }
    h += '</div>';
  }
  const buy = p.items.filter((i) => i.status === 'comprar');
  const total = buy.reduce((s, i) => s + (+i.price || 0), 0);
  h += `<div class="hr"></div><div class="row" style="justify-content:space-between"><span class="muted">${buy.length} para comprar</span><b>${fmtMoney(total)}</b></div>`;
  h += `<div class="btnrow" style="margin-top:10px">${btn('exportCSV', 'Exportar lista (planilha)', 'sm', '', 'download')}</div>`;
  return h;
}

export function bindLeft() {
  const body = $('#leftBody');
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const d = b.dataset;
    switch (d.act) {
      case 'newRoom': dlgRoom(); break;
      case 'pickRoom': store.select({ kind: 'room', id: d.id }); A.zoomToSel(); if (app.isMobile()) app.openSheet('props'); break;
      case 'pickItem': store.select({ kind: 'items', ids: [d.id] }); A.zoomToSel(); if (app.isMobile()) app.openSheet('props'); break;
      case 'catFilter': catFilter = d.c; renderLeft(); break;
      case 'listFilter': listFilter = d.k; renderLeft(); break;
      case 'customItem': dlgCustomItem(); break;
      case 'exportCSV': exportCSV(); break;
      case 'addItem': {
        const def = d.lib ? store.p.library.find((x) => x.k === d.k) : CATALOG.flatMap((c) => c.items).find((x) => x.k === d.k);
        if (!def) return;
        A.addItem(def);
        app.toast(`${def.n} adicionado — arraste para posicionar`);
        if (app.isMobile()) app.openSheet('props', true);
        break;
      }
    }
  });
  body.addEventListener('input', (e) => {
    if (e.target.id === 'catSearch') { catQuery = e.target.value; renderLeft(); }
  });
}

// ================= propriedades =================
export function renderProps() {
  const body = $('#propsBody');
  if (!store.p) { body.innerHTML = ''; return; }
  const ae = document.activeElement;
  const focusF = ae && body.contains(ae) ? ae.dataset.f : null;
  const scroll = body.scrollTop;
  const s = store.sel;
  let h;
  if (s?.kind === 'items') h = store.sel.ids.length === 1 ? itemProps(store.selItems()[0]) : multiProps(store.selItems());
  else if (s?.kind === 'room') h = roomProps(store.room(s.id));
  else if (s?.kind === 'opening') h = openingProps(store.room(s.room), store.room(s.room)?.openings.find((o) => o.id === s.id));
  else if (s?.kind === 'measure') h = measureProps(store.p.measures.find((m) => m.id === s.id));
  else h = projectProps();
  body.innerHTML = h;
  body.scrollTop = scroll;
  if (focusF) { const el = body.querySelector(`[data-f="${focusF}"]`); if (el) el.focus(); }
  // altura do "peek" no celular = cabeçalho + ações rápidas
  const q = body.querySelector('.quick');
  const peek = q ? q.getBoundingClientRect().bottom - body.getBoundingClientRect().top + 30 : 76;
  $('#props').style.setProperty('--peek', Math.max(76, Math.min(170, peek)) + 'px');
}

function itemProps(it) {
  if (it.layer === 'struct') return structProps(it);
  const st = it.status || 'tenho';
  const lockT = it.locked ? 'Destravar posição' : 'Travar posição';
  let h = `<div class="ph"><span class="dot" style="--c:${esc(it.color)}"></span><input class="inp" data-f="name" value="${esc(it.name)}" aria-label="Nome"></div>`;
  h += `<div class="quick">${ib('rot', 'rotL', 'Girar 90° à esquerda', '', 'data-v="-90"')}${ib('rot', 'rotR', 'Girar 90° à direita', '', 'data-v="90"')}${ib('dup', 'copy', 'Duplicar (Ctrl+D)')}${ib('lock', it.locked ? 'lock' : 'unlock', lockT, it.locked ? 'on' : '')}${ib('front', 'front', 'Trazer para frente')}${ib('del', 'trash', 'Apagar (Delete)', 'dng')}</div>`;
  h += `<h3>Medidas</h3><div class="grid3">${numF('Largura', 'w', it.w)}${numF('Profund.', 'd', it.d)}${numF('Altura', 'h', it.h)}</div>`;
  h += `<div class="row" style="margin-top:8px;align-items:flex-end">${numF('Giro', 'rot', it.rot, '°')}<button class="btn sm" data-act="swapWD" title="Trocar largura e profundidade">L ⇄ P</button></div>`;
  h += extraProps(it);
  h += pushHTML();
  h += `<h3>Cor</h3>${swatches('color', it.color, COLORS)}`;
  h += statusHTML(st, it.price, it.note);
  h += `<h3>Tipo</h3><div class="grid2"><label class="fld"><span>Fica</span><select class="inp" data-f="layer"><option value="normal" ${it.layer === 'normal' ? 'selected' : ''}>No chão</option><option value="floor" ${it.layer === 'floor' ? 'selected' : ''}>Tapete (por baixo)</option><option value="wall" ${it.layer === 'wall' ? 'selected' : ''}>Na parede / suspenso</option></select></label>`;
  h += it.layer === 'wall' ? numF('Altura do chão', 'elev', it.elev || 0) : `<label class="fld"><span>Formato</span><select class="inp" data-f="shape"><option value="rect" ${it.shape !== 'round' ? 'selected' : ''}>Retangular</option><option value="round" ${it.shape === 'round' ? 'selected' : ''}>Redondo / oval</option></select></label>`;
  h += `</div>`;
  if (store.p.items.some(isMezz)) h += `<label class="fld" style="margin-top:8px"><span>Andar</span><select class="inp" data-f="lvl"><option value="0" ${!it.lvl ? 'selected' : ''}>Térreo (embaixo)</option><option value="1" ${it.lvl ? 'selected' : ''}>Em cima do mezanino</option></select></label>`;
  h += `<label class="fld" style="margin-top:8px"><span>Desenho</span><select class="inp" data-f="sym">${SYMBOLS.map(([k, n]) => `<option value="${k}" ${it.sym === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  h += `<div class="btnrow" style="margin-top:14px">${btn('saveLib', 'Salvar em Meus móveis', 'sm', '', 'book')}${btn('zoomSel', 'Centralizar na tela', 'sm', '', 'target')}</div>`;
  const a = analyze(store.p);
  if (a.bad.has(it.id)) h += `<p class="muted" style="color:var(--danger);margin-top:12px">${icon('warn', 14)} Este móvel está batendo em outro móvel ou passando da parede.</p>`;
  return h;
}

// Opções dos itens especiais (muro, grade, portão, piso, luz, tomadas, pets, pessoas)
const optChips = (k, cur, opts) => `<div class="chips">${Object.entries(opts).map(([v, n]) => `<button class="chip ${cur === v ? 'on' : ''}" data-act="opt" data-k="${k}" data-v="${v}">${esc(Array.isArray(n) ? n[0] : n)}</button>`).join('')}</div>`;
function extraProps(it) {
  let h = '';
  switch (it.sym) {
    case 'wallseg': {
      const sloped = it.h2 !== undefined && Math.abs(it.h2 - it.h) >= 1;
      h += `<h3>Topo inclinado</h3><div class="grid2">${numF('Altura no fim', 'h2', it.h2 ?? it.h)}<span></span></div>`;
      h += `<p class="tiny" style="margin:4px 0 0">A Altura (em Medidas) vale para o início (lado esquerdo com giro 0°). Com uma altura diferente no fim, o topo fica inclinado — bom para fechar o espaço embaixo da escada (ex.: banheiro).</p>`;
      if (sloped) h += `<div class="btnrow" style="margin-top:8px">${btn('flatWall', 'Deixar reta', 'sm')}${btn('flipWall', 'Inverter inclinação', 'sm')}</div>`;
      break;
    }
    case 'fence': h += `<h3>Gradeado</h3>${optChips('pattern', it.pattern || 'vertical', FENCE_PATTERNS)}<p class="tiny" style="margin:4px 0 0">Para pôr a grade em cima de uma mureta: Tipo → Na parede / suspenso e a altura do chão = altura da mureta.</p>`; break;
    case 'gate': h += `<h3>Modelo</h3>${optChips('style', it.style || 'panel', GATE_STYLES)}`; break;
    case 'ground': h += `<h3>Acabamento</h3>${optChips('tex', it.tex || 'grass', GROUND_TEX)}<p class="tiny" style="margin:4px 0 0">O piso externo fica por baixo dos cômodos. Puxe os quadradinhos para cobrir a área que quiser.</p>`; break;
    case 'cat': h += `<h3>Pelagem</h3>${optChips('coat', it.coat || 'rajada', CAT_COATS)}`; break;
    case 'socket': case 'switch': h += `<h3>${it.sym === 'socket' ? 'Tomadas' : 'Teclas'}</h3>${optChips('mods', String(it.mods || 1), { 1: '1', 2: '2', 3: '3' })}<p class="tiny" style="margin:4px 0 0">Altura do chão (embaixo): tomada baixa 30 cm, média 110 cm, alta 220 cm; interruptor 110 cm.</p>`; break;
    case 'indlight': h += `<h3>Lâmpadas</h3><div class="grid2">${numF('Quantidade', 'bulbs', it.bulbs || 4, '')}${numF('Altura do chão', 'elev', it.elev || 0)}</div><p class="tiny" style="margin:4px 0 0">Altura do chão = até as lâmpadas. Altura (medidas) = comprimento dos cabos até o trilho.</p>`; break;
    case 'person': {
      const others = store.p.items.filter((o) => o.sym === 'person' && o.id !== it.id);
      h += `<h3>Pessoa</h3>${optChips('gender', it.gender || 'm', { m: 'Homem', f: 'Mulher' })}`;
      h += `<p class="muted" style="margin:6px 0 0">Altura ${fmtLen(it.h, 'm')} (mude em Medidas) · olhos a ~${fmtLen(eyeOf(it), 'm')}</p>`;
      if (others.length) h += `<div class="lst" style="margin-top:8px">${others.map((o) => { const df = Math.round(it.h - o.h); return `<div class="li"><span class="sw" style="--c:${esc(o.color)}"></span><span class="grow"><b>${esc(o.name)}</b><small>${fmtLen(o.h, 'm')} · ${df === 0 ? 'mesma altura' : `${Math.abs(df)} cm mais ${df > 0 ? 'baixo(a)' : 'alto(a)'} que ${esc(it.name)}`}</small></span></div>`; }).join('')}</div>`;
      h += `<div class="btnrow" style="margin-top:10px">${btn('viewAs', 'Ver pelos olhos no 3D', 'sm pri', '', 'target')}</div>`;
      h += `<p class="tiny" style="margin:4px 0 0">Coloque a pessoa perto dos móveis, da bancada ou da escada para comparar as alturas.</p>`;
      break;
    }
  }
  if (LIGHT_SYMS.has(it.sym)) h += `<label class="check" style="margin-top:8px"><span>Acesa no 3D (veja no modo Noite)</span><input type="checkbox" data-f="lightOn" ${it.lightOn !== false ? 'checked' : ''}></label>`;
  return h;
}
export const eyeOf = (it) => Math.max(20, it.h - Math.max(8, it.h * 0.065));

// Mezanino e escadas
function structProps(it) {
  const st = it.status || 'tenho';
  const mz = isMezz(it);
  const lockT = it.locked ? 'Destravar posição' : 'Travar posição';
  let h = `<div class="ph"><span class="dot" style="--c:${esc(it.color)}"></span><input class="inp" data-f="name" value="${esc(it.name)}" aria-label="Nome"></div>`;
  h += `<div class="quick">${ib('rot', 'rotL', 'Girar 90° à esquerda', '', 'data-v="-90"')}${ib('rot', 'rotR', 'Girar 90° à direita', '', 'data-v="90"')}${ib('dup', 'copy', 'Duplicar (Ctrl+D)')}${ib('lock', it.locked ? 'lock' : 'unlock', lockT, it.locked ? 'on' : '')}${ib('del', 'trash', 'Apagar (Delete)', 'dng')}</div>`;
  if (mz) {
    h += `<h3>Medidas do piso</h3><div class="grid2">${numF('Largura', 'w', it.w)}${numF('Profundidade', 'd', it.d)}</div>`;
    h += `<div class="grid2" style="margin-top:8px">${numF('Altura do piso', 'h', it.h)}${numF('Espessura', 'thick', it.thick ?? 12)}</div>`;
    h += `<p class="tiny" style="margin:4px 0 0">Altura do chão até o piso de cima. Embaixo ficam ${fmtLen(Math.max(0, it.h - (it.thick ?? 12) - 20), 'm')} livres (descontando a viga).</p>`;
    h += `<div class="row" style="margin-top:8px;align-items:flex-end">${numF('Giro', 'rot', it.rot, '°')}<button class="btn sm" data-act="swapWD" title="Trocar largura e profundidade">L ⇄ P</button></div>`;
    const rails = it.rails ?? 'nsew';
    h += `<h3>Guarda-corpo</h3><div class="grid2">${numF('Altura', 'railH', it.railH ?? 110)}<span></span></div>`;
    h += ['s', 'n', 'w', 'e'].map((k) => `<label class="check"><span>${SIDE_NAMES[k]}</span><input type="checkbox" data-f="rail.${k}" ${rails.includes(k) ? 'checked' : ''}></label>`).join('');
    h += `<p class="tiny" style="margin:4px 0 0">Frente = lado de baixo na planta com giro 0°. Onde a escada chega o guarda-corpo abre sozinho.</p>`;
    const cols = it.cols || 'auto', off = (it.noCols || []).length;
    h += `<h3>Pilares (pernas)</h3><label class="fld"><span>Pilares</span><select class="inp" data-f="cols"><option value="auto" ${cols === 'auto' ? 'selected' : ''}>Todos</option><option value="corners" ${cols === 'corners' ? 'selected' : ''}>Só nos cantos</option><option value="none" ${cols === 'none' ? 'selected' : ''}>Nenhum (preso nas paredes)</option></select></label>`;
    h += `<p class="tiny" style="margin:4px 0 0">${cols === 'none' ? 'Sem pilares: o mezanino fica apoiado nas paredes.' : `${mezzCols(it).length} pilar(es).`} No 3D, toque num pilar para tirar só ele.</p>`;
    if (off || cols === 'none') h += `<div class="btnrow" style="margin-top:6px">${btn('restoreCols', off ? `Recolocar ${off} pilar(es) removido(s)` : 'Recolocar os pilares', 'sm', '', 'undo')}</div>`;
    h += `<h3>Estrutura (pilares, vigas)</h3>${swatches('color', it.color, STEEL_COLORS)}`;
    h += `<h3>Piso</h3>${swatches('deck', it.deck || '#8b939c', DECK_COLORS)}`;
    h += `<p class="tiny" style="margin:10px 0 0">Para colocar um móvel em cima: selecione o mezanino e escolha o móvel no catálogo, ou no móvel escolha <b>Andar → Em cima do mezanino</b>. Ao arrastar o mezanino, o que está em cima vai junto.</p>`;
  } else {
    const S = stairInfo(it);
    h += `<h3>Medidas</h3><div class="grid3">${numF('Largura', 'w', it.w)}${numF('Comprim.', 'd', it.d)}${numF('Sobe', 'h', it.h)}</div>`;
    h += `<p class="tiny" style="margin:4px 0 0">Comprimento = quanto ela ocupa no chão (vista de cima). Sobe = altura do chão até o topo.</p>`;
    h += `<h3>Ângulos</h3><div class="grid2">${numF('Inclinação', 'slope', S.angle, '°')}${numF('Giro na planta', 'rot', it.rot, '°')}</div>`;
    h += `<div class="chips" style="margin-top:8px">${[30, 35, 40, 45, 60, 75].map((a) => `<button class="chip ${Math.abs(S.angle - a) < 0.5 ? 'on' : ''}" data-act="slope" data-v="${a}">${a}°</button>`).join('')}</div>`;
    h += `<p class="tiny" style="margin:4px 0 0">Mudar a inclinação muda o comprimento. Gire na planta pela bolinha (de 15 em 15°, ou Shift para livre) ou digite qualquer ângulo.</p>`;
    h += `<h3>Degraus</h3><div class="row" style="align-items:flex-end">${numF('Quantidade', 'steps', S.n, '')}<button class="btn sm ${it.steps > 0 ? '' : 'pri'}" data-act="autoSteps" title="Calcular sozinho (espelho de ~18 cm)">Auto</button></div>`;
    h += `<p class="muted" style="margin:6px 0 0">Espelho ${fmtIn(S.riser)} cm · piso ${fmtIn(S.tread)} cm · ${S.comfy ? '<span style="color:var(--ok)">confortável</span>' : `<span style="color:var(--danger)">${S.angle > 45 ? 'muito íngreme' : S.riser > 19.5 ? 'degraus altos' : 'passo fora do ideal'}</span>`} <span class="tiny">(2×espelho + piso = ${fmtIn(S.blondel)} cm; ideal 60–66)</span></p>`;
    h += `<div class="btnrow" style="margin-top:10px">${btn('fitStair', 'Encaixar no mezanino', 'sm', '', 'target')}</div>`;
    h += `<p class="tiny" style="margin:4px 0 0">Leva o topo da escada até a beirada do mezanino mais próximo e iguala a altura, mantendo o giro.</p>`;
    const r = it.rails ?? 'we';
    h += `<h3>Corrimão</h3><div class="grid2"><label class="fld"><span>Lados</span><select class="inp" data-f="rails"><option value="we" ${r === 'we' ? 'selected' : ''}>Os dois</option><option value="w" ${r === 'w' ? 'selected' : ''}>Só esquerda</option><option value="e" ${r === 'e' ? 'selected' : ''}>Só direita</option><option value="" ${r === '' ? 'selected' : ''}>Sem</option></select></label>${numF('Altura', 'railH', it.railH ?? 90)}</div>`;
    h += `<h3>Estrutura</h3>${swatches('color', it.color, STEEL_COLORS)}`;
    h += `<h3>Degraus (cor)</h3>${swatches('deck', it.deck || '#8b939c', DECK_COLORS)}`;
  }
  h += pushHTML();
  h += statusHTML(st, it.price, it.note);
  h += `<div class="btnrow" style="margin-top:14px">${btn('saveLib', 'Salvar em Meus móveis', 'sm', '', 'book')}${btn('zoomSel', 'Centralizar na tela', 'sm', '', 'target')}</div>`;
  return h;
}

function pushHTML() {
  return `<h3>Encostar e centralizar</h3><div class="pushbox"><div class="pad">
    <span></span>${`<button class="btn" data-act="push" data-d="up" title="Encostar em cima">${icon('arrowU', 18)}</button>`}<span></span>
    <button class="btn" data-act="push" data-d="left" title="Encostar à esquerda">${icon('arrowL', 18)}</button><span></span><button class="btn" data-act="push" data-d="right" title="Encostar à direita">${icon('arrowR', 18)}</button>
    <span></span><button class="btn" data-act="push" data-d="down" title="Encostar embaixo">${icon('arrowD', 18)}</button><span></span>
  </div><div class="lst" style="flex:1">${btn('center', 'Centralizar ↔', 'sm', 'data-a="h"', 'centerH')}${btn('center', 'Centralizar ↕', 'sm', 'data-a="v"', 'centerV')}</div></div>
  <p class="tiny" style="margin:6px 0 0">As setas empurram até a parede ou o próximo móvel. Toque nas distâncias azuis na planta para digitar a medida exata.</p>`;
}

function statusHTML(st, price, note, withPrice = true) {
  return `<h3>Na mudança</h3><div class="chips">${Object.entries(STATUS).map(([k, v]) => `<button class="chip ${st === k ? 'on' : ''}" data-act="status" data-v="${k}">${v.n}</button>`).join('')}</div>
  ${withPrice ? `<div class="grid2" style="margin-top:8px">${numF('Preço', 'price', price || 0, 'R$')}<span></span></div>` : ''}
  ${note !== undefined ? `<label class="fld" style="margin-top:8px"><span>Anotações</span><textarea class="inp" data-f="note" placeholder="Loja, link, observações…">${esc(note || '')}</textarea></label>` : ''}`;
}

function swatches(f, cur, list) {
  return `<div class="swatches">${list.map((c) => `<button class="swatch ${String(cur).toLowerCase() === c ? 'on' : ''}" style="--c:${c}" data-act="color" data-f2="${f}" data-v="${c}" aria-label="Cor ${c}"></button>`).join('')}<input type="color" class="swatch-in" data-f="${f}" value="${esc(cur)}" title="Outra cor"></div>`;
}

function multiProps(its) {
  const allLocked = its.every((i) => i.locked);
  let h = `<div class="ph"><b style="font-size:15px">${its.length} itens selecionados</b><div class="grow"></div>${ib('clearSel', 'x', 'Limpar seleção', 'sm')}</div>`;
  h += `<div class="quick">${ib('rot', 'rotL', 'Girar o grupo 90° à esquerda', '', 'data-v="-90"')}${ib('rot', 'rotR', 'Girar o grupo 90° à direita', '', 'data-v="90"')}${ib('dup', 'copy', 'Duplicar')}${ib('lock', allLocked ? 'lock' : 'unlock', allLocked ? 'Destravar' : 'Travar', allLocked ? 'on' : '')}${ib('del', 'trash', 'Apagar', 'dng')}</div>`;
  h += `<h3>Alinhar</h3><div class="btngrid">
    ${[['left', 'alignL', 'Alinhar à esquerda'], ['ch', 'alignCH', 'Centralizar na horizontal'], ['right', 'alignR', 'Alinhar à direita'], ['top', 'alignT', 'Alinhar em cima'], ['cv', 'alignCV', 'Centralizar na vertical'], ['bottom', 'alignB', 'Alinhar embaixo']].map(([a, i, t]) => `<button class="btn" data-act="align" data-a="${a}" title="${t}">${icon(i, 18)}</button>`).join('')}</div>`;
  h += `<h3>Distribuir</h3><div class="grid2">${btn('dist', 'Espaços iguais ↔', 'sm', 'data-a="h"', 'distH')}${btn('dist', 'Espaços iguais ↕', 'sm', 'data-a="v"', 'distV')}</div>`;
  h += `<div class="row" style="margin-top:8px;align-items:flex-end">${numF('Espaço fixo entre eles', 'gap', 10)}<button class="btn sm" data-act="distGap" data-a="h">↔</button><button class="btn sm" data-act="distGap" data-a="v">↕</button></div>`;
  h += `<p class="tiny" style="margin:6px 0 0">Espaços iguais precisa de 3 ou mais itens.</p>`;
  h += pushHTML();
  h += `<h3>Cor de todos</h3>${swatches('color', its[0].color, COLORS)}`;
  h += statusHTML(its.every((i) => i.status === its[0].status) ? its[0].status : '', 0, undefined, false);
  return h;
}

function roomProps(r) {
  if (!r) return '';
  const area = Math.abs(signedArea(r.points));
  const b = bbox(r.points);
  const E = edgesOf(r.points);
  const unit = store.p.settings.unit;
  let h = `<div class="ph"><span class="dot" style="--c:${esc(r.floor)}"></span><input class="inp" data-f="rname" value="${esc(r.name)}" aria-label="Nome do cômodo"></div>`;
  h += `<div class="quick">${ib('dup', 'copy', 'Duplicar cômodo')}${ib('rlock', r.locked ? 'lock' : 'unlock', r.locked ? 'Destravar cômodo' : 'Travar cômodo (não move sem querer)', r.locked ? 'on' : '')}${ib('zoomSel', 'target', 'Centralizar na tela')}${ib('delRoom', 'trash', 'Apagar cômodo', 'dng')}</div>`;
  h += `<p class="muted" style="margin:6px 0 0">${fmtArea(area)} · ${fmtLen(b.x2 - b.x1, unit)} × ${fmtLen(b.y2 - b.y1, unit)}</p>`;
  if (isRectRoom(r)) h += `<h3>Medidas internas</h3><div class="grid2">${numF('Largura', 'rw', b.x2 - b.x1)}${numF('Profundidade', 'rh', b.y2 - b.y1)}</div><p class="tiny" style="margin:4px 0 0">Pode digitar em metros (3,5) ou centímetros (350).</p>`;
  h += `<div class="grid2" style="margin-top:8px">${numF('Pé-direito', 'rheight', r.height)}${numF('Parede', 'rwallT', r.wallT)}</div>`;
  h += `<label class="check" style="margin-top:8px"><span>Sem paredes (área externa, quintal)</span><input type="checkbox" data-f="rnowalls" ${r.noWalls ? 'checked' : ''}></label>`;
  h += `<h3>Piso</h3>${swatches('rfloor', r.floor, FLOOR_COLORS)}`;
  h += `<h3>${r.noWalls ? 'Lados' : 'Paredes'}</h3>`;
  if (r.noWalls) h += `<p class="tiny" style="margin:0 0 4px">Área sem paredes: use muros, grades e portões do catálogo (Área externa) para fechar onde quiser.</p>`;
  const sideName = (e) => (Math.abs(e.dir[1]) < 0.01 ? (e.nIn[1] > 0 ? 'de cima' : 'de baixo') : Math.abs(e.dir[0]) < 0.01 ? (e.nIn[0] > 0 ? 'da esquerda' : 'da direita') : 'inclinada');
  for (const e of E) {
    const ops = r.openings.filter((o) => o.edge === e.i && !o.full);
    const gone = r.openings.some((o) => o.full && o.edge === e.i);
    h += `<div class="wall-row${gone ? ' gone' : ''}"><b>Parede ${e.i + 1} <span class="tiny">${sideName(e)}${gone ? ' · removida' : ''}</span></b><div class="unit"><input class="inp" data-f="wall" data-i="${e.i}" inputmode="decimal" value="${fmtIn(e.len)}"><em>cm</em></div>
      <div class="acts"${r.noWalls ? ' hidden' : ''}>${gone ? '' : `${btn('addOp', 'Porta', 'sm', `data-i="${e.i}" data-t="door"`, 'plus')}${btn('addOp', 'Janela', 'sm', `data-i="${e.i}" data-t="window"`, 'plus')}${btn('addOp', 'Vão', 'sm', `data-i="${e.i}" data-t="pass"`, 'plus')}${btn('addOp', 'Corte', 'sm', `data-i="${e.i}" data-t="cut" title="Cortar um trecho da parede (sem parede, ou com mureta)"`, 'minus')}`}${btn('toggleWall', gone ? 'Devolver parede' : 'Tirar parede', 'sm', `data-i="${e.i}" title="${gone ? 'Colocar a parede de volta' : 'Remover a parede inteira'}"`, gone ? 'undo' : 'x')}${btn('split', '', 'sm icon', `data-i="${e.i}" title="Dividir parede (criar um canto)"`, 'split')}
      ${ops.map((o) => `<button class="chip" data-act="pickOp" data-id="${o.id}">${esc(OPENING_TYPES[o.type]?.n || o.type)} ${Math.round(o.width)}</button>`).join('')}</div></div>`;
  }
  if (r.points.length > 4 || !isRectRoom(r)) {
    h += `<h3>Cantos</h3><div class="chips">${r.points.map((_, i) => `<button class="chip" data-act="rmCorner" data-i="${i}" title="Remover este canto">${icon('x', 12)} Canto ${i + 1}</button>`).join('')}</div>`;
  }
  const n = store.p.items.filter((i) => pointInPoly(i.x, i.y, r.points)).length;
  h += `<p class="tiny" style="margin-top:14px">${n} móvei${n === 1 ? 'l' : 's'} dentro. Com o cômodo selecionado, arraste o piso para mover tudo junto; puxe as bolinhas das paredes para mudar o tamanho.</p>`;
  return h;
}

function openingProps(r, o) {
  if (!r || !o) return '';
  const e = edgesOf(r.points)[o.edge];
  const isDoor = o.type === 'door' || o.type === 'door2';
  let h = `<div class="ph"><b style="font-size:15px">${esc(o.full ? 'Parede removida' : OPENING_TYPES[o.type]?.n)} · ${esc(r.name)}</b><div class="grow"></div>${ib('pickRoomOf', 'arrowL', 'Voltar ao cômodo', 'sm', `data-id="${r.id}"`)}</div>`;
  h += `<div class="quick">${ib('del', 'trash', o.type === 'cut' ? 'Apagar o corte (a parede volta)' : 'Apagar', 'dng')}</div>`;
  if (o.type === 'cut') {
    if (o.full) h += `<p class="muted" style="margin:6px 0 0">A parede ${o.edge + 1} inteira foi removida. Apague para a parede voltar.</p>`;
    else {
      h += `<h3>Corte na parede ${o.edge + 1}</h3><div class="grid2">${numF('Largura', 'owidth', o.width)}${numF('Mureta', 'osill', o.sill || 0)}</div>`;
      h += `<p class="tiny" style="margin:4px 0 0">Mureta = altura de parede que fica embaixo do corte (0 = sem parede nenhuma; 110 = meia-parede/balcão).</p>`;
      h += `<h3>Posição</h3><div class="grid2">${numF('Do início', 'ooff', o.off)}${numF('Do fim', 'oend', e.len - o.off - o.width)}</div><p class="tiny" style="margin:4px 0 0">Ou arraste o corte na planta.</p>`;
    }
    h += `<div class="btnrow" style="margin-top:10px">${btn('toggleWall', o.full ? 'Devolver a parede' : 'Tirar a parede inteira', 'sm', `data-i="${o.edge}" data-room="${r.id}"`, o.full ? 'undo' : 'x')}</div>`;
    return h;
  }
  h += `<h3>Tipo</h3><div class="chips">${Object.entries(OPENING_TYPES).filter(([k]) => k !== 'cut').map(([k, v]) => `<button class="chip ${o.type === k ? 'on' : ''}" data-act="otype" data-v="${k}">${v.n}</button>`).join('')}</div>`;
  h += `<h3>Medidas</h3><div class="grid2">${numF('Largura', 'owidth', o.width)}${numF('Altura', 'oheight', o.height)}</div>`;
  if (o.type === 'window') h += `<div class="grid2" style="margin-top:8px">${numF('Peitoril (do chão)', 'osill', o.sill)}<span></span></div>`;
  h += `<h3>Posição na parede ${o.edge + 1}</h3><div class="grid2">${numF('Do início', 'ooff', o.off)}${numF('Do fim', 'oend', e.len - o.off - o.width)}</div><p class="tiny" style="margin:4px 0 0">Ou arraste a porta/janela na planta (dá para passar para outra parede).</p>`;
  if (isDoor) {
    h += `<h3>Abertura</h3><div class="grid2"><label class="fld"><span>Abre para</span><select class="inp" data-f="oswing"><option value="in" ${o.swing !== 'out' ? 'selected' : ''}>Dentro</option><option value="out" ${o.swing === 'out' ? 'selected' : ''}>Fora</option></select></label>`;
    if (o.type === 'door') h += `<label class="fld"><span>Dobradiça</span><select class="inp" data-f="ohinge"><option value="start" ${o.hinge !== 'end' ? 'selected' : ''}>Lado 1</option><option value="end" ${o.hinge === 'end' ? 'selected' : ''}>Lado 2</option></select></label>`;
    h += '</div>';
  }
  return h;
}

function measureProps(m) {
  if (!m) return '';
  const len = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
  return `<div class="ph"><b style="font-size:15px">Medida: ${fmtLen(len, 'cm')}</b></div><div class="quick">${ib('del', 'trash', 'Apagar medida', 'dng')}</div>
  <p class="muted">Use a régua (barra de ferramentas) e arraste na planta para medir. A medida gruda nos cantos das paredes e dos móveis. Segure Shift para medir em diagonal livre.</p>
  <div class="btnrow">${btn('clearMeasures', 'Apagar todas as medidas', 'sm dng', '', 'trash')}</div>`;
}

function projectProps() {
  const p = store.p, S = p.settings;
  const a = analyze(p);
  const total = p.rooms.reduce((s, r) => s + Math.abs(signedArea(r.points)), 0);
  const buy = p.items.filter((i) => i.status === 'comprar');
  let h = `<div class="ph"><b style="font-size:15px">Projeto</b></div>`;
  h += `<p class="muted" style="margin:6px 0 0">${p.rooms.length} cômodos · ${fmtArea(total)} · ${p.items.length} itens${buy.length ? ` · comprar: ${fmtMoney(buy.reduce((s, i) => s + (+i.price || 0), 0))}` : ''}</p>`;
  if (a.pairs.length || a.crossing.length) {
    h += `<h3>Atenção</h3><div class="lst">`;
    for (const [x, y] of a.pairs.slice(0, 12)) h += `<button class="li" data-act="pickPair" data-a="${x.id}" data-b="${y.id}"><span style="color:var(--danger)">${icon('warn', 16)}</span><span class="grow"><b>${esc(x.name)} × ${esc(y.name)}</b><small>estão se sobrepondo</small></span></button>`;
    for (const x of a.crossing.slice(0, 12)) h += `<button class="li" data-act="pickPair" data-a="${x.id}"><span style="color:var(--danger)">${icon('warn', 16)}</span><span class="grow"><b>${esc(x.name)}</b><small>passa da parede</small></span></button>`;
    h += '</div>';
  }
  const ck = (k, label) => `<label class="check"><span>${label}</span><input type="checkbox" data-f="s.${k}" ${S[k] ? 'checked' : ''}></label>`;
  h += `<h3>Encaixe</h3>${ck('snap', 'Ímã (paredes, cantos e móveis)')}${ck('snapGrid', 'Encaixar na grade')}`;
  h += `<div class="grid2" style="margin-top:6px">${numF('Tamanho da grade', 's.gridSize', S.gridSize)}${numF('Parede padrão', 's.wallT', S.wallT)}</div>`;
  h += `<h3>Mostrar</h3>${ck('showGrid', 'Grade')}${ck('showDims', 'Medidas das paredes')}${ck('showDist', 'Distâncias do item selecionado')}${ck('showLabels', 'Nomes dos móveis')}${ck('showItemDims', 'Medidas nos móveis')}`;
  h += `<label class="fld" style="margin-top:8px"><span>Medidas das paredes em</span><select class="inp" data-f="s.unit"><option value="m" ${S.unit === 'm' ? 'selected' : ''}>metros (3,50 m)</option><option value="cm" ${S.unit === 'cm' ? 'selected' : ''}>centímetros (350 cm)</option></select></label>`;
  h += `<h3>Dicas</h3><ul class="muted" style="padding-left:18px;margin:0;display:grid;gap:5px">
    <li>Toque num móvel para selecionar e arraste para mover. Ele gruda nas paredes, nos cantos e nos outros móveis.</li>
    <li>Use a bolinha de cima para girar (de 15 em 15°) e os quadradinhos para mudar o tamanho.</li>
    <li>Para mover vários: segure o dedo num móvel (ou Shift + clique) e depois toque nos outros.</li>
    <li>Dois dedos aproximam/afastam e arrastam a planta.</li>
    <li>Itens fora dos cômodos funcionam como “área de espera”.</li></ul>`;
  return h;
}

export function bindProps() {
  const body = $('#propsBody');
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const d = b.dataset;
    const s = store.sel;
    const ids = s?.kind === 'items' ? s.ids : [];
    switch (d.act) {
      case 'rot': A.rotateSel(+d.v); break;
      case 'dup': A.duplicateSelection(); break;
      case 'del': A.deleteSelection(); break;
      case 'front': A.toFront(); break;
      case 'lock': { const its = store.selItems(); const v = !its.every((i) => i.locked); A.setProp(ids, 'locked', v); app.toast(v ? 'Posição travada' : 'Posição destravada'); break; }
      case 'swapWD': store.change(() => store.selItems().forEach((i) => { [i.w, i.d] = [i.d, i.w]; })); break;
      case 'push': A.push(d.d); break;
      case 'center': A.centerBetween(d.a); break;
      case 'align': A.align(d.a); break;
      case 'dist': A.distribute(d.a); break;
      case 'distGap': { const g = parseNum(body.querySelector('[data-f="gap"]').value); A.distribute(d.a, Number.isFinite(g) ? g : 0); break; }
      case 'status': store.change(() => store.selItems().forEach((i) => { i.status = d.v; })); break;
      case 'color': {
        if (d.f2 === 'rfloor') store.change(() => { store.room(s.id).floor = d.v; });
        else store.change(() => store.selItems().forEach((i) => { i[d.f2 === 'deck' ? 'deck' : 'color'] = d.v; }));
        break;
      }
      case 'clearSel': store.select(null); break;
      case 'saveLib': {
        const it = store.selItems()[0];
        const def = { k: 'lib' + Date.now().toString(36), n: it.name, w: it.w, d: it.d, h: it.h, sym: it.sym, shape: it.shape, color: it.color, layer: it.layer, elev: it.elev };
        for (const k of STRUCT_KEYS) if (it[k] !== undefined) def[k] = it[k];
        store.change((p) => p.library.push(def));
        app.toast('Salvo em “Meus móveis”');
        break;
      }
      case 'zoomSel': A.zoomToSel(); break;
      case 'slope': store.change(() => store.selItems().filter(isStair).forEach((i) => setStairRun(i, i.h / Math.tan((+d.v * Math.PI) / 180)))); break;
      case 'autoSteps': store.change(() => store.selItems().forEach((i) => { i.steps = 0; })); break;
      case 'fitStair': { const m = A.fitStair(ids[0]); app.toast(m ? `Escada encaixada em “${m.name}” (sobe ${fmtLen(m.h, 'm')})` : store.p.items.some(isMezz) ? 'Gire a escada para que ela suba em direção ao mezanino' : 'Adicione um mezanino primeiro'); break; }
      case 'rlock': store.change(() => { const r = store.room(s.id); r.locked = !r.locked; }); break;
      case 'delRoom': {
        const r = store.room(s.id);
        const n = store.p.items.filter((i) => pointInPoly(i.x, i.y, r.points)).length;
        if (!n) { if (await app.confirm(`Apagar “${r.name}”?`)) A.deleteRoom(r.id, false); break; }
        const ans = await app.confirm(`Apagar “${r.name}”? Ele tem ${n} móvel(is) dentro.`, ['Apagar com os móveis', 'Apagar e manter os móveis']);
        if (ans === 0) A.deleteRoom(r.id, true); else if (ans === 1) A.deleteRoom(r.id, false);
        break;
      }
      case 'addOp': A.addOpening(s.id, +d.i, d.t); break;
      case 'pickOp': store.select({ kind: 'opening', room: s.id, id: d.id }); break;
      case 'pickRoomOf': store.select({ kind: 'room', id: d.id }); break;
      case 'split': A.splitWall(s.id, +d.i); break;
      case 'toggleWall': {
        const rid = d.room || s.id;
        const off = A.toggleWall(rid, +d.i);
        if (s?.kind === 'opening') store.select({ kind: 'room', id: rid });
        app.toast(off ? `Parede ${+d.i + 1} removida` : `Parede ${+d.i + 1} de volta`);
        break;
      }
      case 'opt': {
        const k = d.k, v = d.v;
        store.change(() => store.selItems().forEach((i) => {
          if (k === 'mods') { i.mods = +v; return; }
          i[k] = v;
          if (k === 'tex' && GROUND_TEX[v]) { i.color = GROUND_TEX[v][1]; if (Object.values(GROUND_TEX).some(([n]) => n === i.name) || /^(Grama|Piso|Deck|Pedrisco|Terra)/.test(i.name)) i.name = GROUND_TEX[v][0]; }
          if (k === 'coat' && CAT_COATS[v]) i.color = CAT_COATS[v][1];
          if (k === 'gender') {
            if (i.name === 'Homem' || i.name === 'Mulher') i.name = v === 'f' ? 'Mulher' : 'Homem';
            if (i.h === 175 && v === 'f') i.h = 163; else if (i.h === 163 && v === 'm') i.h = 175;
          }
        }));
        break;
      }
      case 'flatWall': store.change(() => store.selItems().forEach((i) => { delete i.h2; })); break;
      case 'flipWall': store.change(() => store.selItems().forEach((i) => { if (i.h2 !== undefined) [i.h, i.h2] = [i.h2, i.h]; })); break;
      case 'restoreCols': A.restoreCols(ids[0]); break;
      case 'viewAs': app.viewAsPerson?.(ids[0]); break;
      case 'rmCorner': A.removeCorner(s.id, +d.i); break;
      case 'otype': store.change(() => { const r = store.room(s.room); const o = r.openings.find((x) => x.id === s.id); const t = OPENING_TYPES[d.v]; o.type = d.v; o.height = t.h; o.sill = t.sill; app.plan.clampOpenings(r); }); break;
      case 'clearMeasures': store.change((p) => { p.measures = []; }); store.select(null); break;
      case 'pickPair': store.select({ kind: 'items', ids: [d.a, d.b].filter(Boolean) }); A.zoomToSel(); break;
    }
  });

  body.addEventListener('change', (e) => {
    const el = e.target; const f = el.dataset.f; if (!f) return;
    const s = store.sel;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (f.startsWith('s.')) {
      const key = f.slice(2);
      let val = v;
      if (key === 'gridSize' || key === 'wallT') { val = parseNum(v); if (!(val > 0)) return renderProps(); }
      store.change((p) => { p.settings[key] = val; });
      return;
    }
    if (s?.kind === 'items') {
      const its = store.selItems();
      const numeric = ['w', 'd', 'h', 'rot', 'price', 'elev', 'thick', 'railH', 'steps', 'slope', 'lvl', 'h2', 'bulbs'];
      if (f.startsWith('rail.')) {
        const k = f.slice(5);
        store.change(() => its.forEach((i) => { const r = (i.rails ?? 'nsew').replace(k, ''); i.rails = v ? r + k : r; }));
        return;
      }
      let val = v;
      if (numeric.includes(f)) {
        val = parseNum(v);
        if (!Number.isFinite(val) || (['w', 'd', 'h'].includes(f) && val <= 0)) return renderProps();
        if (f === 'rot') val = normAng(val);
        if (['thick', 'railH', 'steps', 'h2'].includes(f) && val < 0) return renderProps();
        if (f === 'bulbs') val = Math.max(1, Math.min(24, Math.round(val)));
      }
      if (f === 'slope') {
        if (!(val >= 5 && val <= 85)) { app.toast('Use uma inclinação entre 5° e 85°'); return renderProps(); }
        store.change(() => its.filter(isStair).forEach((i) => setStairRun(i, i.h / Math.tan((val * Math.PI) / 180))));
        return;
      }
      if (f === 'd' && its.every(isStair)) { store.change(() => its.forEach((i) => setStairRun(i, val))); return; }
      if (f === 'lvl') {
        const miss = A.setLevel(val);
        if (miss) app.toast('Arraste o móvel para cima do mezanino primeiro');
        return;
      }
      if (f === 'gap') return;
      store.change(() => its.forEach((i) => { i[f] = val; if (f === 'layer' && val === 'wall' && !i.elev) i.elev = 120; }));
      return;
    }
    if (s?.kind === 'room') {
      const r = store.room(s.id);
      if (f === 'rname') store.change(() => { r.name = v.trim() || 'Cômodo'; });
      else if (f === 'rnowalls') store.change(() => { r.noWalls = !!v; });
      else if (f === 'rfloor') store.change(() => { r.floor = v; });
      else if (f === 'rheight' || f === 'rwallT') { const n = parseLen(v, f === 'rheight'); if (n > 0) store.change(() => { r[f === 'rheight' ? 'height' : 'wallT'] = n; }); else renderProps(); }
      else if (f === 'rw' || f === 'rh') {
        const b = bbox(r.points); const n = parseLen(v, true);
        if (n >= 20) A.setRoomSize(r.id, f === 'rw' ? n : b.x2 - b.x1, f === 'rh' ? n : b.y2 - b.y1); else renderProps();
      } else if (f === 'wall') { const n = parseLen(v, true); if (n >= 20) A.setWallLength(r.id, +el.dataset.i, n); else renderProps(); }
      return;
    }
    if (s?.kind === 'opening') {
      const r = store.room(s.room); const o = r.openings.find((x) => x.id === s.id);
      const e = edgesOf(r.points)[o.edge];
      if (f === 'oswing' || f === 'ohinge') { store.change(() => { o[f === 'oswing' ? 'swing' : 'hinge'] = v; }); return; }
      const n = parseLen(v, false);
      if (!Number.isFinite(n) || n < 0) return renderProps();
      store.change(() => {
        if (f === 'owidth') { o.width = Math.max(20, Math.min(n, e.len)); }
        if (f === 'oheight') o.height = n;
        if (f === 'osill') o.sill = n;
        if (f === 'ooff') o.off = n;
        if (f === 'oend') o.off = e.len - o.width - n;
        app.plan.clampOpenings(r);
      });
    }
  });
}
