// Inicialização: liga a planta, os painéis, o salvamento automático, o 3D e os atalhos.
import { app, $, $$ } from './ctx.js';
import { store, sampleProject, migrate, newProject } from './state.js';
import { local, cloud, syncAll } from './storage.js';
import { Plan, thumbSVG } from './plan.js';
import { icon } from './icons.js';
import { esc, uid, fmtLen, fmtMoney, itemBox } from './geometry.js';
import { STATUS } from './catalog.js';
import * as A from './actions.js';
import { renderLeft, renderProps, bindLeft, bindProps } from './panels.js';
import { dlgProjects, dlgHelp, dlgCloud, closeDialog } from './dialogs.js';
import { roomAt } from './state.js';

const LAST = 'planta.ultimo';
const THEME = 'planta.tema';

// ---------- ícones fixos ----------
$('#bProjects').innerHTML = icon('menu');
$('#bUndo').innerHTML = icon('undo');
$('#bRedo').innerHTML = icon('redo');
$('#bMore').innerHTML = icon('more');
$$('.sheet-x').forEach((b) => { b.innerHTML = icon('x'); });
const toolIcons = { select: 'pointer', measure: 'ruler', multi: 'multi', snap: 'magnet', snapGrid: 'grid' };
$$('#tools [data-tool], #tools [data-toggle]').forEach((b) => { b.innerHTML = icon(toolIcons[b.dataset.tool || b.dataset.toggle]); });
$$('#zoomBox [data-zoom]').forEach((b) => { b.innerHTML = icon({ in: 'zoomIn', out: 'zoomOut', fit: 'fit' }[b.dataset.zoom]); });
$$('#bottomNav [data-icon]').forEach((s) => { s.innerHTML = icon(s.dataset.icon, 22); });

// ---------- menus minimizáveis ----------
const UI = 'planta.ui';
const MINS = ['left', 'right', 'tools', 'zoom', 'v3'];
const ui = Object.fromEntries(MINS.map((k) => [k, false]));
try { Object.assign(ui, JSON.parse(localStorage.getItem(UI) || '{}')); } catch { /* ignora */ }
const MIN_ICON = { left: ['chevL', 'chevR'], right: ['chevR', 'chevL'], tools: ['chevL', 'chevR'], zoom: ['chevR', 'chevL'], v3: ['chevL', 'chevR'] };
function applyUI() {
  const app_ = $('#app');
  for (const k of MINS) app_.classList.toggle('min-' + k, !!ui[k]);
  const all = MINS.every((k) => ui[k]);
  app_.classList.toggle('focus', all);
  $$('[data-min]').forEach((b) => {
    const k = b.dataset.min;
    b.innerHTML = icon(b.classList.contains('edge-btn') ? MIN_ICON[k][1] : MIN_ICON[k][ui[k] ? 1 : 0], b.classList.contains('edge-btn') ? 16 : 18);
    if (!b.classList.contains('edge-btn')) b.title = ui[k] ? 'Mostrar' : 'Minimizar';
  });
  $('#bFocus').innerHTML = icon(all ? 'unfocus' : 'focus');
  $('#bFocus').classList.toggle('on', all);
  try { localStorage.setItem(UI, JSON.stringify(ui)); } catch { /* ignora */ }
}
function toggleMin(k) { ui[k] = !ui[k]; applyUI(); }
function toggleFocus() {
  const hide = !MINS.every((k) => ui[k]);
  for (const k of MINS) ui[k] = hide;
  if (hide && app.isMobile()) app.closeSheets?.();
  applyUI();
  app.toast(hide ? 'Menus escondidos — aperte H ou o botão no topo para mostrar' : 'Menus de volta');
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-min]'); if (b) { e.stopPropagation(); toggleMin(b.dataset.min); } }, true);
$('#bFocus').onclick = toggleFocus;
applyUI();

// ---------- tema ----------
function applyTheme() {
  let t = 'auto'; try { t = localStorage.getItem(THEME) || 'auto'; } catch { /* ignora */ }
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (app.plan) { app.plan.dark = dark; app.plan.draw(); }
  return dark;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- planta ----------
const plan = new Plan($('#plan'), {
  onRender: (an) => { updateScale(); updateWarn(an); },
  onView: () => updateScale(),
  onOpenProps: () => app.openSheet('props'),
  onMulti: (on) => setMulti(on),
  onEditDist: async (dir, gap) => {
    const v = await app.prompt('Distância', `Distância ${{ left: 'à esquerda', right: 'à direita', up: 'acima', down: 'abaixo' }[dir]} (até a parede ou o próximo móvel)`, String(Math.round(gap * 10) / 10).replace('.', ','));
    if (v !== null) A.setGap(dir, gap, parseFloat(String(v).replace(',', '.')));
  },
  onEditWall: async (roomId, i) => {
    const r = store.room(roomId); if (!r) return;
    const e = r.points[i], f = r.points[(i + 1) % r.points.length];
    const len = Math.hypot(f[0] - e[0], f[1] - e[1]);
    const v = await app.prompt(`Parede ${i + 1} — ${r.name}`, 'Comprimento (pode ser em metros: 3,5)', String(Math.round(len * 10) / 10).replace('.', ','));
    if (v === null) return;
    let n = parseFloat(String(v).replace(',', '.'));
    if (n <= 30) n *= 100;
    if (n >= 20) A.setWallLength(roomId, i, n);
  },
});
app.plan = plan;
A.setPlan(plan);
applyTheme();

function updateScale() {
  const k = plan.k;
  const steps = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const L = steps.find((s) => s * k >= 60) || 5000;
  $('#scaleBar i').style.width = Math.round(L * k) + 'px';
  $('#scaleBar span').textContent = L >= 100 ? `${L / 100} m` : `${L} cm`;
}

function updateWarn(an) {
  const chip = $('#warnChip');
  const n = an.pairs.length + an.crossing.length;
  chip.hidden = !n || app.view !== '2d';
  if (n) chip.innerHTML = `${icon('warn', 15)} ${n} conflito${n > 1 ? 's' : ''}`;
}
$('#warnChip').onclick = () => {
  const an = plan.analysis;
  const ids = [...an.bad];
  if (ids.length) { store.select({ kind: 'items', ids }); A.zoomToSel(); }
  app.toast('Os itens em vermelho estão batendo em outro móvel ou passando da parede');
};

// ---------- ferramentas ----------
function setTool(t) {
  plan.tool = t;
  $$('#tools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  if (t === 'measure') app.toast('Régua: arraste na planta para medir');
}
function setMulti(on) {
  plan.multi = on;
  $('#tools [data-toggle="multi"]').classList.toggle('on', on);
}
function syncToggles() {
  const S = store.p?.settings || {};
  $('#tools [data-toggle="snap"]').classList.toggle('on', !!S.snap);
  $('#tools [data-toggle="snapGrid"]').classList.toggle('on', !!S.snapGrid);
}
$('#tools').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tool) setTool(b.dataset.tool);
  const t = b.dataset.toggle;
  if (t === 'multi') { setMulti(!plan.multi); app.toast(plan.multi ? 'Seleção de vários ligada: toque nos itens ou arraste no vazio' : 'Seleção de vários desligada'); }
  if (t === 'snap' || t === 'snapGrid') {
    store.change((p) => { p.settings[t] = !p.settings[t]; });
    const on = store.p.settings[t];
    app.toast(t === 'snap' ? (on ? 'Ímã ligado: gruda em paredes, cantos e móveis' : 'Ímã desligado') : (on ? `Encaixe na grade de ${store.p.settings.gridSize} cm` : 'Encaixe na grade desligado'));
  }
});
$('#zoomBox').addEventListener('click', (e) => {
  const z = e.target.closest('button')?.dataset.zoom;
  if (z === 'in') plan.zoomBy(1.3); if (z === 'out') plan.zoomBy(1 / 1.3); if (z === 'fit') plan.fit();
});

// ---------- painéis / folhas ----------
const left = $('#left'), props = $('#props');
let propsMode = 'closed'; // closed | peek | open (só no celular)
function setPropsMode(m) {
  propsMode = m;
  props.classList.toggle('open', m === 'open');
  props.classList.toggle('peek', m === 'peek');
  updateNav();
}
app.openSheet = (name, peek = false) => {
  if (!app.isMobile()) { if (name !== 'props') { app.tab = name; renderLeft(); } return; }
  if (name === 'props') { left.classList.remove('open'); setPropsMode(peek ? 'peek' : 'open'); return; }
  app.tab = name; renderLeft();
  left.classList.add('open');
  if (propsMode === 'open') setPropsMode(store.sel ? 'peek' : 'closed');
  updateNav();
};
app.closeSheets = () => { left.classList.remove('open'); setPropsMode(store.sel && app.isMobile() ? 'peek' : 'closed'); };
function updateNav() {
  const leftOpen = left.classList.contains('open');
  $$('#bottomNav [data-sheet]').forEach((b) => b.classList.toggle('on', b.dataset.sheet === 'props' ? propsMode === 'open' : leftOpen && app.tab === b.dataset.sheet));
}
$('#bottomNav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sheet]'); if (!b) return;
  const s = b.dataset.sheet;
  if (s === 'props') { if (propsMode === 'open') setPropsMode(store.sel ? 'peek' : 'closed'); else app.openSheet('props'); return; }
  if (left.classList.contains('open') && app.tab === s) { left.classList.remove('open'); updateNav(); return; }
  app.openSheet(s);
});
$$('#left .tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { app.tab = b.dataset.tab; renderLeft(); updateNav(); }));
$$('[data-close-sheet]').forEach((b) => b.addEventListener('click', () => { left.classList.remove('open'); updateNav(); }));
// arrastar a alça das folhas
function gripDrag(el, onUp) {
  let y0 = null;
  el.addEventListener('pointerdown', (e) => { y0 = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup', (e) => { if (y0 === null) return; const dy = e.clientY - y0; y0 = null; onUp(dy); });
}
gripDrag($('#propsGrip'), (dy) => {
  if (dy > 30) setPropsMode(propsMode === 'open' && store.sel ? 'peek' : 'closed');
  else if (dy < -30) setPropsMode('open');
  else setPropsMode(propsMode === 'open' ? (store.sel ? 'peek' : 'closed') : 'open');
});
gripDrag($('#left .sheet-grip'), (dy) => { if (dy > 20 || Math.abs(dy) < 6) { left.classList.remove('open'); updateNav(); } });
$('#plan').addEventListener('pointerdown', () => {
  if (!app.isMobile()) return;
  if (left.classList.contains('open')) { left.classList.remove('open'); updateNav(); }
  if (propsMode === 'open') setPropsMode(store.sel ? 'peek' : 'closed');
}, true);

app.renderLeft = renderLeft;
app.renderProps = renderProps;
bindLeft();
bindProps();

// ---------- toast / download ----------
let toastT = 0;
app.toast = (msg) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
};
app.download = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

// ---------- salvar ----------
let saveT = 0, cloudT = 0, cloudState = 'idle';
app.saveNow = (p) => { local.put(p, { thumb: thumbSVG(p) }); };
function scheduleSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    if (!store.p) return;
    const ok = local.put(store.p, { thumb: thumbSVG(store.p) });
    if (!ok) { cloudState = 'full'; }
    app.updateSaveState();
  }, 400);
  if (cloud.user) {
    clearTimeout(cloudT);
    cloudState = 'pending'; app.updateSaveState();
    cloudT = setTimeout(pushCloud, 2000);
  }
}
async function pushCloud() {
  const p = store.p; if (!p || !cloud.user) return;
  cloudState = 'saving'; app.updateSaveState();
  try {
    await cloud.salvar(p, thumbSVG(p));
    local.markSynced(p.id, p.updatedAt);
    cloudState = 'ok';
  } catch (e) {
    cloudState = e.status === 401 ? 'logout' : 'offline';
  }
  app.updateSaveState();
}
app.updateSaveState = () => {
  const el = $('#saveState');
  el.className = 'save-state';
  if (cloudState === 'full') { el.textContent = 'Sem espaço no aparelho!'; el.classList.add('err'); return; }
  if (!cloud.user) { el.textContent = cloudState === 'logout' ? 'Sessão expirou — entre de novo' : 'Salvo neste aparelho'; if (cloudState === 'logout') el.classList.add('err'); return; }
  const m = { pending: 'Alterações…', saving: 'Salvando na nuvem…', ok: 'Salvo na nuvem', offline: 'Sem conexão — salvo no aparelho', idle: 'Salvo na nuvem' };
  el.textContent = m[cloudState] || '';
  if (cloudState === 'ok' || cloudState === 'idle') el.classList.add('cloud');
  if (cloudState === 'offline') el.classList.add('err');
};
window.addEventListener('beforeunload', () => { if (store.p) local.put(store.p, { thumb: thumbSVG(store.p) }); });
document.addEventListener('visibilitychange', () => { if (document.hidden && store.p) { local.put(store.p, { thumb: thumbSVG(store.p) }); if (cloud.user && cloudState === 'pending') { clearTimeout(cloudT); pushCloud(); } } });

app.syncNow = async (verbose = false) => {
  if (!cloud.user) return;
  cloudState = 'saving'; app.updateSaveState();
  try {
    if (store.p) local.put(store.p, { thumb: thumbSVG(store.p) });
    await syncAll(thumbSVG);
    cloudState = 'ok';
    // se a versão da nuvem do projeto aberto for mais nova, recarrega
    const fresh = store.p && local.get(store.p.id);
    if (fresh && fresh.updatedAt > store.p.updatedAt) { app.loadProject(fresh, true); if (verbose) app.toast('Projeto atualizado com a versão da nuvem'); }
    else if (verbose) app.toast('Tudo sincronizado');
  } catch (e) {
    cloudState = e.status === 401 ? 'logout' : 'offline';
    if (verbose) app.toast(e.status === 404 ? 'A nuvem só funciona no site publicado' : 'Não foi possível sincronizar agora');
  }
  app.updateSaveState();
};

// ---------- abrir projetos ----------
app.loadProject = (p, keepView = false) => {
  const view = keepView ? { k: plan.k, tx: plan.tx, ty: plan.ty } : null;
  store.load(p);
  try { localStorage.setItem(LAST, p.id); } catch { /* ignora */ }
  if (view) Object.assign(plan, view);
};
app.openProject = async (id) => {
  let p = local.get(id);
  if (!p && cloud.user) { try { p = (await cloud.obter(id)).dados; if (p) local.put(p, { thumb: thumbSVG(p), syncedAt: p.updatedAt }); } catch { /* ignora */ } }
  if (!p) { app.toast('Não foi possível abrir o projeto'); return; }
  app.loadProject(p);
};

// ---------- reação às mudanças ----------
store.on((kind) => {
  if (kind === 'load') {
    $('#projName').value = store.p.name;
    syncToggles();
    requestAnimationFrame(() => plan.fit());
    renderLeft(); renderProps(); updateUndo();
    if (app.isMobile()) setPropsMode('closed');
    if (app.view === '3d') rebuild3D(false);
    return;
  }
  plan.draw();
  if (kind === 'live') return;
  if (kind === 'change') {
    if (document.activeElement !== $('#projName')) $('#projName').value = store.p.name;
    syncToggles(); updateUndo(); scheduleSave();
    renderProps(); renderLeft();
    if (app.view === '3d') rebuild3D(true);
  }
  if (kind === 'sel') {
    renderProps();
    if (app.tab !== 'catalog') renderLeft();
    if (app.isMobile()) {
      if (store.sel && propsMode === 'closed') setPropsMode('peek');
      if (!store.sel && propsMode === 'peek') setPropsMode('closed');
    }
  }
});
function updateUndo() { $('#bUndo').disabled = !store.past.length; $('#bRedo').disabled = !store.future.length; }
$('#bUndo').onclick = () => store.undo();
$('#bRedo').onclick = () => store.redo();
$('#projName').addEventListener('change', (e) => { const v = e.target.value.trim() || 'Projeto sem nome'; store.change((p) => { p.name = v; }); });
$('#projName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('#bProjects').onclick = () => dlgProjects();

// ---------- 3D ----------
let v3 = null, v3T = 0;
async function ensure3D() {
  if (v3) return v3;
  const { View3D } = await import('./view3d.js');
  v3 = new View3D($('#v3'));
  window.__app.v3 = v3;
  v3.onMode = (kind) => {
    $$('#v3View button').forEach((x) => x.classList.toggle('on', x.dataset.v === kind));
    $('#v3Move').hidden = kind !== 'walk';
  };
  v3.onFly = (fly) => $$('#v3Move button').forEach((x) => x.classList.toggle('on', (x.dataset.m === 'fly') === fly));
  $('#v3Loading').hidden = true;
  return v3;
}
function rebuild3D(keep) {
  clearTimeout(v3T);
  v3T = setTimeout(async () => { const v = await ensure3D(); v.build(store.p, keep); }, keep ? 150 : 0);
}
async function setView(view) {
  app.view = view;
  $$('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  const is3 = view === '3d';
  $('#v3').hidden = !is3;
  $('#tools').hidden = is3; $('#zoomBox').hidden = is3; $('#scaleBar').hidden = is3;
  updateWarn(plan.analysis);
  if (is3) {
    try {
      const v = await ensure3D();
      v.build(store.p, true);
      v.start();
    } catch (e) {
      $('#v3Loading').hidden = false;
      $('#v3Loading').textContent = 'Não foi possível abrir o 3D neste aparelho.';
      console.error(e);
    }
  } else if (v3) v3.stop();
}
$('#viewSeg').addEventListener('click', (e) => { const v = e.target.closest('button')?.dataset.view; if (v) setView(v); });
$('#v3View').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !v3) return;
  v3.view(b.dataset.v);
});
$('#v3Move').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !v3) return;
  v3.setFly(b.dataset.m === 'fly');
  app.toast(b.dataset.m === 'fly' ? 'Voo livre: E/▲ sobe, Q/▼ desce, atravessa tudo' : 'Caminhando: sobe escadas e anda em cima do mezanino');
});
$('#v3Walls').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !v3) return;
  $$('#v3Walls button').forEach((x) => x.classList.toggle('on', x === b));
  v3.wallMode = b.dataset.w; v3.build(store.p, true);
});

// ---------- menu "mais" ----------
const menu = $('#menuMore');
function openMenu() {
  let theme = 'auto'; try { theme = localStorage.getItem(THEME) || 'auto'; } catch { /* ignora */ }
  const themeName = { auto: 'automático', light: 'claro', dark: 'escuro' }[theme];
  menu.innerHTML = `
    <button data-m="png">${icon('image', 18)}Salvar imagem da planta</button>
    ${app.view === '3d' ? `<button data-m="png3d">${icon('image', 18)}Salvar imagem do 3D</button>` : ''}
    <button data-m="print">${icon('printer', 18)}Imprimir planta e lista</button>
    <hr>
    <button data-m="export">${icon('download', 18)}Baixar projeto (arquivo)</button>
    <button data-m="import">${icon('upload', 18)}Abrir arquivo de projeto</button>
    <button data-m="cloud">${icon('cloud', 18)}${cloud.user ? `Nuvem: ${esc(cloud.user)}` : 'Salvar na nuvem (conta)'}</button>
    <hr>
    <button data-m="selall">${icon('multi', 18)}Selecionar todos os móveis</button>
    <button data-m="measure">${icon('ruler', 18)}Adicionar medida</button>
    <button data-m="theme">${icon('sun', 18)}Tema: ${themeName}</button>
    <button data-m="help">${icon('help', 18)}Como usar</button>`;
  menu.hidden = false;
  const r = $('#bMore').getBoundingClientRect();
  menu.style.top = r.bottom + 6 + 'px';
  menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
}
$('#bMore').onclick = (e) => { e.stopPropagation(); if (menu.hidden) openMenu(); else menu.hidden = true; };
document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target.closest('#bMore') === null) menu.hidden = true; });
menu.addEventListener('click', async (e) => {
  const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
  menu.hidden = true;
  switch (m) {
    case 'png': exportPNG(); break;
    case 'png3d': if (v3) { const url = v3.snapshot(); const b = await (await fetch(url)).blob(); app.download(b, `${store.p.name} - 3D.png`); } break;
    case 'print': printPlan(); break;
    case 'export': app.download(new Blob([JSON.stringify(store.p, null, 1)], { type: 'application/json' }), `${store.p.name}.planta.json`); break;
    case 'import': $('#fileIn').click(); break;
    case 'cloud': if (cloud.user) dlgProjects(); else dlgCloud(); break;
    case 'selall': A.selectAll(); break;
    case 'measure': setTool('measure'); break;
    case 'theme': {
      let t = 'auto'; try { t = localStorage.getItem(THEME) || 'auto'; } catch { /* ignora */ }
      const next = { auto: 'light', light: 'dark', dark: 'auto' }[t];
      try { localStorage.setItem(THEME, next); } catch { /* ignora */ }
      applyTheme(); app.toast(`Tema ${{ auto: 'automático', light: 'claro', dark: 'escuro' }[next]}`);
      break;
    }
    case 'help': dlgHelp(); break;
  }
});

$('#fileIn').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!Array.isArray(p.rooms) || !Array.isArray(p.items)) throw new Error('formato');
    if (local.get(p.id)) { p.id = uid('p'); p.name = (p.name || 'Projeto') + ' (importado)'; }
    p.updatedAt = Date.now();
    migrate(p);
    app.saveNow(p); app.loadProject(p);
    app.toast('Projeto importado');
  } catch { app.toast('Arquivo inválido'); }
});

async function svgToPng(svg, w, h) {
  const max = 4096, sc = Math.min(1, max / Math.max(w, h));
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.round(w * sc); c.height = Math.round(h * sc);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
async function exportPNG() {
  const { svg, w, h } = plan.exportSVG(2);
  try { app.download(await svgToPng(svg, w, h), `${store.p.name} - planta.png`); }
  catch { app.download(new Blob([svg], { type: 'image/svg+xml' }), `${store.p.name} - planta.svg`); }
}
function printPlan() {
  const p = store.p;
  const { svg } = plan.exportSVG(1);
  const rows = p.items.map((it) => { const r = roomAt(p, it.x, it.y); return `<tr><td>${esc(r ? r.name : '—')}</td><td>${esc(it.name)}</td><td>${Math.round(it.w)} × ${Math.round(it.d)} × ${Math.round(it.h)}</td><td>${STATUS[it.status]?.n || ''}</td><td>${it.price ? fmtMoney(it.price) : ''}</td></tr>`; }).join('');
  const w = window.open('', '_blank');
  if (!w) { app.toast('Permita pop-ups para imprimir'); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.name)}</title><style>body{font:12px system-ui,sans-serif;margin:16px;color:#111}h1{font-size:18px}svg{width:100%;height:auto;max-height:68vh;display:block}table{border-collapse:collapse;width:100%;margin-top:14px;page-break-before:auto}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f2f2f2}</style></head><body><h1>${esc(p.name)}</h1>${svg}<table><thead><tr><th>Cômodo</th><th>Item</th><th>L × P × A (cm)</th><th>Status</th><th>Preço</th></tr></thead><tbody>${rows}</tbody></table><script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

// ---------- teclado ----------
window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || $('#dlg').open) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); return; }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); A.duplicateSelection(); return; }
  if (mod && k === 'c') { A.copySel(); return; }
  if (mod && k === 'v') { e.preventDefault(); A.pasteSel(); return; }
  if (mod && k === 'a') { e.preventDefault(); A.selectAll(); return; }
  if (mod) return;
  // no 3D, as teclas de andar são do 3D
  if (app.view === '3d' && ['w', 'a', 's', 'd', 'q', 'e', 'c', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown'].includes(k)) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); A.deleteSelection(); return; }
  if (e.key === 'Escape') { store.select(null); setTool('select'); setMulti(false); return; }
  if (k === 'r') { A.rotateSel(e.shiftKey ? -90 : 90); return; }
  if (k === 'm') { setTool(plan.tool === 'measure' ? 'select' : 'measure'); return; }
  if (k === 'v') { setTool('select'); return; }
  if (k === 'f') { plan.fit(); return; }
  if (k === 'h') { toggleFocus(); return; }
  if (k === ' ') { plan.spaceDown = true; return; }
  const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
  if (arrows[k]) { const s = e.shiftKey ? 10 : 1; if (A.nudge(arrows[k][0] * s, arrows[k][1] * s)) e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') plan.spaceDown = false; });

// ---------- início ----------
function start() {
  let id = null; try { id = localStorage.getItem(LAST); } catch { /* ignora */ }
  let p = id && local.get(id);
  if (!p) { const recent = local.list().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]; p = recent && local.get(recent.id); }
  const firstTime = !p;
  if (!p) { p = sampleProject(); app.saveNow(p); }
  app.loadProject(p);
  app.tab = app.isMobile() ? 'catalog' : 'catalog';
  renderLeft();
  app.updateSaveState();
  if (firstTime) setTimeout(() => app.toast('Este é um exemplo — mexa à vontade ou crie o seu em ☰ Projetos'), 600);
  if (cloud.user) app.syncNow(false);
}
start();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__app = { app, store, plan };
export { closeDialog, newProject, fmtLen, itemBox };
