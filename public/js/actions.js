// Ações de edição usadas pelos painéis, atalhos de teclado e menus.
import { store, makeItem, makeRoom, makeOpening, rectPts, lPts, roomAt } from './state.js';
import { itemBox, unionBox, bbox, edgesOf, uid, normAng, pointInPoly, clamp, offsetPoly } from './geometry.js';
import { isMezz, nearestMezzEdge, mezzUnder } from './struct.js';

let plan = null;
export const setPlan = (p) => { plan = p; };

const selBox = (its) => its.reduce((b, i) => unionBox(b, itemBox(i)), null);
const layerOf = (its) => (its.every((i) => i.layer === 'wall') ? 'wall' : 'normal');

export function addItem(def) {
  let [x, y] = plan.center();
  // se um cômodo estiver selecionado (ou no centro da tela), coloca no meio dele
  const selRoom = store.sel?.kind === 'room' ? store.room(store.sel.id) : null;
  const room = selRoom || roomAt(store.p, x, y);
  if (room) { const b = bbox(room.points); x = (b.x1 + b.x2) / 2; y = (b.y1 + b.y2) / 2; }
  const it = makeItem(def, Math.round(x), Math.round(y));
  // com um mezanino selecionado, o móvel vai para cima dele
  const selMezz = store.selItems().find(isMezz);
  if (selMezz && def.layer !== 'struct') { it.x = selMezz.x; it.y = selMezz.y; it.lvl = 1; }
  // evita empilhar exatamente no mesmo lugar
  let tries = 0;
  while (tries++ < 20 && store.p.items.some((o) => Math.abs(o.x - it.x) < 5 && Math.abs(o.y - it.y) < 5)) { it.x += 20; it.y += 20; }
  store.change((p) => p.items.push(it));
  store.select({ kind: 'items', ids: [it.id] });
  return it;
}

export function addRoom(o) {
  const p = store.p;
  const t = o.wallT ?? p.settings.wallT;
  let x = 0, y = 0;
  if (p.rooms.length) {
    let box = null;
    for (const r of p.rooms) box = unionBox(box, bbox(r.points));
    x = box.x2 + t; y = box.y1;
  }
  const pts = o.shape === 'L' ? lPts(x, y, o.w, o.h, o.cw, o.ch, o.corner) : rectPts(x, y, o.w, o.h);
  const r = makeRoom({ name: o.name, points: pts, height: o.height, wallT: t, floor: o.floor });
  store.change((pp) => pp.rooms.push(r));
  store.select({ kind: 'room', id: r.id });
  plan.fit();
  return r;
}

export function deleteSelection() {
  const s = store.sel; if (!s) return;
  store.change((p) => {
    if (s.kind === 'items') p.items = p.items.filter((i) => !s.ids.includes(i.id) || i.locked);
    if (s.kind === 'room') p.rooms = p.rooms.filter((r) => r.id !== s.id);
    if (s.kind === 'opening') { const r = p.rooms.find((q) => q.id === s.room); if (r) r.openings = r.openings.filter((o) => o.id !== s.id); }
    if (s.kind === 'measure') p.measures = p.measures.filter((m) => m.id !== s.id);
  });
  store.select(null);
}

export function deleteRoom(id, withItems) {
  store.change((p) => {
    const r = p.rooms.find((q) => q.id === id);
    if (withItems && r) p.items = p.items.filter((i) => !pointInPoly(i.x, i.y, r.points));
    p.rooms = p.rooms.filter((q) => q.id !== id);
  });
  store.select(null);
}

export function duplicateSelection() {
  const s = store.sel; if (!s) return;
  if (s.kind === 'items') {
    const its = store.selItems();
    const box = selBox(its);
    const off = (box.x2 - box.x1) < 300 ? Math.round(box.x2 - box.x1 + 10) : 30;
    const copies = its.map((i) => ({ ...JSON.parse(JSON.stringify(i)), id: uid('i'), x: i.x + off, locked: false }));
    store.change((p) => p.items.push(...copies));
    store.select({ kind: 'items', ids: copies.map((c) => c.id) });
  }
  if (s.kind === 'room') {
    const r = store.room(s.id);
    const b = bbox(r.points);
    const dx = b.x2 - b.x1 + r.wallT;
    const nr = { ...JSON.parse(JSON.stringify(r)), id: uid('r'), name: r.name + ' (cópia)' };
    nr.points = nr.points.map(([x, y]) => [x + dx, y]);
    nr.openings.forEach((o) => { o.id = uid('o'); });
    const items = store.p.items.filter((i) => pointInPoly(i.x, i.y, r.points)).map((i) => ({ ...JSON.parse(JSON.stringify(i)), id: uid('i'), x: i.x + dx }));
    store.change((p) => { p.rooms.push(nr); p.items.push(...items); });
    store.select({ kind: 'room', id: nr.id });
  }
}

let clipboard = null;
export function copySel() { const its = store.selItems(); if (its.length) clipboard = JSON.parse(JSON.stringify(its)); }
export function pasteSel() {
  if (!clipboard) return;
  const [cx, cy] = plan.center();
  const box = selBox(clipboard);
  const dx = cx - (box.x1 + box.x2) / 2, dy = cy - (box.y1 + box.y2) / 2;
  const copies = clipboard.map((i) => ({ ...i, id: uid('i'), x: Math.round(i.x + dx), y: Math.round(i.y + dy), locked: false }));
  store.change((p) => p.items.push(...copies));
  store.select({ kind: 'items', ids: copies.map((c) => c.id) });
}

export function rotateSel(delta) {
  const its = store.selItems().filter((i) => !i.locked);
  if (!its.length) return;
  store.change(() => {
    if (its.length === 1) { its[0].rot = normAng(Math.round((its[0].rot + delta) * 10) / 10); return; }
    // gira o grupo em volta do centro
    const b = selBox(its), cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
    const a = (delta * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    for (const i of its) {
      const x = i.x - cx, y = i.y - cy;
      i.x = Math.round((cx + x * c - y * s) * 10) / 10; i.y = Math.round((cy + x * s + y * c) * 10) / 10;
      i.rot = normAng(i.rot + delta);
    }
  });
}

// Leva o topo da escada até a beirada do mezanino mais próximo e ajusta a altura
export function fitStair(id) {
  const s = store.item(id); if (!s) return null;
  const near = nearestMezzEdge(store.p, s);
  if (!near) return null;
  store.change(() => {
    s.x = Math.round((s.x + near.point[0] - near.top[0]) * 10) / 10;
    s.y = Math.round((s.y + near.point[1] - near.top[1]) * 10) / 10;
    s.h = near.m.h;
  });
  return near.m;
}

// Coloca/tira os itens selecionados de cima do mezanino
export function setLevel(lvl) {
  const its = store.selItems().filter((i) => i.layer !== 'struct');
  store.change(() => its.forEach((i) => { i.lvl = lvl && mezzUnder(store.p, i.x, i.y) ? 1 : 0; }));
  return its.filter((i) => !!i.lvl !== !!lvl).length;
}

export function nudge(dx, dy) {
  const its = store.selItems().filter((i) => !i.locked);
  if (!its.length) return false;
  store.change(() => its.forEach((i) => { i.x += dx; i.y += dy; }));
  return true;
}

// Empurra até encostar na parede ou no próximo móvel naquela direção
export function push(dir) {
  const its = store.selItems().filter((i) => !i.locked);
  if (!its.length) return;
  const g = plan.gapsFor(selBox(its), its.map((i) => i.id), layerOf(its))[dir];
  if (!g) return;
  const d = g.gap;
  const v = { left: [-d, 0], right: [d, 0], up: [0, -d], down: [0, d] }[dir];
  store.change(() => its.forEach((i) => { i.x = Math.round((i.x + v[0]) * 10) / 10; i.y = Math.round((i.y + v[1]) * 10) / 10; }));
}

// Coloca no meio do espaço livre entre os obstáculos (paredes/móveis)
export function centerBetween(axis) {
  const its = store.selItems().filter((i) => !i.locked);
  if (!its.length) return;
  const gaps = plan.gapsFor(selBox(its), its.map((i) => i.id), layerOf(its));
  const [a, b] = axis === 'h' ? ['left', 'right'] : ['up', 'down'];
  if (!gaps[a] || !gaps[b]) return;
  const shift = (gaps[b].gap - gaps[a].gap) / 2;
  store.change(() => its.forEach((i) => { if (axis === 'h') i.x = Math.round((i.x + shift) * 10) / 10; else i.y = Math.round((i.y + shift) * 10) / 10; }));
}

// Muda a distância até a parede/móvel numa direção
export function setGap(dir, oldGap, newGap) {
  const its = store.selItems().filter((i) => !i.locked);
  if (!its.length || !Number.isFinite(newGap)) return;
  const d = oldGap - newGap;
  const v = { left: [-d, 0], right: [d, 0], up: [0, -d], down: [0, d] }[dir];
  store.change(() => its.forEach((i) => { i.x = Math.round((i.x + v[0]) * 10) / 10; i.y = Math.round((i.y + v[1]) * 10) / 10; }));
}

export function align(how) {
  const its = store.selItems().filter((i) => !i.locked);
  if (its.length < 2) return;
  const B = selBox(its);
  store.change(() => {
    for (const i of its) {
      const b = itemBox(i);
      if (how === 'left') i.x += B.x1 - b.x1;
      if (how === 'right') i.x += B.x2 - b.x2;
      if (how === 'ch') i.x += (B.x1 + B.x2) / 2 - (b.x1 + b.x2) / 2;
      if (how === 'top') i.y += B.y1 - b.y1;
      if (how === 'bottom') i.y += B.y2 - b.y2;
      if (how === 'cv') i.y += (B.y1 + B.y2) / 2 - (b.y1 + b.y2) / 2;
      i.x = Math.round(i.x * 10) / 10; i.y = Math.round(i.y * 10) / 10;
    }
  });
}

// Distribui com espaços iguais; com "gap" usa um espaçamento fixo
export function distribute(axis, gap = null) {
  const its = store.selItems().filter((i) => !i.locked);
  if (its.length < (gap === null ? 3 : 2)) return;
  const k1 = axis === 'h' ? 'x1' : 'y1', k2 = axis === 'h' ? 'x2' : 'y2', key = axis === 'h' ? 'x' : 'y';
  const list = its.map((i) => ({ i, b: itemBox(i) })).sort((a, b) => (a.b[k1] + a.b[k2]) - (b.b[k1] + b.b[k2]));
  const total = list[list.length - 1].b[k2] - list[0].b[k1];
  const sizes = list.reduce((s, q) => s + (q.b[k2] - q.b[k1]), 0);
  const g = gap ?? (total - sizes) / (list.length - 1);
  store.change(() => {
    let pos = list[0].b[k1];
    for (const q of list) {
      const sz = q.b[k2] - q.b[k1];
      q.i[key] = Math.round((q.i[key] + (pos - q.b[k1])) * 10) / 10;
      pos += sz + g;
    }
  });
}

export function setProp(ids, key, value) {
  store.change(() => ids.forEach((id) => { const it = store.item(id); if (it) it[key] = value; }));
}

export function toFront(back = false) {
  const its = store.selItems();
  const zs = store.p.items.map((i) => i.z || 0);
  const z = back ? Math.min(...zs) - 1 : Math.max(...zs) + 1;
  store.change(() => its.forEach((i) => { i.z = z; }));
}

// ---------- cômodos ----------
export function setWallLength(roomId, i, len) {
  const r = store.room(roomId); if (!r || !(len > 10)) return;
  const E = edgesOf(r.points);
  const e = E[i]; const delta = len - e.len;
  const n = r.points.length;
  store.change(() => {
    const ib = (i + 1) % n, ic = (i + 2) % n;
    const move = [e.dir[0] * delta, e.dir[1] * delta];
    // move a parede seguinte inteira (mantém os ângulos retos)
    const pts = r.points.map((q) => [...q]);
    pts[ib] = [pts[ib][0] + move[0], pts[ib][1] + move[1]];
    // se a parede seguinte continua na mesma direção, só o canto entre elas anda
    const next = E[(i + 1) % n];
    const straight = next.dir[0] * e.dir[0] + next.dir[1] * e.dir[1] > 0.99;
    if (n > 3 && !straight) pts[ic] = [pts[ic][0] + move[0], pts[ic][1] + move[1]];
    r.points = pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    plan.clampOpenings(r);
  });
}

export function setRoomSize(roomId, w, h) {
  const r = store.room(roomId); if (!r) return;
  const b = bbox(r.points);
  const sx = w / (b.x2 - b.x1), sy = h / (b.y2 - b.y1);
  if (!(sx > 0 && sy > 0)) return;
  store.change(() => {
    r.points = r.points.map(([x, y]) => [Math.round((b.x1 + (x - b.x1) * sx) * 10) / 10, Math.round((b.y1 + (y - b.y1) * sy) * 10) / 10]);
    plan.clampOpenings(r);
  });
}

export function splitWall(roomId, i) {
  const r = store.room(roomId); if (!r) return;
  store.change(() => {
    const n = r.points.length;
    const a = r.points[i], b = r.points[(i + 1) % n];
    r.points.splice(i + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]);
    const half = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
    for (const o of r.openings) {
      if (o.edge > i) o.edge++;
      else if (o.edge === i && o.off >= half) { o.edge = i + 1; o.off -= half; }
    }
    plan.clampOpenings(r);
  });
}

export function removeCorner(roomId, vi) {
  const r = store.room(roomId); if (!r || r.points.length <= 3) return;
  store.change(() => {
    const n = r.points.length;
    const prevEdge = (vi - 1 + n) % n;
    const prevLen = edgesOf(r.points)[prevEdge].len;
    r.points.splice(vi, 1);
    r.openings = r.openings.map((o) => {
      if (o.edge === vi) { o.edge = vi === 0 ? r.points.length - 1 : vi - 1; o.off += prevLen; }
      else if (o.edge > vi) o.edge--;
      return o;
    });
    plan.clampOpenings(r);
  });
}

export function addOpening(roomId, edge, type) {
  const r = store.room(roomId); if (!r) return;
  const e = edgesOf(r.points)[edge];
  const o = makeOpening(type, e.len, edge);
  store.change(() => r.openings.push(o));
  store.select({ kind: 'opening', room: roomId, id: o.id });
}

export function addMeasure() {
  const [x, y] = plan.center();
  const m = { id: uid('m'), a: [Math.round(x - 100), Math.round(y)], b: [Math.round(x + 100), Math.round(y)] };
  store.change((p) => p.measures.push(m));
  store.select({ kind: 'measure', id: m.id });
}

export function selectAll() {
  const ids = store.p.items.map((i) => i.id);
  if (ids.length) store.select({ kind: 'items', ids });
}

export function zoomToSel() {
  const s = store.sel;
  if (s?.kind === 'room') { const r = store.room(s.id); plan.fit(bbox(offsetPoly(r.points, r.wallT + 60))); }
  else if (s?.kind === 'items') { const b = selBox(store.selItems()); plan.fit({ x1: b.x1 - 150, y1: b.y1 - 150, x2: b.x2 + 150, y2: b.y2 + 150 }); }
}

export { clamp };
