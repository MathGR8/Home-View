// Modelo do projeto + estado da edição (seleção, desfazer/refazer).
import { uid, normalizePoly, edgesOf, pointInPoly, itemCorners, itemBox, polysOverlap, clamp, rotPt } from './geometry.js';
import { ALL_DEFS, OPENING_TYPES, NO_CLASH } from './catalog.js';
import { STRUCT_KEYS, isMezz } from './struct.js';

export const DEFAULT_SETTINGS = {
  snap: true,        // ímã: encaixar em paredes, cantos e outros móveis
  snapGrid: false,   // encaixar na grade
  showGrid: true,
  gridSize: 10,
  showDims: true,    // medidas das paredes
  showDist: true,    // distâncias do móvel selecionado até paredes/móveis
  showLabels: true,
  showItemDims: false,
  unit: 'm',         // como mostrar medidas das paredes: m ou cm
  wallT: 15,
};

export function newProject(name = 'Novo projeto') {
  const now = Date.now();
  return { id: uid('p'), name, version: 1, createdAt: now, updatedAt: now, settings: { ...DEFAULT_SETTINGS }, rooms: [], items: [], measures: [], library: [] };
}

export function migrate(p) {
  p.settings = { ...DEFAULT_SETTINGS, ...(p.settings || {}) };
  p.rooms ||= []; p.items ||= []; p.measures ||= []; p.library ||= [];
  for (const r of p.rooms) { r.openings ||= []; r.points = normalizePoly(r.points); r.height ||= 260; r.wallT ??= 15; }
  for (const it of p.items) { it.rot ||= 0; it.layer ||= 'normal'; it.status ||= 'tenho'; it.shape ||= 'rect'; it.z ||= 0; it.lvl ||= 0; }
  return p;
}

export const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

export function lPts(x, y, w, h, cw, ch, corner = 'tr') {
  cw = clamp(cw, 10, w - 10); ch = clamp(ch, 10, h - 10);
  const X = x + w, Y = y + h;
  switch (corner) {
    case 'tl': return [[x + cw, y], [X, y], [X, Y], [x, Y], [x, y + ch], [x + cw, y + ch]];
    case 'br': return [[x, y], [X, y], [X, Y - ch], [X - cw, Y - ch], [X - cw, Y], [x, Y]];
    case 'bl': return [[x, y], [X, y], [X, Y], [x + cw, Y], [x + cw, Y - ch], [x, Y - ch]];
    default: return [[x, y], [X - cw, y], [X - cw, y + ch], [X, y + ch], [X, Y], [x, Y]];
  }
}

export function makeRoom({ name = 'Cômodo', points, height = 260, wallT = 15, floor = '#efe6d8', noWalls = false }) {
  return { id: uid('r'), name, points: normalizePoly(points), height, wallT, floor, openings: [], locked: false, noWalls };
}

export function makeOpening(type, edgeLen, edge = 0) {
  const t = OPENING_TYPES[type] || OPENING_TYPES.door;
  const width = Math.min(t.w, Math.max(30, edgeLen - 10));
  return { id: uid('o'), type, edge, off: Math.max(0, (edgeLen - width) / 2), width, height: t.h, sill: t.sill, hinge: 'start', swing: 'in' };
}

// Corte de parede: um trecho (ou a parede inteira) sem parede; sill > 0 deixa uma mureta
// ext = quanto o corte pode passar do fim da parede (o canto, que tem a espessura da parede)
export function makeCut(edgeLen, edge, off, width, full = false, ext = 0) {
  const w = Math.max(4, Math.min(width, edgeLen + 2 * ext));
  return { id: uid('o'), type: 'cut', edge, off: full ? 0 : clamp(off, -ext, Math.max(-ext, edgeLen + ext - w)), width: full ? edgeLen : w, height: 0, sill: 0, full };
}

export function makeItem(def, x, y) {
  return {
    id: uid('i'), name: def.n, sym: def.sym || 'generic', shape: def.shape || 'rect',
    w: def.w, d: def.d, h: def.h ?? 80, x, y, rot: 0, color: def.color || '#a7b1bd',
    layer: def.layer || 'normal', elev: def.elev || 0, status: 'tenho', price: 0, note: '', locked: false, z: 0, lvl: 0,
    ...Object.fromEntries(STRUCT_KEYS.filter((k) => def[k] !== undefined).map((k) => [k, Array.isArray(def[k]) ? [...def[k]] : def[k]])),
  };
}

// ---------- consultas ----------
export function roomAt(p, x, y) {
  for (let i = p.rooms.length - 1; i >= 0; i--) if (pointInPoly(x, y, p.rooms[i].points)) return p.rooms[i];
  return null;
}

export function openingSeg(room, o) {
  const e = edgesOf(room.points)[o.edge];
  if (!e) return null;
  // corte "parede inteira": acompanha o comprimento da parede
  const off = o.full ? 0 : o.off, width = o.full ? e.len : o.width;
  const s = [e.a[0] + e.dir[0] * off, e.a[1] + e.dir[1] * off];
  const t = [s[0] + e.dir[0] * width, s[1] + e.dir[1] * width];
  return { e, s, t };
}

// ---------- luz presa no teto ----------
// Altura do piso (do andar do item) até o teto: pé-direito do cômodo, ou embaixo do piso do mezanino
export function ceilingAt(p, it) {
  const room = roomAt(p, it.x, it.y);
  const H = room ? room.height : 260;
  let mz = null;
  for (const m of p.items) {
    if (!isMezz(m)) continue;
    const [lx, ly] = rotPt(it.x - m.x, it.y - m.y, -(m.rot || 0));
    if (Math.abs(lx) <= m.w / 2 + 1 && Math.abs(ly) <= m.d / 2 + 1 && (!mz || m.h > mz.h)) mz = m;
  }
  if (!mz) return H;
  if (it.lvl) return Math.max(30, H - mz.h);
  return Math.max(30, Math.min(H, mz.h - (mz.thick ?? 12)));
}
// Altura do chão até a base da luminária quando ela está presa no teto
export function lampElev(p, it) {
  const c = ceilingAt(p, it);
  return Math.max(0, Math.round((c - Math.max(0, it.h) - (it.sym === 'indlight' ? 40 : 0)) * 10) / 10);
}
// Para o 3D e os painéis: elev efetiva (presa no teto ou a digitada)
export const elevOf = (p, it) => (it.ceil && it.layer === 'wall' ? lampElev(p, it) : it.elev || 0);

// Parede inteira removida?
export const wallRemoved = (room, edge) => room.noWalls || room.openings.some((o) => o.full && o.edge === edge);

// Cadeiras e banquetas podem ficar embaixo de mesas e escrivaninhas
const SEATS = new Set(['chair', 'stool', 'officechair']);
const TABLES = new Set(['table', 'roundtable', 'desk', 'deskL', 'counter']);
const tucks = (a, b) => SEATS.has(a.sym) && TABLES.has(b.sym);

// Colisões e móveis atravessando paredes
export function analyze(p) {
  const bad = new Set();
  const pairs = [];
  const solid = p.items.filter((i) => i.layer !== 'floor' && i.layer !== 'struct' && !NO_CLASH.has(i.sym));
  const polys = new Map(solid.map((i) => [i.id, itemCorners(i)]));
  const boxes = new Map(solid.map((i) => [i.id, itemBox(i)]));
  for (let a = 0; a < solid.length; a++) {
    for (let b = a + 1; b < solid.length; b++) {
      const A = solid[a], B = solid[b];
      if (A.layer !== B.layer || (A.lvl || 0) !== (B.lvl || 0) || tucks(A, B) || tucks(B, A)) continue;
      const ba = boxes.get(A.id), bb = boxes.get(B.id);
      if (ba.x2 <= bb.x1 || bb.x2 <= ba.x1 || ba.y2 <= bb.y1 || bb.y2 <= ba.y1) continue;
      if (polysOverlap(polys.get(A.id), polys.get(B.id))) { bad.add(A.id); bad.add(B.id); pairs.push([A, B]); }
    }
  }
  const crossing = [];
  for (const it of p.items) {
    if (NO_CLASH.has(it.sym)) continue;
    const room = roomAt(p, it.x, it.y);
    if (!room || room.noWalls) continue;
    const c = itemCorners({ ...it, w: Math.max(1, it.w - 2), d: Math.max(1, it.d - 2) });
    if (c.some(([x, y]) => !pointInPoly(x, y, room.points))) { bad.add(it.id); crossing.push(it); }
  }
  return { bad, pairs, crossing };
}

// ---------- store ----------
class Store {
  constructor() { this.p = null; this.sel = null; this.past = []; this.future = []; this.subs = new Set(); this._snap = null; }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit(kind) { for (const f of this.subs) f(kind); }
  load(p) { this.p = migrate(p); this.sel = null; this.past = []; this.future = []; this._snap = null; this.emit('load'); }
  begin() { if (!this._snap) this._snap = JSON.stringify(this.p); }
  commit() {
    if (!this._snap) return;
    const before = this._snap; this._snap = null;
    if (JSON.stringify(this.p) === before) { this.emit('live'); return; }
    this.past.push(before);
    if (this.past.length > 200) this.past.shift();
    this.future = [];
    this.p.updatedAt = Date.now();
    this.fixSel();
    this.emit('change');
  }
  cancel() { if (this._snap) { this.p = JSON.parse(this._snap); this._snap = null; this.fixSel(); this.emit('change'); } }
  change(fn) { this.begin(); fn(this.p); this.commit(); }
  live() { this.emit('live'); }
  undo() {
    if (!this.past.length) return;
    this.future.push(JSON.stringify(this.p));
    this.p = JSON.parse(this.past.pop()); this.p.updatedAt = Date.now();
    this.fixSel(); this.emit('change');
  }
  redo() {
    if (!this.future.length) return;
    this.past.push(JSON.stringify(this.p));
    this.p = JSON.parse(this.future.pop()); this.p.updatedAt = Date.now();
    this.fixSel(); this.emit('change');
  }
  select(sel) { this.sel = sel; this.fixSel(); this.emit('sel'); }
  fixSel() {
    const s = this.sel; if (!s || !this.p) return;
    if (s.kind === 'items') { s.ids = s.ids.filter((id) => this.item(id)); if (!s.ids.length) this.sel = null; }
    else if (s.kind === 'room' && !this.room(s.id)) this.sel = null;
    else if (s.kind === 'opening') { const r = this.room(s.room); if (!r || !r.openings.find((o) => o.id === s.id)) this.sel = null; }
    else if (s.kind === 'measure' && !this.p.measures.find((m) => m.id === s.id)) this.sel = null;
  }
  item(id) { return this.p.items.find((i) => i.id === id); }
  room(id) { return this.p.rooms.find((r) => r.id === id); }
  selItems() { return this.sel?.kind === 'items' ? this.sel.ids.map((id) => this.item(id)).filter(Boolean) : []; }
  isSel(id) { return this.sel?.kind === 'items' && this.sel.ids.includes(id); }
}
export const store = new Store();

// ---------- projeto de exemplo ----------
export function sampleProject() {
  const p = newProject('Meu apartamento (exemplo)');
  const t = 15;
  const sala = makeRoom({ name: 'Sala', points: rectPts(0, 0, 420, 360), floor: '#e3d2b8' });
  const coz = makeRoom({ name: 'Cozinha', points: rectPts(420 + t, 0, 260, 360), floor: '#ddd9d2' });
  const quarto = makeRoom({ name: 'Quarto', points: rectPts(0, 360 + t, 340, 320), floor: '#efe6d8' });
  const banho = makeRoom({ name: 'Banheiro', points: rectPts(340 + t, 360 + t, 170, 220), floor: '#cfd6dc' });
  const corr = makeRoom({ name: 'Corredor', points: rectPts(340 + t, 360 + t + 220 + t, 170, 85), floor: '#f3efe7' });
  const lav = makeRoom({ name: 'Área de serviço', points: rectPts(510 + 2 * t, 360 + t, 170, 150), floor: '#ddd9d2' });
  p.rooms.push(sala, coz, quarto, banho, corr, lav);
  const d = (r, type, edge, off, extra = {}) => { const e = edgesOf(r.points)[edge]; const o = makeOpening(type, e.len, edge); Object.assign(o, { off }, extra); r.openings.push(o); };
  d(sala, 'door', 2, 300, { hinge: 'end' });
  d(sala, 'window', 0, 120, { width: 180 });
  d(coz, 'pass', 3, 60, { width: 120 });
  d(coz, 'window', 0, 70, { width: 120 });
  d(quarto, 'window', 2, 110, { width: 150 });
  d(quarto, 'door', 1, 230, { hinge: 'start' });
  d(banho, 'door', 2, 40, { width: 70 });
  d(banho, 'window', 1, 140, { width: 60, sill: 160, height: 50 });
  d(lav, 'door', 3, 30, { width: 70 });
  d(coz, 'slide', 2, 90, { width: 120 });
  const add = (k, x, y, rot = 0, extra = {}) => { const def = ALL_DEFS.find((q) => q.k === k); const it = makeItem(def, x, y); it.rot = rot; Object.assign(it, extra); p.items.push(it); return it; };
  add('sofa3', 210, 45, 0);
  add('tapete', 210, 165, 0);
  add('centro', 210, 160, 0);
  add('rack', 210, 337.5, 180);
  add('tv55', 210, 356, 180);
  add('poltrona', 60, 170, 90);
  add('planta', 395, 25);
  add('geladeira', 420 + t + 35, 37.5, 0);
  add('pia', 420 + t + 60 + 70, 27.5, 0);
  add('fogao', 420 + t + 260 - 27.5, 31, 0);
  add('mesa4', 420 + t + 130, 250, 0, { status: 'comprar', price: 900 });
  add('cadeira', 420 + t + 100, 195, 0);
  add('cadeira', 420 + t + 160, 195, 0);
  add('cadeira', 420 + t + 100, 305, 180, { status: 'comprar', price: 250 });
  add('cadeira', 420 + t + 160, 305, 180, { status: 'comprar', price: 250 });
  add('queen', 170, 360 + t + 99, 0);
  add('criado', 170 - 79 - 22.5, 360 + t + 20, 0);
  add('criado', 170 + 79 + 22.5, 360 + t + 20, 0, { status: 'decidir' });
  add('guarda', 100, 360 + t + 320 - 27.5, 180);
  add('vaso', 340 + t + 25, 360 + t + 220 - 32.5, 180);
  add('gabinete', 340 + t + 110, 360 + t + 220 - 22.5, 180);
  add('box', 340 + t + 125, 360 + t + 45, 0);
  add('lavadora', 510 + 2 * t + 135, 360 + t + 32.5);
  add('tanque', 510 + 2 * t + 70, 360 + t + 25);
  add('caixaG', 820, 520);
  add('caixaM', 820, 590);
  add('caixaM', 880, 590);
  return p;
}
