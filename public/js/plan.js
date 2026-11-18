// Editor 2D (vista de cima) em SVG: desenho, seleção, arrastar, encaixe, girar, redimensionar e medir.
import {
  clamp, round, normAng, edgesOf, offsetPoly, centroid, bbox, itemCorners, itemBox, unionBox, boxesIntersect,
  rotPt, raySeg, projectOnSeg, fmtLen, fmtArea, signedArea, pointInPoly, esc, uid, deg,
} from './geometry.js';
import { store, analyze, openingSeg, roomAt } from './state.js';
import { bodyShape, symbolDetails, SYM_CSS } from './symbols.js';
import { STATUS } from './catalog.js';
import { isMezz, isStruct, mezzRails, stairInfo } from './struct.js';

const PLAN_CSS = `
.grid-minor{stroke:var(--grid1);stroke-width:1;vector-effect:non-scaling-stroke;fill:none}
.grid-major{stroke:var(--grid2);stroke-width:1;vector-effect:non-scaling-stroke;fill:none}
.floor{stroke:none}
.wall{fill:var(--wall);stroke:var(--wall-edge);stroke-width:1;vector-effect:non-scaling-stroke;fill-rule:evenodd}
.room.sel .wall{fill:var(--accent)}
.gap{fill:var(--gapc);stroke:none}
.op{fill:none;stroke:var(--ink2);stroke-width:1.2;vector-effect:non-scaling-stroke}
.op.leaf{stroke-width:2}
.op.arc{stroke-dasharray:3 3;stroke-width:1}
.op.glass{stroke:var(--glass);stroke-width:1.5}
.op.cutend{stroke:var(--ink3);stroke-dasharray:3 3}
.lowwall{fill:var(--wall);fill-opacity:.38;stroke:none}
.owall{fill:none;stroke:var(--ink3);stroke-width:1.2;stroke-dasharray:8 6;vector-effect:non-scaling-stroke}
.room.sel .owall{stroke:var(--accent);stroke-width:2}
.ophit{fill:transparent;stroke:none}
.opening.sel .op{stroke:var(--accent)}
.opening.sel .ophit{fill:var(--accent-soft)}
.rlabel{font:600 13px system-ui,sans-serif;fill:var(--ink);text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:var(--halo);stroke-width:3px;stroke-linejoin:round}
.rarea{font:12px system-ui,sans-serif;fill:var(--ink2);text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:var(--halo);stroke-width:3px}
.dim{font:500 11px system-ui,sans-serif;fill:var(--ink2);text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:var(--bg-plan);stroke-width:3px;cursor:pointer}
.dimline{stroke:var(--ink3);stroke-width:1;vector-effect:non-scaling-stroke;fill:none}
.item .lbl{font-family:system-ui,sans-serif;font-weight:600;fill:#1d2228;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:rgba(255,255,255,.75);stroke-linejoin:round}
.item .lbl2{font-weight:400;fill:#3a4048}
.item.wallitem .b{fill-opacity:.75;stroke-dasharray:5 3}
.item.floor .b{fill-opacity:.55}
.item.buy .b{stroke:#c05621;stroke-width:1.6;stroke-dasharray:6 3}
.item.out .b{fill-opacity:.35}
.item.bad .b{stroke:#e53e3e;stroke-width:2.4;stroke-dasharray:none}
.item.bad .hatch{fill:url(#hatch)}
.item.mezz .b{fill-opacity:.38;stroke-width:1.6}
.item.stair .b{fill:color-mix(in srgb,var(--c) 30%,#fff)}
.item.up .b{stroke:#2b6cb0;stroke-width:1.4}
.selbox{fill:none;stroke:var(--accent);stroke-width:2;vector-effect:non-scaling-stroke}
.selbox.multi{stroke-dasharray:6 4}
.handle{fill:#fff;stroke:var(--accent);stroke-width:2;vector-effect:non-scaling-stroke}
.handle.rot{fill:var(--accent)}
.rotline{stroke:var(--accent);stroke-width:1.5;vector-effect:non-scaling-stroke}
.guide{stroke:#e0338a;stroke-width:1.2;vector-effect:non-scaling-stroke;stroke-dasharray:5 4}
.dist{stroke:#2b6cb0;stroke-width:1.2;vector-effect:non-scaling-stroke}
.distlbl rect{fill:#2b6cb0}
.distlbl text{font:600 11px system-ui,sans-serif;fill:#fff;text-anchor:middle;dominant-baseline:central}
.distlbl{cursor:pointer}
.boxsel{fill:var(--accent-soft);stroke:var(--accent);stroke-width:1;vector-effect:non-scaling-stroke;stroke-dasharray:4 3}
.meas line{stroke:#805ad5;stroke-width:1.6;vector-effect:non-scaling-stroke}
.meas.sel line{stroke:var(--accent)}
.meas text{font:600 12px system-ui,sans-serif;fill:#553c9a;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:var(--bg-plan);stroke-width:4px}
.meas .hit{stroke:transparent;stroke-width:14;vector-effect:non-scaling-stroke}
.snapdot{fill:#e0338a}
.item.ghost{opacity:.16;pointer-events:none}
.ftex{pointer-events:none}
`;

// Texturas dos pisos dos cômodos na planta (em cm, por cima da cor)
const FLOOR_PAT = (() => {
  const k = 'stroke-width="0.9" fill="none"';
  const pat = (id, w, h, body) => `<pattern id="ft-${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`;
  return [
    pat('wood', 120, 30, `<path d="M0 15H120M0 30H120M40 0V15M100 15V30" stroke="rgba(70,40,15,.28)" ${k}/><path d="M0 6H120M0 22H120" stroke="rgba(70,40,15,.08)" ${k}/>`),
    pat('porcelain', 60, 60, `<path d="M0 0H60V60" stroke="rgba(0,0,0,.16)" ${k}/>`),
    pat('tiles', 30, 30, `<path d="M0 0H30V30" stroke="rgba(0,0,0,.2)" ${k}/>`),
    pat('concrete', 100, 100, `<path d="M0 0H100V100" stroke="rgba(0,0,0,.14)" stroke-dasharray="6 4" ${k}/>`),
    pat('cement', 90, 90, `<ellipse cx="25" cy="30" rx="22" ry="12" fill="rgba(0,0,0,.05)"/><ellipse cx="68" cy="70" rx="18" ry="10" fill="rgba(255,255,255,.08)"/>`),
    pat('deck', 112, 14, `<path d="M0 14H112M70 0V14" stroke="rgba(60,40,20,.3)" ${k}/>`),
    pat('grass', 24, 24, `<path d="M4 10l2-5 2 5M15 21l2-5 2 5" stroke="rgba(20,70,20,.35)" ${k}/>`),
    pat('soil', 16, 16, `<circle cx="4" cy="5" r="1.4" fill="rgba(40,25,10,.3)"/><circle cx="12" cy="12" r="1" fill="rgba(40,25,10,.25)"/>`),
    pat('gravel', 12, 12, `<ellipse cx="3" cy="4" rx="2.4" ry="1.8" fill="rgba(0,0,0,.14)"/><ellipse cx="9" cy="9" rx="2" ry="1.6" fill="rgba(255,255,255,.18)"/>`),
  ].join('');
})();

const LIGHT_VARS = '--bg-plan:#f7f6f3;--grid1:#ebe8e2;--grid2:#dcd7ce;--wall:#3b4048;--wall-edge:#22262b;--gapc:#f7f6f3;--ink:#1f2328;--ink2:#4a5058;--ink3:#7b828b;--halo:rgba(255,255,255,.85);--glass:#4a90c2;--accent:#2563eb;--accent-soft:rgba(37,99,235,.12)';
const DARK_VARS = '--bg-plan:#1b1e23;--grid1:#24282e;--grid2:#30353c;--wall:#cfd4da;--wall-edge:#e6e9ed;--gapc:#1b1e23;--ink:#eef0f2;--ink2:#c3c8ce;--ink3:#8d949c;--halo:rgba(20,22,26,.8);--glass:#7cc0ee;--accent:#5b8def;--accent-soft:rgba(91,141,239,.18)';

const f1 = (v) => Math.round(v * 10) / 10;

export class Plan {
  constructor(svg, hooks = {}) {
    this.svg = svg;
    this.hooks = hooks;
    this.k = 0.6; this.tx = 40; this.ty = 40;
    this.tool = 'select';
    this.multi = false;
    this.ptrs = new Map();
    this.op = null;
    this.guides = [];
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.dark = false;
    this.lastTap = { id: null, t: 0 };
    this.lvlView = 'all'; // tudo | 0 (só térreo) | 1 (só mezanino)
    this.panLock = false; // modo "mover a planta": arrastar nunca move objetos, só a planta (tocar continua selecionando)
    this.analysis = { bad: new Set(), pairs: [], crossing: [] };
    this.raf = 0;
    this.bind();
    new ResizeObserver(() => this.draw()).observe(svg);
  }

  // ---------- coordenadas ----------
  rect() { return this.svg.getBoundingClientRect(); }
  toWorld(cx, cy) { const r = this.rect(); return [(cx - r.left - this.tx) / this.k, (cy - r.top - this.ty) / this.k]; }
  get thr() { return (this.coarse ? 16 : 10) / this.k; }
  get S() { return store.p.settings; }

  zoomAt(factor, cx, cy) {
    const r = this.rect();
    const px = cx - r.left, py = cy - r.top;
    const wx = (px - this.tx) / this.k, wy = (py - this.ty) / this.k;
    this.k = clamp(this.k * factor, 0.05, 10);
    this.tx = px - wx * this.k; this.ty = py - wy * this.k;
    this.draw(); this.hooks.onView?.();
  }
  zoomBy(f) { const r = this.rect(); this.zoomAt(f, r.left + r.width / 2, r.top + r.height / 2); }

  fit(box) {
    const p = store.p; if (!p) return;
    if (!box) {
      for (const rm of p.rooms) box = unionBox(box, bbox(offsetPoly(rm.points, rm.wallT)));
      for (const it of p.items) box = unionBox(box, itemBox(it));
    }
    if (!box) box = { x1: 0, y1: 0, x2: 500, y2: 400 };
    const r = this.rect();
    const pad = Math.min(60, Math.max(24, r.width * 0.06));
    const w = Math.max(100, box.x2 - box.x1), h = Math.max(100, box.y2 - box.y1);
    this.k = clamp(Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / h), 0.05, 4);
    this.tx = (r.width - w * this.k) / 2 - box.x1 * this.k;
    this.ty = (r.height - h * this.k) / 2 - box.y1 * this.k;
    this.draw(); this.hooks.onView?.();
  }
  center() { const r = this.rect(); return this.toWorld(r.left + r.width / 2, r.top + r.height / 2); }

  // ---------- eventos ----------
  bind() {
    const s = this.svg;
    s.addEventListener('pointerdown', (e) => this.onDown(e));
    s.addEventListener('pointermove', (e) => this.onMove(e));
    s.addEventListener('pointerup', (e) => this.onUp(e));
    s.addEventListener('pointercancel', (e) => this.onUp(e, true));
    s.addEventListener('contextmenu', (e) => e.preventDefault());
    s.addEventListener('wheel', (e) => {
      e.preventDefault();
      const lineMul = e.deltaMode === 1 ? 33 : 1;
      const dy = e.deltaY * lineMul, dx = e.deltaX * lineMul;
      const isMouseWheel = !e.ctrlKey && dx === 0 && Math.abs(dy) >= 40 && Number.isInteger(e.deltaY);
      if (e.ctrlKey || isMouseWheel) this.zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
      else { this.tx -= dx; this.ty -= dy; this.draw(); }
    }, { passive: false });
  }

  // Com "só o térreo", o mezanino, as escadas e o que está em cima ficam transparentes (e o toque passa)
  isGhost(it) {
    const v = this.lvlView;
    if (v === 'all') return false;
    const upper = isStruct(it) || !!it.lvl;
    return v === 0 ? upper : !upper && it.sym !== 'ground';
  }
  // Itens embaixo de um ponto, do que está por cima (desenhado por último) para o de baixo
  itemsAt(x, y) {
    const p = store.p, byZ = (a, b) => (a.z || 0) - (b.z || 0);
    const lv = (l) => p.items.filter((i) => (i.lvl ? 1 : 0) === l && !isStruct(i));
    const order = [...p.items.filter((i) => i.sym === 'ground').sort(byZ), ...p.items.filter((i) => i.layer === 'floor' && i.sym !== 'ground')];
    for (const l of [0, 1]) {
      if (l === 1) order.push(...p.items.filter(isMezz), ...p.items.filter((i) => i.sym === 'stair'));
      const its = lv(l);
      order.push(...its.filter((i) => i.layer === 'normal').sort(byZ), ...its.filter((i) => i.layer === 'wall'));
    }
    const pad = 6 / this.k;
    return order.filter((it) => !this.isGhost(it) && pointInPoly(x, y, itemCorners({ ...it, w: it.w + pad, d: it.d + pad }))).reverse();
  }

  hitOf(e) {
    const el = e.target.closest?.('[data-hit]');
    return el ? { ...el.dataset } : null;
  }

  onDown(e) {
    if (!store.p) return;
    try { this.svg.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.ptrs.size === 2) { this.abortOp(); this.startPinch(); return; }
    if (this.ptrs.size > 2) return;
    const w = this.toWorld(e.clientX, e.clientY);
    const hit = this.hitOf(e);
    const add = e.shiftKey || e.ctrlKey || e.metaKey || this.multi;
    const op = { type: 'pan', sx: e.clientX, sy: e.clientY, w0: w, moved: false, hit, add, touch: e.pointerType !== 'mouse', tx0: this.tx, ty0: this.ty, shift: e.shiftKey };
    this.op = op;
    if (e.button === 1 || e.button === 2 || this.spaceDown) { op.type = 'pan'; return; }

    if (this.tool === 'measure' && (!hit || !['meas', 'dist'].includes(hit.hit))) { op.type = 'measure'; return; }
    if (!hit) { op.type = add ? 'box' : 'panTap'; return; }
    op.lockPan = this.panLock && !add;
    switch (hit.hit) {
      case 'rot': case 'rs': { const it = store.selItems()[0]; if (!it || it.locked) { op.type = 'pan'; break; } op.type = hit.hit; op.item = it.id; op.start = { ...it }; op.h = hit.h; break; }
      case 'item': {
        let id = hit.id;
        // o item selecionado está embaixo de outro (ex.: embaixo do mezanino)? continua pegando o selecionado
        if (!add && !store.isSel(id) && store.sel?.kind === 'items') { const under = this.itemsAt(w[0], w[1]).find((i) => store.isSel(i.id)); if (under) id = under.id; }
        const it = store.item(id);
        if (!add && !store.isSel(id) && !op.lockPan) store.select({ kind: 'items', ids: [id] });
        op.type = 'item'; op.id = id;
        op.wasSel = store.isSel(id);
        if (add && !store.isSel(id)) { store.select({ kind: 'items', ids: [...(store.sel?.kind === 'items' ? store.sel.ids : []), id] }); op.justAdded = true; }
        if (op.touch && !add && !op.lockPan) op.lp = setTimeout(() => this.longPress(id), 480);
        if (it?.locked && store.selItems().every((i) => i.locked)) op.noMove = true;
        break;
      }
      case 'open': { if (!op.lockPan) store.select({ kind: 'opening', room: hit.room, id: hit.id }); op.type = 'opening'; op.room = hit.room; op.oid = hit.id; break; }
      case 'redge': case 'rvert': { op.type = hit.hit; op.room = hit.id; op.i = +hit.i; break; }
      case 'room': {
        const sameRoom = store.sel?.kind === 'room' && store.sel.id === hit.id;
        const room = store.room(hit.id);
        op.room = hit.id;
        op.type = sameRoom && room && !room.locked ? 'room' : 'roomTap';
        break;
      }
      case 'meas': store.select({ kind: 'measure', id: hit.id }); op.type = 'tap'; break;
      case 'dist': case 'rdim': op.type = 'tap'; break;
      default: op.type = 'panTap';
    }
  }

  longPress(id) {
    const op = this.op;
    if (!op || op.moved || op.id !== id) return;
    op.type = 'tap'; op.consumed = true;
    navigator.vibrate?.(25);
    this.multi = true; this.hooks.onMulti?.(true);
    const ids = store.sel?.kind === 'items' ? store.sel.ids : [];
    if (!ids.includes(id)) store.select({ kind: 'items', ids: [...ids, id] });
  }

  startPinch() {
    const [a, b] = [...this.ptrs.values()];
    const r = this.rect();
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: this.k, wx: (cx - r.left - this.tx) / this.k, wy: (cy - r.top - this.ty) / this.k };
  }

  abortOp() {
    if (this.op) { clearTimeout(this.op.lp); if (this.op.began) store.commit(); }
    this.op = null; this.guides = []; this.boxSel = null; this.draft = null;
  }

  onMove(e) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const r = this.rect();
      const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.k = clamp(this.pinch.k0 * (d / this.pinch.d0), 0.05, 10);
      this.tx = cx - this.pinch.wx * this.k; this.ty = cy - this.pinch.wy * this.k;
      this.draw(); this.hooks.onView?.();
      return;
    }
    const op = this.op;
    if (!op) { this.hover(e); return; }
    const dsx = e.clientX - op.sx, dsy = e.clientY - op.sy;
    if (!op.moved) {
      if (Math.hypot(dsx, dsy) < (op.touch ? 8 : 4)) return;
      op.moved = true; clearTimeout(op.lp);
      if (op.type === 'panTap' || op.type === 'roomTap') op.type = 'pan';
      // modo "mover a planta": arrastar em cima de qualquer coisa só move a planta
      if (op.lockPan && ['item', 'rot', 'rs', 'opening', 'redge', 'rvert', 'room'].includes(op.type)) op.type = 'pan';
      if (op.type === 'tap') return;
      if (['item', 'rot', 'rs', 'opening', 'redge', 'rvert', 'room'].includes(op.type)) { store.begin(); op.began = true; this.prepare(op); }
      if (op.type === 'measure') { op.mid = uid('m'); }
    }
    const w = this.toWorld(e.clientX, e.clientY);
    op.shift = e.shiftKey;
    switch (op.type) {
      case 'pan': this.tx = op.tx0 + dsx; this.ty = op.ty0 + dsy; this.draw(); return;
      case 'box': this.boxSel = { x1: Math.min(op.w0[0], w[0]), y1: Math.min(op.w0[1], w[1]), x2: Math.max(op.w0[0], w[0]), y2: Math.max(op.w0[1], w[1]) }; this.draw(); return;
      case 'item': if (!op.noMove) this.dragItems(op, w); break;
      case 'rot': this.dragRotate(op, w); break;
      case 'rs': this.dragResize(op, w); break;
      case 'opening': this.dragOpening(op, w); break;
      case 'room': this.dragRoom(op, w); break;
      case 'redge': this.dragEdge(op, w); break;
      case 'rvert': this.dragVertex(op, w); break;
      case 'measure': this.dragMeasure(op, w); return;
      default: return;
    }
    store.live();
  }

  hover(e) {
    if (this.coarse) return;
    const h = this.hitOf(e);
    const c = !h ? 'grab' : h.hit === 'item' ? 'move' : h.hit === 'rot' ? 'grab' : h.hit === 'rs' ? 'nwse-resize' : h.hit === 'redge' ? 'ew-resize' : h.hit === 'rvert' ? 'crosshair' : h.hit === 'open' ? 'ew-resize' : 'pointer';
    this.svg.style.cursor = this.tool === 'measure' ? 'crosshair' : c;
  }

  onUp(e, cancel = false) {
    this.ptrs.delete(e.pointerId);
    if (this.pinch) { if (this.ptrs.size < 2) this.pinch = null; this.op = null; return; }
    const op = this.op; this.op = null;
    if (!op) return;
    clearTimeout(op.lp);
    if (op.consumed) return;
    if (op.moved) {
      if (op.type === 'box' && this.boxSel) {
        const b = this.boxSel;
        const hits = store.p.items.filter((it) => boxesIntersect(itemBox(it), b)).map((i) => i.id);
        const prev = store.sel?.kind === 'items' ? store.sel.ids : [];
        const ids = [...new Set([...prev, ...hits])];
        store.select(ids.length ? { kind: 'items', ids } : null);
      }
      if (op.type === 'measure' && this.draft) {
        const m = this.draft; this.draft = null;
        if (Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) > 2) { store.change((p) => p.measures.push(m)); store.select({ kind: 'measure', id: m.id }); }
      }
      this.boxSel = null; this.guides = [];
      if (op.began) { if (cancel) store.cancel(); else store.commit(); }
      this.draw();
      return;
    }
    // toque sem arrastar
    const hit = op.hit;
    switch (op.type) {
      case 'item': {
        const now = Date.now(), dbl = this.lastTap.id === op.id && now - this.lastTap.t < 350;
        const stack = op.add ? [] : this.itemsAt(op.w0[0], op.w0[1]);
        let id = op.id;
        if (op.add && op.wasSel && !op.justAdded) {
          const ids = store.sel.ids.filter((i) => i !== op.id);
          store.select(ids.length ? { kind: 'items', ids } : null);
        } else if (!op.add) {
          // tocar de novo no mesmo lugar pega o que está embaixo (mezanino → móvel embaixo dele, etc.)
          if (op.wasSel && !dbl && stack.length > 1) { const i = stack.findIndex((q) => q.id === op.id); id = stack[(i + 1) % stack.length].id; }
          store.select({ kind: 'items', ids: [id] });
        }
        if (dbl) this.hooks.onOpenProps?.();
        this.lastTap = { id, t: now };
        this.hooks.onStack?.(stack.length > 1 ? stack.map((q) => q.id) : [], id);
        break;
      }
      case 'panTap': case 'box': if (!op.add) store.select(null); this.hooks.onStack?.([]); break;
      case 'roomTap': case 'room': store.select({ kind: 'room', id: op.room }); this.hooks.onStack?.([]); break;
      case 'opening': store.select({ kind: 'opening', room: op.room, id: op.oid }); break;
      case 'tap':
        if (hit?.hit === 'dist') this.hooks.onEditDist?.(hit.dir, +hit.gap);
        if (hit?.hit === 'rdim') { store.select({ kind: 'room', id: hit.id }); this.hooks.onEditWall?.(hit.id, +hit.i); }
        break;
      case 'measure': break;
    }
    this.draw();
  }

  prepare(op) {
    const p = store.p;
    if (op.type === 'item') {
      const its = store.selItems().filter((i) => !i.locked);
      op.ids = its.map((i) => i.id);
      op.start = Object.fromEntries(its.map((i) => [i.id, [i.x, i.y]]));
      op.box0 = its.reduce((b, i) => unionBox(b, itemBox(i)), null);
      op.layer = its.every((i) => i.layer === 'wall') ? 'wall' : its.every((i) => i.layer === 'floor') ? 'floor' : 'normal';
      // o que está em cima do mezanino anda junto com ele
      for (const m of its.filter(isMezz)) {
        const c = itemCorners(m);
        for (const it of p.items) if (it.lvl && !it.locked && !op.start[it.id] && pointInPoly(it.x, it.y, c)) { op.ids.push(it.id); op.start[it.id] = [it.x, it.y]; }
      }
    }
    if (op.type === 'room') {
      const r = store.room(op.room);
      op.pts0 = r.points.map((q) => [...q]);
      op.items = p.items.filter((it) => pointInPoly(it.x, it.y, r.points)).map((it) => [it.id, it.x, it.y]);
      op.meas = p.measures.filter((m) => pointInPoly(m.a[0], m.a[1], r.points) && pointInPoly(m.b[0], m.b[1], r.points)).map((m) => [m.id, [...m.a], [...m.b]]);
      op.box0 = bbox(r.points);
    }
    if (op.type === 'redge' || op.type === 'rvert') { const r = store.room(op.room); op.pts0 = r.points.map((q) => [...q]); }
    if (op.type === 'opening') {
      const r = store.room(op.room), o = r.openings.find((x) => x.id === op.oid);
      const e = edgesOf(r.points)[o.edge];
      const pr = projectOnSeg(op.w0[0], op.w0[1], e.a, e.b);
      op.grab = pr.along - o.off;
    }
  }

  // ---------- arrastar móveis com encaixe ----------
  dragItems(op, w) {
    let dx = w[0] - op.w0[0], dy = w[1] - op.w0[1];
    const snapped = this.snapBox(op.box0, dx, dy, op.ids, op.layer, op.shift);
    dx = snapped.dx; dy = snapped.dy; this.guides = snapped.guides;
    for (const id of op.ids) { const it = store.item(id); const [x0, y0] = op.start[id]; it.x = f1(x0 + dx); it.y = f1(y0 + dy); }
  }

  snapCandidates(exclude, layer, box) {
    const p = store.p, xs = [], ys = [];
    const near = 260;
    for (const r of p.rooms) {
      const inRoom = pointInPoly((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2, r.points);
      for (const e of edgesOf(r.points)) {
        if (Math.abs(e.dir[0]) < 0.01) { // parede vertical
          const y1 = Math.min(e.a[1], e.b[1]), y2 = Math.max(e.a[1], e.b[1]);
          if (box.y2 < y1 - 40 || box.y1 > y2 + 40) continue;
          xs.push({ v: e.a[0], side: e.nIn[0] > 0 ? 'L' : 'R', g: [y1, y2], wall: true });
        } else if (Math.abs(e.dir[1]) < 0.01) {
          const x1 = Math.min(e.a[0], e.b[0]), x2 = Math.max(e.a[0], e.b[0]);
          if (box.x2 < x1 - 40 || box.x1 > x2 + 40) continue;
          ys.push({ v: e.a[1], side: e.nIn[1] > 0 ? 'T' : 'B', g: [x1, x2], wall: true });
        }
      }
      if (inRoom) {
        const b = bbox(r.points), cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
        xs.push({ v: cx, side: 'C', g: [b.y1, b.y2], center: true });
        ys.push({ v: cy, side: 'C', g: [b.x1, b.x2], center: true });
      }
    }
    for (const it of p.items) {
      if (exclude.includes(it.id)) continue;
      if (layer !== 'floor' && it.layer === 'floor' && layer !== 'normal') continue;
      const b = itemBox(it);
      if (b.y1 - box.y2 < near && box.y1 - b.y2 < near) {
        xs.push({ v: b.x2, side: 'L', g: [b.y1, b.y2] }, { v: b.x1, side: 'R', g: [b.y1, b.y2] }, { v: b.x1, side: 'L', g: [b.y1, b.y2] }, { v: b.x2, side: 'R', g: [b.y1, b.y2] }, { v: (b.x1 + b.x2) / 2, side: 'C', g: [b.y1, b.y2] });
      }
      if (b.x1 - box.x2 < near && box.x1 - b.x2 < near) {
        ys.push({ v: b.y2, side: 'T', g: [b.x1, b.x2] }, { v: b.y1, side: 'B', g: [b.x1, b.x2] }, { v: b.y1, side: 'T', g: [b.x1, b.x2] }, { v: b.y2, side: 'B', g: [b.x1, b.x2] }, { v: (b.y1 + b.y2) / 2, side: 'C', g: [b.x1, b.x2] });
      }
    }
    return { xs, ys };
  }

  snapBox(box0, dx, dy, exclude, layer, free) {
    const S = this.S;
    const guides = [];
    let b = { x1: box0.x1 + dx, y1: box0.y1 + dy, x2: box0.x2 + dx, y2: box0.y2 + dy };
    if (S.snap && !free) {
      const { xs, ys } = this.snapCandidates(exclude, layer, b);
      const thr = this.thr;
      const pick = (cands, sides) => {
        let best = null;
        for (const c of cands) {
          const v = sides[c.side]; if (v === undefined) continue;
          const diff = c.v - v;
          if (Math.abs(diff) <= thr && (!best || Math.abs(diff) < Math.abs(best.diff) - 0.01 || (Math.abs(Math.abs(diff) - Math.abs(best.diff)) < 0.01 && c.wall))) best = { ...c, diff };
        }
        return best;
      };
      const bx = pick(xs, { L: b.x1, R: b.x2, C: (b.x1 + b.x2) / 2 });
      const by = pick(ys, { T: b.y1, B: b.y2, C: (b.y1 + b.y2) / 2 });
      if (bx) { dx += bx.diff; b.x1 += bx.diff; b.x2 += bx.diff; }
      if (by) { dy += by.diff; b.y1 += by.diff; b.y2 += by.diff; }
      if (bx) guides.push({ x: bx.v, y1: Math.min(b.y1, bx.g[0]) - 20, y2: Math.max(b.y2, bx.g[1]) + 20 });
      if (by) guides.push({ y: by.v, x1: Math.min(b.x1, by.g[0]) - 20, x2: Math.max(b.x2, by.g[1]) + 20 });
      if (!bx && S.snapGrid) { const g = S.gridSize; const nx = round(b.x1, g); dx += nx - b.x1; }
      if (!by && S.snapGrid) { const g = S.gridSize; const ny = round(b.y1, g); dy += ny - b.y1; }
    } else if (S.snapGrid && !free) {
      const g = S.gridSize; dx += round(b.x1, g) - b.x1; dy += round(b.y1, g) - b.y1;
    }
    return { dx, dy, guides };
  }

  dragRotate(op, w) {
    const it = store.item(op.item);
    let a = deg(Math.atan2(w[1] - it.y, w[0] - it.x)) + 90;
    const step = op.shift ? 1 : 15;
    a = normAng(Math.round(a / step) * step);
    it.rot = a;
  }

  dragResize(op, w) {
    const it = store.item(op.item), s = op.start;
    const [lx, ly] = rotPt(w[0] - s.x, w[1] - s.y, -s.rot);
    let x1 = -s.w / 2, x2 = s.w / 2, y1 = -s.d / 2, y2 = s.d / 2;
    const h = op.h;
    if (h.includes('e')) x2 = Math.max(x1 + 5, round(lx));
    if (h.includes('w')) x1 = Math.min(x2 - 5, round(lx));
    if (h.includes('s')) y2 = Math.max(y1 + 5, round(ly));
    if (h.includes('n')) y1 = Math.min(y2 - 5, round(ly));
    if (it.shape === 'round' && h.length === 2 && !op.shift) { // círculo: mantém proporção
      const sz = Math.max(x2 - x1, y2 - y1);
      if (h.includes('e')) x2 = x1 + sz; else x1 = x2 - sz;
      if (h.includes('s')) y2 = y1 + sz; else y1 = y2 - sz;
    }
    const [cx, cy] = rotPt((x1 + x2) / 2, (y1 + y2) / 2, s.rot);
    it.w = Math.round(x2 - x1); it.d = Math.round(y2 - y1);
    it.x = f1(s.x + cx); it.y = f1(s.y + cy);
  }

  dragOpening(op, w) {
    const r = store.room(op.room), o = r.openings.find((x) => x.id === op.oid);
    if (o.full) return;
    const E = edgesOf(r.points), ext = o.type === 'cut' ? r.wallT : 0;
    let best = null;
    for (const e of E) {
      if (e.len + 2 * ext < o.width) continue;
      const pr = projectOnSeg(w[0], w[1], e.a, e.b);
      if (!best || pr.dist < best.pr.dist - 2) best = { e, pr };
    }
    if (!best) return;
    if (best.e.i !== o.edge) { o.edge = best.e.i; op.grab = o.width / 2; }
    o.off = Math.round(clamp(best.pr.along - op.grab, -ext, best.e.len + ext - o.width));
  }

  moveRoomBy(op, dx, dy) {
    const r = store.room(op.room);
    r.points = op.pts0.map(([x, y]) => [f1(x + dx), f1(y + dy)]);
    for (const [id, x, y] of op.items) { const it = store.item(id); if (it) { it.x = f1(x + dx); it.y = f1(y + dy); } }
    for (const [id, a, b] of op.meas) { const m = store.p.measures.find((q) => q.id === id); if (m) { m.a = [a[0] + dx, a[1] + dy]; m.b = [b[0] + dx, b[1] + dy]; } }
  }

  dragRoom(op, w) {
    let dx = round(w[0] - op.w0[0]), dy = round(w[1] - op.w0[1]);
    const r = store.room(op.room);
    this.guides = [];
    if (this.S.snap && !op.shift) {
      const b = { x1: op.box0.x1 + dx, y1: op.box0.y1 + dy, x2: op.box0.x2 + dx, y2: op.box0.y2 + dy };
      const thr = this.thr * 1.5;
      let bx = null, by = null;
      for (const o of store.p.rooms) {
        if (o.id === r.id) continue;
        const ob = bbox(o.points), t = Math.max(o.wallT, r.wallT);
        for (const [mine, theirs] of [[b.x1, ob.x2 + t], [b.x2, ob.x1 - t], [b.x1, ob.x1], [b.x2, ob.x2]]) { const d = theirs - mine; if (Math.abs(d) < thr && (!bx || Math.abs(d) < Math.abs(bx))) bx = d; }
        for (const [mine, theirs] of [[b.y1, ob.y2 + t], [b.y2, ob.y1 - t], [b.y1, ob.y1], [b.y2, ob.y2]]) { const d = theirs - mine; if (Math.abs(d) < thr && (!by || Math.abs(d) < Math.abs(by))) by = d; }
      }
      if (bx) dx += bx; if (by) dy += by;
    }
    this.moveRoomBy(op, dx, dy);
  }

  dragEdge(op, w) {
    const r = store.room(op.room);
    const E = edgesOf(op.pts0);
    const e = E[op.i];
    const n = r.points.length;
    let s = (w[0] - op.w0[0]) * e.nIn[0] + (w[1] - op.w0[1]) * e.nIn[1];
    // encaixe com outros cômodos (paredes encostadas)
    if (this.S.snap && !op.shift) {
      const axisX = Math.abs(e.dir[0]) < 0.01, axisY = Math.abs(e.dir[1]) < 0.01;
      if (axisX || axisY) {
        const cur = axisX ? e.a[0] + e.nIn[0] * s : e.a[1] + e.nIn[1] * s;
        let best = null;
        for (const o of store.p.rooms) {
          if (o.id === r.id) continue;
          const ob = bbox(o.points), t = Math.max(o.wallT, r.wallT);
          const vals = axisX ? [ob.x1, ob.x2, ob.x1 - t, ob.x2 + t] : [ob.y1, ob.y2, ob.y1 - t, ob.y2 + t];
          for (const v of vals) { const d = v - cur; if (Math.abs(d) < this.thr && (!best || Math.abs(d) < Math.abs(best))) best = d; }
        }
        if (best) s += best * (axisX ? e.nIn[0] : e.nIn[1]);
      }
    }
    s = round(s);
    const pts = op.pts0.map((q) => [...q]);
    const ia = op.i, ib = (op.i + 1) % n;
    pts[ia] = [f1(pts[ia][0] + e.nIn[0] * s), f1(pts[ia][1] + e.nIn[1] * s)];
    pts[ib] = [f1(pts[ib][0] + e.nIn[0] * s), f1(pts[ib][1] + e.nIn[1] * s)];
    if (signedArea(pts) < 2000 || edgesOf(pts).some((q) => q.len < 20)) return;
    r.points = pts;
    this.clampOpenings(r);
  }

  dragVertex(op, w) {
    const r = store.room(op.room);
    const n = op.pts0.length;
    let x = round(w[0]), y = round(w[1]);
    if (!op.shift) {
      const prev = op.pts0[(op.i - 1 + n) % n], next = op.pts0[(op.i + 1) % n];
      for (const q of [prev, next]) { if (Math.abs(q[0] - x) < this.thr) x = q[0]; if (Math.abs(q[1] - y) < this.thr) y = q[1]; }
    }
    const pts = op.pts0.map((q) => [...q]);
    pts[op.i] = [x, y];
    if (signedArea(pts) < 2000) return;
    r.points = pts;
    this.clampOpenings(r);
  }

  clampOpenings(r) {
    const E = edgesOf(r.points);
    for (const o of r.openings) {
      const e = E[o.edge]; if (!e) continue;
      if (o.full) { o.off = 0; o.width = Math.round(e.len * 10) / 10; continue; }
      // corte pode pegar o canto (passa até uma espessura de parede do fim)
      const ext = o.type === 'cut' ? r.wallT : 0;
      o.width = Math.min(o.width, Math.max(o.type === 'cut' ? 4 : 20, Math.floor(e.len + 2 * ext)));
      o.off = clamp(o.off, -ext, Math.max(-ext, e.len + ext - o.width));
    }
  }

  measureSnap(w) {
    const p = store.p, thr = this.thr;
    let best = null;
    const tryPt = (q) => { const d = Math.hypot(q[0] - w[0], q[1] - w[1]); if (d < thr && (!best || d < best.d)) best = { q, d }; };
    for (const r of p.rooms) r.points.forEach(tryPt);
    for (const it of p.items) itemCorners(it).forEach(tryPt);
    if (best) return [...best.q];
    // encosta na parede mais próxima
    for (const r of p.rooms) for (const e of edgesOf(r.points)) {
      const pr = projectOnSeg(w[0], w[1], e.a, e.b);
      if (pr.dist < thr * 0.7) return [e.a[0] + (e.b[0] - e.a[0]) * pr.t, e.a[1] + (e.b[1] - e.a[1]) * pr.t];
    }
    return [round(w[0]), round(w[1])];
  }

  dragMeasure(op, w) {
    if (!op.a) op.a = this.measureSnap(op.w0);
    let b = this.measureSnap(w);
    if (!op.shift) { // trava na horizontal/vertical
      const dx = b[0] - op.a[0], dy = b[1] - op.a[1];
      const ang = Math.abs(deg(Math.atan2(dy, dx))) % 180;
      if (ang < 6 || ang > 174) b = [b[0], op.a[1]];
      else if (Math.abs(ang - 90) < 6) b = [op.a[0], b[1]];
    }
    this.draft = { id: op.mid, a: op.a, b };
    this.draw();
  }

  // ---------- distâncias até paredes e móveis ----------
  obstacles(exclude, layer) {
    const segs = [];
    // nível: em cima do mezanino, estrutura ou térreo
    const ex = exclude.map((id) => store.item(id)).filter(Boolean);
    const mode = ex.length && ex.every((i) => i.lvl) ? 'top' : ex.length && ex.every(isStruct) ? 'struct' : 'ground';
    for (const r of store.p.rooms) for (const e of edgesOf(r.points)) segs.push([e.a, e.b]);
    for (const it of store.p.items) {
      if (exclude.includes(it.id) || it.layer === 'floor') continue;
      if (mode === 'top' ? !(isMezz(it) || it.lvl) : mode === 'struct' ? !isStruct(it) : isMezz(it) || it.lvl) continue;
      if (mode === 'top' && isMezz(it)) { const c = itemCorners(it); for (let i = 0; i < 4; i++) segs.push([c[i], c[(i + 1) % 4]]); continue; }
      if (layer === 'wall' ? it.layer !== 'wall' : it.layer === 'wall') continue;
      const c = itemCorners(it);
      for (let i = 0; i < 4; i++) segs.push([c[i], c[(i + 1) % 4]]);
    }
    return segs;
  }

  gapsFor(box, exclude, layer) {
    const segs = this.obstacles(exclude, layer);
    const out = {};
    const dirs = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    for (const [name, [dx, dy]] of Object.entries(dirs)) {
      const origins = dx ? [box.y1 + 1, (box.y1 + box.y2) / 2, box.y2 - 1].map((y) => [dx < 0 ? box.x1 : box.x2, y]) : [box.x1 + 1, (box.x1 + box.x2) / 2, box.x2 - 1].map((x) => [x, dy < 0 ? box.y1 : box.y2]);
      let best = null;
      for (const o of origins) for (const [a, b] of segs) {
        const t = raySeg(o[0], o[1], dx, dy, a, b);
        if (t < Infinity && (!best || t < best.t - 0.01)) best = { t, o };
      }
      if (best && best.t < 3000) {
        const mid = dx ? [best.o[0], (box.y1 + box.y2) / 2] : [(box.x1 + box.x2) / 2, best.o[1]];
        out[name] = { gap: best.t, from: mid, to: [mid[0] + dx * best.t, mid[1] + dy * best.t] };
      }
    }
    return out;
  }

  // ---------- desenho ----------
  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  render() {
    const p = store.p;
    if (!p) { this.svg.innerHTML = ''; return; }
    const r = this.rect();
    const k = this.k;
    this.analysis = analyze(p);
    const vb = { x1: -this.tx / k, y1: -this.ty / k, x2: (r.width - this.tx) / k, y2: (r.height - this.ty) / k };
    const out = [];
    out.push(`<defs><style>${SYM_CSS}${PLAN_CSS}</style>${FLOOR_PAT}<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="rgba(229,62,62,.35)"/></pattern></defs>`);
    out.push(`<rect x="0" y="0" width="100%" height="100%" fill="var(--bg-plan)"/>`);
    out.push(`<g transform="translate(${f1(this.tx)} ${f1(this.ty)}) scale(${k})">`);
    if (this.S.showGrid) out.push(this.gridSVG(vb, k));
    out.push(this.planBody(p, k, false));
    out.push(this.overlaySVG(p, k));
    out.push('</g>');
    this.svg.setAttribute('style', this.dark ? DARK_VARS : LIGHT_VARS);
    this.svg.innerHTML = out.join('');
    this.hooks.onRender?.(this.analysis);
  }

  gridSVG(vb, k) {
    const steps = [5, 10, 20, 50, 100, 200, 500, 1000];
    let st = steps.find((s) => s * k >= 12) || 1000;
    const major = st < 100 ? 100 : st * 5;
    let minor = '', maj = '';
    const x0 = Math.floor(vb.x1 / st) * st, y0 = Math.floor(vb.y1 / st) * st;
    for (let x = x0; x <= vb.x2; x += st) { const s = `M${x},${f1(vb.y1)}V${f1(vb.y2)}`; if (x % major === 0) maj += s; else minor += s; }
    for (let y = y0; y <= vb.y2; y += st) { const s = `M${f1(vb.x1)},${y}H${f1(vb.x2)}`; if (y % major === 0) maj += s; else minor += s; }
    return `<path class="grid-minor" d="${minor}"/><path class="grid-major" d="${maj}"/>`;
  }

  // Corpo da planta (também usado na exportação de imagem)
  planBody(p, k, exporting) {
    const S = p.settings, out = [];
    const sel = exporting ? null : store.sel;
    const ptsStr = (pts) => pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' ');
    const byZ = (a, b) => (a.z || 0) - (b.z || 0);
    // pisos externos (grama, concreto…) ficam por baixo dos cômodos
    for (const it of p.items.filter((i) => i.sym === 'ground').sort(byZ)) out.push(this.itemSVG(it, k, exporting));
    // pisos
    for (const rm of p.rooms) {
      out.push(`<polygon class="floor" data-hit="room" data-id="${rm.id}" points="${ptsStr(rm.points)}" fill="${esc(rm.floor)}"/>`);
      if (rm.floorTex && rm.floorTex !== 'plain') out.push(`<polygon class="ftex" points="${ptsStr(rm.points)}" fill="url(#ft-${esc(rm.floorTex)})"/>`);
    }
    // tapetes
    for (const it of p.items.filter((i) => i.layer === 'floor' && i.sym !== 'ground')) out.push(this.itemSVG(it, k, exporting));
    // paredes (área externa: só o contorno tracejado)
    for (const rm of p.rooms) {
      const isSel = sel?.kind === 'room' && sel.id === rm.id;
      if (rm.noWalls) { out.push(`<g class="room${isSel ? ' sel' : ''}"><polygon class="owall" points="${ptsStr(rm.points)}"/></g>`); continue; }
      const outer = offsetPoly(rm.points, rm.wallT);
      out.push(`<g class="room${isSel ? ' sel' : ''}"><path class="wall" data-hit="room" data-id="${rm.id}" d="M${ptsStr(outer)}Z M${ptsStr(rm.points)}Z"/></g>`);
    }
    // portas e janelas
    for (const rm of p.rooms) for (const o of rm.openings) out.push(this.openingSVG(rm, o, sel, k));
    // nomes e medidas dos cômodos
    for (const rm of p.rooms) out.push(this.roomLabels(rm, k, S, exporting));
    // móveis do térreo, depois mezanino e escadas, depois o que está em cima do mezanino
    const lv = (l) => p.items.filter((i) => (i.lvl ? 1 : 0) === l);
    for (const l of [0, 1]) {
      if (l === 1) {
        for (const it of p.items.filter(isMezz)) out.push(this.itemSVG(it, k, exporting));
        for (const it of p.items.filter((i) => i.sym === 'stair')) out.push(this.itemSVG(it, k, exporting));
      }
      const its = lv(l);
      for (const it of [...its.filter((i) => i.layer === 'normal').sort(byZ), ...its.filter((i) => i.layer === 'wall')]) out.push(this.itemSVG(it, k, exporting));
    }
    // cotas
    for (const m of p.measures) out.push(this.measureSVG(m, k, sel?.kind === 'measure' && sel.id === m.id));
    return out.join('');
  }

  roomLabels(rm, k, S, exporting) {
    let s = '';
    const b = bbox(rm.points);
    const lc = this.labelSpot(rm, k);
    if ((b.x2 - b.x1) * k > 50) {
      s += `<text class="rlabel" data-hit="room" data-id="${rm.id}" x="${f1(lc[0])}" y="${f1(lc[1] - 8 / k)}" style="font-size:${f1(13 / k)}px;stroke-width:${f1(3 / k)}px">${esc(rm.name)}</text>`;
      s += `<text class="rarea" data-hit="room" data-id="${rm.id}" x="${f1(lc[0])}" y="${f1(lc[1] + 9 / k)}" style="font-size:${f1(11.5 / k)}px;stroke-width:${f1(3 / k)}px">${fmtArea(Math.abs(signedArea(rm.points)))}</text>`;
    }
    if (S.showDims) {
      for (const e of edgesOf(rm.points)) {
        if (e.len * k < 34) continue;
        const off = 11 / k;
        const mx = (e.a[0] + e.b[0]) / 2 + e.nIn[0] * off, my = (e.a[1] + e.b[1]) / 2 + e.nIn[1] * off;
        let ang = deg(Math.atan2(e.dir[1], e.dir[0]));
        if (ang > 90 || ang <= -90) ang += 180;
        s += `<text class="dim"${exporting ? '' : ` data-hit="rdim" data-id="${rm.id}" data-i="${e.i}"`} x="${f1(mx)}" y="${f1(my)}" transform="rotate(${f1(ang)} ${f1(mx)} ${f1(my)})" style="font-size:${f1(11 / k)}px;stroke-width:${f1(3 / k)}px">${fmtLen(e.len, S.unit)}</text>`;
      }
    }
    return s;
  }

  // Procura um lugar dentro do cômodo onde o nome não fique embaixo de um móvel
  labelSpot(rm, k) {
    const b = bbox(rm.points);
    const c0 = centroid(rm.points);
    const c = pointInPoly(c0[0], c0[1], rm.points) ? c0 : [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
    const lw = Math.max(rm.name.length * 8, 64) / k, lh = 34 / k;
    const boxes = store.p.items.filter((i) => i.layer !== 'floor' && !isStruct(i)).map(itemBox);
    const free = (x, y) => {
      const r = { x1: x - lw / 2, y1: y - lh / 2, x2: x + lw / 2, y2: y + lh / 2 };
      if (![[r.x1, r.y1], [r.x2, r.y1], [r.x2, r.y2], [r.x1, r.y2]].every(([px, py]) => pointInPoly(px, py, rm.points))) return false;
      return !boxes.some((q) => boxesIntersect(q, r));
    };
    if (free(c[0], c[1])) return c;
    let best = null;
    const N = 9;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = b.x1 + ((b.x2 - b.x1) * i) / N, y = b.y1 + ((b.y2 - b.y1) * j) / N;
      if (!free(x, y)) continue;
      const d = Math.hypot(x - c[0], y - c[1]);
      if (!best || d < best.d) best = { x, y, d };
    }
    return best ? [best.x, best.y] : c;
  }

  openingSVG(rm, o, sel, k) {
    const sg = openingSeg(rm, o); if (!sg) return '';
    const { e, s, t } = sg;
    const T = rm.wallT;
    const no = [-e.nIn[0], -e.nIn[1]];
    const P = (q) => `${f1(q[0])},${f1(q[1])}`;
    const add = (q, v, m) => [q[0] + v[0] * m, q[1] + v[1] * m];
    const gap = [add(s, e.nIn, 0.6), add(t, e.nIn, 0.6), add(add(t, no, T + 0.6), [0, 0], 0), add(s, no, T + 0.6)];
    const isSel = sel?.kind === 'opening' && sel.id === o.id;
    let g = `<g class="opening${isSel ? ' sel' : ''}" data-hit="open" data-room="${rm.id}" data-id="${o.id}">`;
    if (rm.noWalls) return '';
    g += `<polygon class="gap" points="${gap.map(P).join(' ')}"/>`;
    const midIn = (q) => add(q, no, T / 2);
    if (o.type === 'cut') {
      if (o.sill > 0) g += `<polygon class="lowwall" points="${[s, t, add(t, no, T), add(s, no, T)].map(P).join(' ')}"/>`;
      g += `<path class="op cutend" d="M${P(s)}L${P(add(s, no, T))}M${P(t)}L${P(add(t, no, T))}"/>`;
    } else if (o.type === 'garage') {
      g += `<path class="op leaf" d="M${P(midIn(s))}L${P(midIn(t))}"/>`;
      g += `<path class="op" d="M${P(s)}L${P(add(s, no, T))}M${P(t)}L${P(add(t, no, T))}"/>`;
      g += `<path class="op arc" d="M${P(s)}L${P(add(s, e.nIn, Math.min(80, o.height * 0.35)))}L${P(add(t, e.nIn, Math.min(80, o.height * 0.35)))}L${P(t)}"/>`;
    } else if (o.type === 'window') {
      for (const f of [0.3, 0.7]) g += `<line class="op" x1="${f1(add(s, no, T * f)[0])}" y1="${f1(add(s, no, T * f)[1])}" x2="${f1(add(t, no, T * f)[0])}" y2="${f1(add(t, no, T * f)[1])}"/>`;
      g += `<line class="op glass" x1="${f1(midIn(s)[0])}" y1="${f1(midIn(s)[1])}" x2="${f1(midIn(t)[0])}" y2="${f1(midIn(t)[1])}"/>`;
      g += `<path class="op" d="M${P(s)}L${P(add(s, no, T))}M${P(t)}L${P(add(t, no, T))}"/>`;
    } else if (o.type === 'slide') {
      const half = o.width / 2 + 4;
      const a1 = add(s, no, T * 0.35), a2 = add(add(s, e.dir, half), no, T * 0.35);
      const b1 = add(add(t, e.dir, -half), no, T * 0.65), b2 = add(t, no, T * 0.65);
      g += `<path class="op leaf" d="M${P(a1)}L${P(a2)}M${P(b1)}L${P(b2)}"/>`;
      g += `<path class="op" d="M${P(s)}L${P(add(s, no, T))}M${P(t)}L${P(add(t, no, T))}"/>`;
    } else if (o.type === 'pass') {
      g += `<path class="op arc" d="M${P(s)}L${P(t)}M${P(add(s, no, T))}L${P(add(t, no, T))}"/>`;
    } else {
      const leaves = o.type === 'door2' ? [[s, t, o.width / 2], [t, s, o.width / 2]] : (o.hinge === 'end' ? [[t, s, o.width]] : [[s, t, o.width]]);
      const out = o.swing === 'out';
      const nd = out ? no : e.nIn;
      for (const [h0, other0, len] of leaves) {
        const h = out ? add(h0, no, T) : h0;
        const oth = out ? add(other0, no, T) : other0;
        const dirToOther = [(oth[0] - h[0]) / o.width, (oth[1] - h[1]) / o.width];
        const jamb = add(h, dirToOther, len);
        const leafEnd = add(h, nd, len);
        const v1 = [leafEnd[0] - h[0], leafEnd[1] - h[1]], v2 = [jamb[0] - h[0], jamb[1] - h[1]];
        const sweep = v1[0] * v2[1] - v1[1] * v2[0] > 0 ? 1 : 0;
        g += `<path class="op leaf" d="M${P(h)}L${P(leafEnd)}"/>`;
        g += `<path class="op arc" d="M${P(leafEnd)}A${f1(len)},${f1(len)} 0 0 ${sweep} ${P(jamb)}"/>`;
      }
    }
    const pad = Math.max(6, 10 / k);
    const hitPoly = [add(s, e.nIn, pad), add(t, e.nIn, pad), add(t, no, T + pad), add(s, no, T + pad)];
    g += `<polygon class="ophit" points="${hitPoly.map(P).join(' ')}"/>`;
    return g + '</g>';
  }

  itemSVG(it, k, exporting) {
    const S = store.p.settings;
    const a = this.analysis;
    const cls = ['item', it.layer === 'wall' ? 'wallitem' : '', isMezz(it) ? 'mezz' : '', it.sym === 'stair' ? 'stair' : '', it.lvl ? 'up' : '', it.layer === 'floor' ? 'floor' : '', it.status === 'comprar' ? 'buy' : '', it.status === 'sai' ? 'out' : '', !exporting && a.bad.has(it.id) ? 'bad' : '', !exporting && this.isGhost(it) ? 'ghost' : ''].join(' ');
    let s = `<g class="${cls}" data-hit="item" data-id="${it.id}" transform="translate(${f1(it.x)} ${f1(it.y)}) rotate(${f1(it.rot || 0)})" style="--c:${esc(it.color)}">`;
    s += bodyShape(it) + symbolDetails(it);
    if (isMezz(it)) for (const r of mezzRails(store.p, it)) s += `<line class="rail" x1="${f1(r.a[0])}" y1="${f1(r.a[1])}" x2="${f1(r.b[0])}" y2="${f1(r.b[1])}"/>`;
    if (!exporting && a.bad.has(it.id)) s += bodyShape(it, 'hatch');
    if (S.showLabels) {
      const name = it.name || '';
      const second = isMezz(it) ? `piso a ${fmtLen(it.h, 'm')}` : it.sym === 'stair' ? `sobe ${fmtLen(it.h, 'm')} · ${stairInfo(it).n} degraus`
        : it.sym === 'person' ? fmtLen(it.h, 'm')
        : it.sym === 'wallseg' ? (it.h2 !== undefined && Math.abs(it.h2 - it.h) >= 1 ? `${fmtLen(it.h, 'm')} → ${fmtLen(it.h2, 'm')}` : `altura ${fmtLen(it.h, 'm')}`)
        : S.showItemDims ? `${Math.round(it.w)}×${Math.round(it.d)}` : '';
      const along = it.d > it.w * 1.5 && it.w * k < 70;
      const len = along ? it.d : it.w, thick = along ? it.w : it.d;
      let fs = 11.5 / k;
      fs = Math.min(fs, (len * 0.9) / (Math.max(4, name.length) * 0.58), thick * 0.42);
      if (fs * k >= 6.5) {
        let ang = (it.rot || 0) + (along ? 90 : 0);
        const flip = normAng(ang) > 90 && normAng(ang) <= 270;
        const tr = `rotate(${(along ? 90 : 0) + (flip ? 180 : 0)})`;
        const dy = second && fs * 2.3 < thick ? fs * 0.55 : 0;
        s += `<text class="lbl" transform="${tr}" y="${f1(-dy)}" style="font-size:${f1(fs)}px;stroke-width:${f1(fs * 0.28)}px">${esc(name)}</text>`;
        if (dy) s += `<text class="lbl lbl2" transform="${tr}" y="${f1(dy * 1.1)}" style="font-size:${f1(fs * 0.85)}px;stroke-width:${f1(fs * 0.25)}px">${second}</text>`;
      }
    }
    return s + '</g>';
  }

  measureSVG(m, k, isSel) {
    const dx = m.b[0] - m.a[0], dy = m.b[1] - m.a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, tk = 6 / k;
    const mx = (m.a[0] + m.b[0]) / 2, my = (m.a[1] + m.b[1]) / 2;
    let ang = deg(Math.atan2(dy, dx)); if (ang > 90 || ang <= -90) ang += 180;
    const lx = mx + nx * 10 / k, ly = my + ny * 10 / k;
    return `<g class="meas${isSel ? ' sel' : ''}" data-hit="meas" data-id="${m.id}">
      <line class="hit" x1="${f1(m.a[0])}" y1="${f1(m.a[1])}" x2="${f1(m.b[0])}" y2="${f1(m.b[1])}"/>
      <line x1="${f1(m.a[0])}" y1="${f1(m.a[1])}" x2="${f1(m.b[0])}" y2="${f1(m.b[1])}"/>
      <line x1="${f1(m.a[0] - nx * tk)}" y1="${f1(m.a[1] - ny * tk)}" x2="${f1(m.a[0] + nx * tk)}" y2="${f1(m.a[1] + ny * tk)}"/>
      <line x1="${f1(m.b[0] - nx * tk)}" y1="${f1(m.b[1] - ny * tk)}" x2="${f1(m.b[0] + nx * tk)}" y2="${f1(m.b[1] + ny * tk)}"/>
      <text x="${f1(lx)}" y="${f1(ly)}" transform="rotate(${f1(ang)} ${f1(lx)} ${f1(ly)})" style="font-size:${f1(12 / k)}px;stroke-width:${f1(4 / k)}px">${fmtLen(len, 'cm')}</text></g>`;
  }

  overlaySVG(p, k) {
    const out = [];
    const sel = store.sel;
    const hs = (this.coarse ? 11 : 6.5) / k;
    if (sel?.kind === 'items') {
      const its = store.selItems();
      for (const it of its) {
        const c = itemCorners(it);
        out.push(`<polygon class="selbox${its.length > 1 ? ' multi' : ''}" points="${c.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' ')}"/>`);
      }
      if (its.length === 1 && !its[0].locked && !this.op?.moved) {
        const it = its[0];
        const hw = it.w / 2, hd = it.d / 2;
        const rotOff = hd + (this.coarse ? 34 : 26) / k;
        const loc = (x, y) => { const [rx, ry] = rotPt(x, y, it.rot); return [it.x + rx, it.y + ry]; };
        const top = loc(0, -hd), rh = loc(0, -rotOff);
        out.push(`<line class="rotline" x1="${f1(top[0])}" y1="${f1(top[1])}" x2="${f1(rh[0])}" y2="${f1(rh[1])}"/>`);
        out.push(`<circle class="handle rot" data-hit="rot" cx="${f1(rh[0])}" cy="${f1(rh[1])}" r="${f1(hs * 1.05)}"/>`);
        const handles = { nw: [-hw, -hd], ne: [hw, -hd], se: [hw, hd], sw: [-hw, hd], n: [0, -hd], s: [0, hd], e: [hw, 0], w: [-hw, 0] };
        const small = it.w * k < 50 || it.d * k < 50;
        for (const [h, [x, y]] of Object.entries(handles)) {
          if (small && h.length === 1) continue;
          if (h === 'n' && (it.d * k < 90)) continue;
          const q = loc(x, y);
          out.push(`<rect class="handle" data-hit="rs" data-h="${h}" x="${f1(q[0] - hs * 0.8)}" y="${f1(q[1] - hs * 0.8)}" width="${f1(hs * 1.6)}" height="${f1(hs * 1.6)}" rx="${f1(hs * 0.3)}" transform="rotate(${f1(it.rot)} ${f1(q[0])} ${f1(q[1])})"/>`);
        }
      }
      const dragging = this.op?.moved && this.op.type !== 'item';
      if (its.length && this.S.showDist && !dragging && its.every((i) => i.layer !== 'floor')) {
        const box = its.reduce((b, i) => unionBox(b, itemBox(i)), null);
        const layer = its.every((i) => i.layer === 'wall') ? 'wall' : 'normal';
        out.push(this.distSVG(this.gapsFor(box, its.map((i) => i.id), layer), k));
      }
    }
    if (sel?.kind === 'room') {
      const rm = store.room(sel.id);
      if (rm && !rm.locked) {
        for (const e of edgesOf(rm.points)) {
          const mx = (e.a[0] + e.b[0]) / 2 - e.nIn[0] * rm.wallT / 2, my = (e.a[1] + e.b[1]) / 2 - e.nIn[1] * rm.wallT / 2;
          const w2 = Math.max(hs * 2.4, Math.min(e.len * 0.3, 40 / k));
          const ang = deg(Math.atan2(e.dir[1], e.dir[0]));
          out.push(`<rect class="handle" data-hit="redge" data-id="${rm.id}" data-i="${e.i}" x="${f1(mx - w2 / 2)}" y="${f1(my - hs * 0.75)}" width="${f1(w2)}" height="${f1(hs * 1.5)}" rx="${f1(hs * 0.6)}" transform="rotate(${f1(ang)} ${f1(mx)} ${f1(my)})"/>`);
        }
        rm.points.forEach((q, i) => out.push(`<circle class="handle" data-hit="rvert" data-id="${rm.id}" data-i="${i}" cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(hs * 0.85)}"/>`));
      }
    }
    for (const g of this.guides) {
      if (g.x !== undefined) out.push(`<line class="guide" x1="${f1(g.x)}" y1="${f1(g.y1)}" x2="${f1(g.x)}" y2="${f1(g.y2)}"/>`);
      else out.push(`<line class="guide" x1="${f1(g.x1)}" y1="${f1(g.y)}" x2="${f1(g.x2)}" y2="${f1(g.y)}"/>`);
    }
    if (this.boxSel) { const b = this.boxSel; out.push(`<rect class="boxsel" x="${f1(b.x1)}" y="${f1(b.y1)}" width="${f1(b.x2 - b.x1)}" height="${f1(b.y2 - b.y1)}"/>`); }
    if (this.draft) out.push(this.measureSVG(this.draft, k, true));
    return out.join('');
  }

  distSVG(gaps, k) {
    let s = '';
    for (const [dir, g] of Object.entries(gaps)) {
      if (g.gap < 0.5 || g.gap * k < 18) continue;
      const [x1, y1] = g.from, [x2, y2] = g.to;
      s += `<line class="dist" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`;
      const tk = 4 / k;
      if (y1 === y2) s += `<path class="dist" d="M${f1(x2)},${f1(y2 - tk)}V${f1(y2 + tk)}"/>`; else s += `<path class="dist" d="M${f1(x2 - tk)},${f1(y2)}H${f1(x2 + tk)}"/>`;
      const txt = fmtLen(g.gap, 'cm');
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const tw = (txt.length * 6.4 + 10) / k, th = 17 / k;
      s += `<g class="distlbl" data-hit="dist" data-dir="${dir}" data-gap="${f1(g.gap)}"><rect x="${f1(mx - tw / 2)}" y="${f1(my - th / 2)}" width="${f1(tw)}" height="${f1(th)}" rx="${f1(th / 2)}"/><text x="${f1(mx)}" y="${f1(my)}" style="font-size:${f1(11 / k)}px">${txt}</text></g>`;
    }
    return s;
  }

  // ---------- exportar imagem ----------
  exportSVG(scalePxPerCm = 2) {
    const p = store.p;
    let box = null;
    for (const rm of p.rooms) box = unionBox(box, bbox(offsetPoly(rm.points, rm.wallT + 40)));
    for (const it of p.items) box = unionBox(box, itemBox(it));
    for (const m of p.measures) box = unionBox(box, bbox([m.a, m.b]));
    if (!box) box = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const pad = 30;
    box = { x1: box.x1 - pad, y1: box.y1 - pad, x2: box.x2 + pad, y2: box.y2 + pad };
    const w = box.x2 - box.x1, h = box.y2 - box.y1;
    const k = scalePxPerCm;
    const body = this.planBody(p, k, true);
    const title = `<text x="${f1(box.x1 + 10)}" y="${f1(box.y1 + 22 / k)}" style="font:600 ${f1(16 / k)}px system-ui,sans-serif;fill:#1f2328">${esc(p.name)}</text>`;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * k)}" height="${Math.round(h * k)}" viewBox="${f1(box.x1)} ${f1(box.y1)} ${f1(w)} ${f1(h)}" style="${LIGHT_VARS}"><defs><style>${SYM_CSS}${PLAN_CSS}</style>${FLOOR_PAT}</defs><rect x="${f1(box.x1)}" y="${f1(box.y1)}" width="${f1(w)}" height="${f1(h)}" fill="#ffffff"/>${title}${body}</svg>`, w: Math.round(w * k), h: Math.round(h * k) };
  }
}

// Miniatura simples do projeto (lista de projetos)
export function thumbSVG(p) {
  let box = null;
  for (const rm of p.rooms || []) box = unionBox(box, bbox(rm.points));
  for (const it of p.items || []) box = unionBox(box, itemBox(it));
  if (!box) return '';
  const pad = 30, w = box.x2 - box.x1 + pad * 2, h = box.y2 - box.y1 + pad * 2;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(box.x1 - pad)} ${f1(box.y1 - pad)} ${f1(w)} ${f1(h)}">`;
  for (const rm of p.rooms || []) s += `<polygon points="${rm.points.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(' ')}" fill="${esc(rm.floor)}" stroke="#3b4048" stroke-width="${Math.max(6, rm.wallT)}" stroke-linejoin="miter"/>`;
  for (const it of p.items || []) s += `<polygon points="${itemCorners(it).map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(' ')}" fill="${esc(it.color)}" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`;
  return s + '</svg>';
}

export { STATUS };
