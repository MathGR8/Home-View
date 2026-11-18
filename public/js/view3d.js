// Visualização 3D (Three.js). 1 unidade = 1 metro. Planta (x, y) -> 3D (x, 0, y).
import * as T from '../vendor/three.bundle.js';
import { edgesOf, isConvex, rad, clamp } from './geometry.js';
import { openingSeg } from './state.js';
import { isMezz, isStair, stairInfo, mezzRails, mezzUnder, floorAt } from './struct.js';
import { mezzCols } from './symbols.js';

const M = 0.01;
const EYE = 160; // altura dos olhos (cm)
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'c', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown']);
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || document.querySelector('dialog[open]');

export class View3D {
  constructor(el) {
    this.el = el;
    this.wallMode = 'low'; // full | low | none
    this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#eef1f4');
    this.camera = new T.PerspectiveCamera(50, 1, 0.05, 400);
    this.controls = new T.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.screenSpacePanning = true;
    this.scene.add(new T.HemisphereLight(0xffffff, 0x9a8f80, 1.6));
    const sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    this.sun = sun;
    this.scene.add(sun, sun.target);
    this.group = new T.Group();
    this.scene.add(this.group);
    this.mats = new Map();
    this.running = false;
    new ResizeObserver(() => this.resize()).observe(el);
    this.renderer.domElement.addEventListener('pointerdown', () => { this.interacted = true; });
    // navegação livre
    this.V3 = this.camera.position.constructor;
    this.camera.rotation.order = 'YXZ';
    this.mode = 'orbit'; // orbit | walk
    this.fly = false;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.vert = 0;
    this.yaw = 0; this.pitch = 0; this.feet = 0;
    this.anim = null;
    this.onFly = () => {};
    this.bindMove();
  }

  // ---------- andar / voar ----------
  bindMove() {
    window.addEventListener('keydown', (e) => {
      if (!this.running || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!MOVE_KEYS.has(k)) return;
      this.keys.add(k);
      if (k.startsWith('arrow') || k.startsWith('page') || k === ' ') e.preventDefault();
      if (this.mode === 'walk' && !this.fly && ['q', 'e', 'c', ' ', 'pageup', 'pagedown'].includes(k)) this.setFly(true);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); if (e.key === 'Shift') this.keys.delete('shift'); });
    window.addEventListener('blur', () => this.keys.clear());
    const cv = this.renderer.domElement;
    let look = null, tap = null, lastTap = null;
    cv.addEventListener('pointerdown', (e) => {
      tap = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (this.mode !== 'walk' || look) return;
      look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { cv.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!look || e.pointerId !== look.id) return;
      const k = e.pointerType === 'mouse' ? 0.004 : 0.006;
      this.yaw += (e.clientX - look.x) * k;
      this.pitch = clamp(this.pitch + (e.clientY - look.y) * k, -1.45, 1.45);
      look.x = e.clientX; look.y = e.clientY;
    });
    const up = (e) => {
      if (look && e.pointerId === look.id) look = null;
      if (!tap) return;
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y), now = performance.now();
      if (moved < 8 && now - tap.t < 350) {
        if (lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { this.goToScreen(e.clientX, e.clientY); lastTap = null; }
        else lastTap = { x: e.clientX, y: e.clientY, t: now };
      }
      tap = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { look = null; tap = null; });
    cv.addEventListener('wheel', (e) => {
      if (this.mode !== 'walk') return;
      e.preventDefault();
      const f = this.fwd();
      const d = clamp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002), -0.6, 0.6);
      this.camera.position.x += f[0] * d; this.camera.position.z += f[1] * d;
      if (this.fly) this.camera.position.y = Math.max(0.2, this.camera.position.y + Math.sin(this.pitch) * d);
    }, { passive: false });

    // controle na tela (celular) + subir/descer
    const joy = document.createElement('div');
    joy.className = 'joy'; joy.hidden = true;
    joy.innerHTML = '<i></i>';
    joy.title = 'Arraste para andar';
    const knob = joy.firstChild;
    let jid = null;
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect(), R = r.width / 2;
      let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
      const l = Math.hypot(dx, dy), max = R * 0.62;
      if (l > max) { dx *= max / l; dy *= max / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy = { x: dx / max, y: -dy / max };
    };
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(e.pointerId); setJoy(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
    const jend = (e) => { if (e.pointerId !== jid) return; jid = null; this.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
    joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    const vb = document.createElement('div');
    vb.className = 'vbtns'; vb.hidden = true;
    vb.innerHTML = '<button data-v="1" aria-label="Subir" title="Subir (E)">▲</button><button data-v="-1" aria-label="Descer" title="Descer (Q)">▼</button>';
    vb.addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (!b) return; this.vert = +b.dataset.v; b.setPointerCapture(e.pointerId); e.preventDefault(); });
    for (const ev of ['pointerup', 'pointercancel']) vb.addEventListener(ev, () => { this.vert = 0; });
    const hint = document.createElement('div');
    hint.className = 'v3-hint'; hint.hidden = true;
    this.el.append(joy, vb, hint);
    this.ui = { joy, vb, hint };
  }

  fwd() { return [-Math.sin(this.yaw), -Math.cos(this.yaw)]; }

  setFly(on) {
    this.fly = on;
    if (!on && this.mode === 'walk') this.feet = floorAt(this.p, this.camera.position.x / M, this.camera.position.z / M, Math.max(0, this.camera.position.y / M - EYE) + 30);
    this.ui.vb.hidden = !(on && this.mode === 'walk');
    this.onFly(on);
  }

  showHint(txt) {
    const h = this.ui.hint;
    h.textContent = txt; h.hidden = false; h.classList.remove('fade');
    clearTimeout(this.hintT);
    this.hintT = setTimeout(() => h.classList.add('fade'), 6000);
  }

  // Ponto do chão (térreo ou mezanino) embaixo do cursor
  pickFloor(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new this.V3(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, dir = v.sub(o).normalize();
    if (Math.abs(dir.y) < 1e-4) return null;
    const planes = [0, ...new Set((this.p?.items || []).filter(isMezz).map((m) => m.h * M))];
    let best = null;
    for (const y of planes) {
      const t = (y - o.y) / dir.y;
      if (t <= 0.05 || t > 300) continue;
      const x = o.x + dir.x * t, z = o.z + dir.z * t;
      if (y > 0 && Math.abs(mezzUnder(this.p, x / M, z / M) * M - y) > 0.001) continue;
      if (!best || t < best.t) best = { t, x, y, z };
    }
    return best;
  }

  goToScreen(cx, cy) {
    const hit = this.pickFloor(cx, cy);
    if (!hit) return;
    const c = this.camera.position;
    if (this.mode === 'walk') {
      const ty = this.fly ? c.y + (hit.y - (c.y - EYE * M)) : hit.y + EYE * M;
      this.anim = { t: 0, from: [c.x, c.y, c.z], to: [hit.x, ty, hit.z], feet: hit.y / M };
    } else {
      const tg = this.controls.target;
      const dx = hit.x - tg.x, dy = hit.y - tg.y, dz = hit.z - tg.z;
      this.anim = { t: 0, from: [c.x, c.y, c.z, tg.x, tg.y, tg.z], to: [c.x + dx, c.y + dy, c.z + dz, hit.x, hit.y, hit.z] };
    }
  }

  move(dt) {
    const c = this.camera.position, K = this.keys;
    if (this.anim) {
      const a = this.anim; a.t = Math.min(1, a.t + dt / 0.45);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - (-2 * a.t + 2) ** 2 / 2;
      const v = a.from.map((f, i) => f + (a.to[i] - f) * e);
      c.set(v[0], v[1], v[2]);
      if (v.length > 3) this.controls.target.set(v[3], v[4], v[5]);
      if (a.t >= 1) { if (a.feet !== undefined) this.feet = a.feet; this.anim = null; }
      return;
    }
    const has = (...ks) => ks.some((k) => K.has(k));
    const f = clamp((has('w', 'arrowup') ? 1 : 0) - (has('s', 'arrowdown') ? 1 : 0) + this.joy.y, -1, 1);
    const r = clamp((has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0) + this.joy.x, -1, 1);
    const u = clamp((has('e', ' ', 'pageup') ? 1 : 0) - (has('q', 'c', 'pagedown') ? 1 : 0) + this.vert, -1, 1);
    const fast = K.has('shift');
    if (this.mode === 'walk') {
      const sp = (fast ? 3.4 : 1.5) * dt;
      const [fx, fz] = this.fwd();
      c.x += (fx * f + -fz * r) * sp; c.z += (fz * f + fx * r) * sp;
      if (this.fly) c.y = Math.max(0.2, c.y + u * sp);
      else {
        const tgt = floorAt(this.p, c.x / M, c.z / M, this.feet);
        this.feet += (tgt - this.feet) * Math.min(1, dt * (tgt > this.feet ? 14 : 9));
        c.y = (this.feet + EYE) * M;
      }
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      return;
    }
    if (!f && !r && !u) return;
    const tg = this.controls.target;
    let dx = tg.x - c.x, dz = tg.z - c.z;
    const dist = Math.hypot(dx, dz, tg.y - c.y);
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const sp = Math.max(1.2, dist * 0.7) * (fast ? 2.5 : 1) * dt;
    const mx = (dx * f + -dz * r) * sp, mz = (dz * f + dx * r) * sp, my = u * sp;
    c.x += mx; c.y += my; c.z += mz; tg.x += mx; tg.y += my; tg.z += mz;
  }

  mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!this.mats.has(key)) this.mats.set(key, new T.MeshStandardMaterial({ color: new T.Color(color), roughness: 0.85, metalness: 0.02, ...opts }));
    return this.mats.get(key);
  }

  resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.renderer.domElement.style.width = r.width + 'px';
    this.renderer.domElement.style.height = r.height + 'px';
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    let last = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      this.move(dt);
      if (this.mode === 'orbit') this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
  stop() { this.running = false; this.keys.clear(); }

  clear() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.group.clear();
  }

  box(w, h, d, color, x, y, z, parent, opts) {
    const m = new T.Mesh(new T.BoxGeometry(Math.max(0.001, w), Math.max(0.001, h), Math.max(0.001, d)), this.mat(color, opts));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  cyl(rt, rb, h, color, x, y, z, parent, seg = 28) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), this.mat(color));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }

  build(p, keepCamera = true) {
    this.clear();
    this.p = p;
    const all = [];
    // pisos
    for (const r of p.rooms) {
      const sh = new T.Shape(r.points.map(([x, y]) => new T.Vector2(x * M, y * M)));
      const g = new T.ShapeGeometry(sh);
      g.rotateX(Math.PI / 2);
      const floor = new T.Mesh(g, this.mat(r.floor, { side: T.DoubleSide }));
      floor.position.y = 0.002; floor.receiveShadow = true;
      this.group.add(floor);
      all.push(...r.points);
    }
    // aberturas de todos os cômodos (para furar paredes encostadas)
    const ops = [];
    for (const r of p.rooms) for (const o of r.openings) { const sg = openingSeg(r, o); if (sg) ops.push({ o, s: sg.s, t: sg.t, T: r.wallT }); }
    for (const r of p.rooms) this.buildWalls(r, ops);
    for (const it of p.items) this.buildItem(it, p);
    for (const it of p.items) all.push([it.x, it.y]);
    // chão externo
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), this.mat('#dfe3e6'));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);
    if (!all.length) all.push([0, 0], [400, 300]);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const [x, y] of all) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    const cx = ((x1 + x2) / 2) * M, cz = ((y1 + y2) / 2) * M, size = Math.max(x2 - x1, y2 - y1) * M;
    this.sun.position.set(cx + size * 0.6, size * 1.3 + 4, cz + size * 0.4);
    this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera; sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.far = size * 4 + 30; sc.updateProjectionMatrix();
    this.bounds = { cx, cz, size };
    if (!keepCamera || !this.placed) { this.view('iso'); this.placed = true; }
  }

  view(kind) {
    const { cx, cz, size } = this.bounds || { cx: 0, cz: 0, size: 6 };
    const dist = Math.max(4, size * 1.25);
    this.anim = null;
    const walk = kind === 'walk';
    this.onMode?.(kind);
    this.mode = walk ? 'walk' : 'orbit';
    this.controls.enabled = !walk;
    this.camera.fov = walk ? 70 : 50; this.camera.updateProjectionMatrix();
    this.ui.joy.hidden = !walk;
    this.ui.vb.hidden = !(walk && this.fly);
    if (walk) {
      const x = cx, z = cz + size * 0.45;
      this.yaw = 0; this.pitch = -0.08;
      this.feet = this.fly ? 0 : floorAt(this.p || { items: [] }, x / M, z / M, 0);
      this.camera.position.set(x, (this.feet + EYE) * M, z);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      const touch = matchMedia('(pointer: coarse)').matches;
      this.showHint(touch ? 'Arraste a tela para olhar · use o controle redondo para andar · toque duas vezes num ponto do chão para ir até lá' : 'Arraste para olhar · W A S D ou setas para andar (Shift = correr) · Q/E descer/subir · clique duas vezes no chão para ir até lá');
      return;
    }
    this.ui.hint.hidden = true;
    if (kind === 'top') this.camera.position.set(cx, dist * 1.3, cz + 0.01);
    else if (kind === 'walk') this.camera.position.set(cx, 1.6, cz + size * 0.45);
    else this.camera.position.set(cx + dist * 0.55, dist * 0.8, cz + dist * 0.85);
    this.controls.target.set(cx, kind === 'walk' ? 1.2 : 0, cz);
    this.controls.update();
  }

  buildWalls(r, ops) {
    const H = this.wallMode === 'full' ? r.height : this.wallMode === 'low' ? Math.min(100, r.height) : 0;
    if (!H) return;
    const t = r.wallT;
    const E = edgesOf(r.points);
    const n = r.points.length;
    for (const e of E) {
      const ext0 = isConvex(r.points, e.i) ? t : 0;
      const ext1 = isConvex(r.points, (e.i + 1) % n) ? t : 0;
      // aberturas ao longo desta parede (deste cômodo ou de outro encostado)
      const cuts = [];
      for (const q of ops) {
        const along = (pt) => (pt[0] - e.a[0]) * e.dir[0] + (pt[1] - e.a[1]) * e.dir[1];
        const perp = (pt) => -((pt[0] - e.a[0]) * e.nIn[0] + (pt[1] - e.a[1]) * e.nIn[1]);
        const ds = perp(q.s), dt = perp(q.t);
        if (Math.abs(ds - dt) > 1) continue; // não paralela
        if (ds < -q.T - 1 || ds > t + q.T + 1) continue; // longe
        let a = along(q.s), b = along(q.t); if (a > b) [a, b] = [b, a];
        if (b < -ext0 || a > e.len + ext1) continue;
        cuts.push({ a, b, o: q.o });
      }
      cuts.sort((p, q) => p.a - q.a);
      const segs = [];
      let pos = -ext0;
      for (const c of cuts) {
        if (c.a > pos) segs.push({ a: pos, b: c.a, y0: 0, y1: H });
        const top = c.o.type === 'window' ? c.o.sill + c.o.height : c.o.height;
        const bottom = c.o.type === 'window' ? c.o.sill : 0;
        if (bottom > 0) segs.push({ a: Math.max(pos, c.a), b: c.b, y0: 0, y1: Math.min(bottom, H) });
        if (top < H) segs.push({ a: Math.max(pos, c.a), b: c.b, y0: top, y1: H });
        if (c.o.type === 'window' && bottom < H) segs.push({ a: c.a, b: c.b, y0: bottom, y1: Math.min(top, H), glass: true });
        pos = Math.max(pos, c.b);
      }
      if (pos < e.len + ext1) segs.push({ a: pos, b: e.len + ext1, y0: 0, y1: H });
      for (const s of segs) {
        const L = s.b - s.a, h = s.y1 - s.y0;
        if (L <= 0.1 || h <= 0.1) continue;
        const mid = (s.a + s.b) / 2;
        const cx = e.a[0] + e.dir[0] * mid - e.nIn[0] * (t / 2);
        const cz = e.a[1] + e.dir[1] * mid - e.nIn[1] * (t / 2);
        const m = this.box(L * M, h * M, (s.glass ? 1.5 : t) * M, s.glass ? '#9fc9e8' : '#f4f2ee', cx * M, ((s.y0 + s.y1) / 2) * M, cz * M, this.group, s.glass ? { transparent: true, opacity: 0.35, roughness: 0.1 } : undefined);
        m.rotation.y = -Math.atan2(e.dir[1], e.dir[0]);
        if (s.glass) m.castShadow = false;
      }
    }
  }

  buildItem(it, p) {
    const g = new T.Group();
    const w = it.w * M, d = it.d * M, h = Math.max(0.01, it.h * M);
    const c = it.color;
    const dark = shade(c, -0.18), light = shade(c, 0.22);
    // em cima do mezanino: sobe junto com o piso dele
    const base = (it.lvl ? mezzUnder(p, it.x, it.y) * M : 0) + (it.layer === 'wall' ? (it.elev || 0) * M : 0);
    const B = (bw, bh, bd, col, x, y, z) => this.box(bw, bh, bd, col, x, base + y, z, g);
    if (isMezz(it)) this.buildMezz(it, g, p);
    else if (isStair(it)) this.buildStair(it, g);
    else switch (it.sym) {
      case 'bed': case 'crib': {
        const mh = Math.min(h, 0.55);
        B(w, mh * 0.55, d, dark, 0, mh * 0.275, 0);
        B(w * 0.98, mh * 0.45, d * 0.96, '#f2efe9', 0, mh * 0.55 + mh * 0.225, d * 0.02);
        B(w, Math.max(h, 0.95), 0.06, dark, 0, Math.max(h, 0.95) / 2, -d / 2 + 0.03);
        B(w * 0.98, 0.04, d * 0.62, c, 0, mh + 0.02, d * 0.17);
        const np = it.w >= 120 ? 2 : 1;
        for (let i = 0; i < np; i++) B(w / np - 0.08, 0.1, 0.32, '#ffffff', -w / 2 + (w / np) * (i + 0.5), mh + 0.05, -d / 2 + 0.26);
        break;
      }
      case 'sofa': case 'armchair': case 'sofaL': {
        const sh = Math.min(0.45, h * 0.5), bd = Math.min(0.24, d * 0.25), aw = Math.min(0.2, w * 0.1);
        if (it.sym === 'sofaL') {
          const cw = Math.min(1, Math.max(0.6, w * 0.36)), sd = Math.min(1, Math.max(0.6, d * 0.6));
          B(w, sh, sd, c, 0, sh / 2, -d / 2 + sd / 2);
          B(cw, sh, d - sd, c, w / 2 - cw / 2, sh / 2, -d / 2 + sd + (d - sd) / 2);
          B(w, h, bd, dark, 0, h / 2, -d / 2 + bd / 2);
          B(bd, h, d, dark, w / 2 - bd / 2, h / 2, 0);
          B(aw, h * 0.7, sd, dark, -w / 2 + aw / 2, h * 0.35, -d / 2 + sd / 2);
        } else {
          B(w, sh, d, c, 0, sh / 2, 0);
          B(w, h, bd, dark, 0, h / 2, -d / 2 + bd / 2);
          B(aw, h * 0.72, d, dark, -w / 2 + aw / 2, h * 0.36, 0);
          B(aw, h * 0.72, d, dark, w / 2 - aw / 2, h * 0.36, 0);
          B(w - aw * 2 - 0.02, 0.1, d - bd - 0.04, light, 0, sh + 0.05, bd / 2);
        }
        break;
      }
      case 'table': case 'desk': case 'deskL': case 'roundtable': case 'stool': {
        const top = 0.035, legH = h - top;
        if (it.shape === 'round') {
          const top3 = this.cyl(w / 2, w / 2, top, c, 0, base + h - top / 2, 0, g); top3.scale.z = d / w;
          this.cyl(0.04, 0.06, legH, dark, 0, base + legH / 2, 0, g, 12);
          this.cyl(Math.min(w, d) * 0.25, Math.min(w, d) * 0.28, 0.03, dark, 0, base + 0.015, 0, g);
        } else {
          if (it.sym === 'deskL') {
            const cw = Math.min(0.8, Math.max(0.4, w * 0.4)), sd = Math.min(0.8, Math.max(0.4, d * 0.4));
            B(w, top, sd, c, 0, h - top / 2, -d / 2 + sd / 2);
            B(cw, top, d - sd, c, w / 2 - cw / 2, h - top / 2, -d / 2 + sd + (d - sd) / 2);
          } else B(w, top, d, c, 0, h - top / 2, 0);
          const lw = 0.045;
          for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B(lw, legH, lw, dark, sx * (w / 2 - lw), legH / 2, sz * (d / 2 - lw));
        }
        break;
      }
      case 'chair': case 'officechair': {
        const sh = 0.46;
        if (it.sym === 'officechair') {
          this.cyl(w * 0.38, w * 0.38, 0.08, c, 0, base + sh, 0, g);
          this.cyl(0.03, 0.03, sh, '#555', 0, base + sh / 2, 0, g, 10);
          B(w * 0.7, h - sh, 0.06, c, 0, sh + (h - sh) / 2, -d * 0.38);
        } else {
          B(w, 0.05, d, c, 0, sh, 0);
          for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B(0.035, sh, 0.035, dark, sx * (w / 2 - 0.03), sh / 2, sz * (d / 2 - 0.03));
          B(w, h - sh, 0.04, dark, 0, sh + (h - sh) / 2, -d / 2 + 0.02);
        }
        break;
      }
      case 'rug': B(w, 0.012, d, c, 0, 0.006, 0); break;
      case 'tv': B(w, h, Math.max(0.03, d), '#1e2125', 0, h / 2, 0); B(w * 0.96, h * 0.92, 0.005, '#33404d', 0, h / 2, d / 2 + 0.003); break;
      case 'plant': {
        this.cyl(w * 0.25, w * 0.2, h * 0.3, '#a0694b', 0, base + h * 0.15, 0, g, 16);
        const s = new T.Mesh(new T.SphereGeometry(w * 0.5, 16, 12), this.mat(c));
        s.scale.set(1, (h * 0.75) / w, d / w); s.position.set(0, base + h * 0.3 + h * 0.35, 0); s.castShadow = true; g.add(s);
        break;
      }
      case 'lamp': {
        this.cyl(w * 0.3, w * 0.35, 0.03, '#444', 0, base + 0.015, 0, g);
        this.cyl(0.015, 0.015, h, '#444', 0, base + h / 2, 0, g, 8);
        this.cyl(w * 0.3, w * 0.5, 0.3, c, 0, base + h - 0.15, 0, g);
        break;
      }
      case 'fridge': case 'wardrobe': case 'cabinet': case 'counter': case 'drawers': case 'shelf': case 'washer': case 'stove': case 'sink': {
        B(w, h, d, c, 0, h / 2, 0);
        const front = d / 2 + 0.003;
        if (it.sym === 'stove' || it.sym === 'sink' || it.sym === 'counter') B(w + 0.01, 0.03, d + 0.01, it.sym === 'stove' ? '#2f3237' : '#d8d2c8', 0, h - 0.015, 0);
        if (it.sym === 'washer') { const r = Math.min(w, h) * 0.3; const door = this.cyl(r, r, 0.02, '#9fb3c4', 0, base + h * 0.45, front, g); door.rotation.x = Math.PI / 2; }
        else if (it.sym === 'shelf') { for (let y = h / 5; y < h; y += h / 5) B(w * 0.96, 0.02, d * 0.9, dark, 0, y, 0.01); }
        else if (it.sym === 'drawers') { for (let i = 1; i < 4; i++) B(w * 0.96, 0.006, 0.006, dark, 0, (h * i) / 4, front); }
        else { const nd = Math.max(1, Math.round(it.w / 50)); for (let i = 1; i < nd; i++) B(0.006, h * 0.94, 0.006, dark, -w / 2 + (w * i) / nd, h / 2, front); }
        break;
      }
      case 'toilet': {
        B(w * 0.9, 0.38, d * 0.25, c, 0, 0.6, -d / 2 + d * 0.125);
        const b2 = this.cyl(w / 2, w * 0.4, 0.4, c, 0, base + 0.2, d * 0.1, g); b2.scale.z = (d * 0.75) / w;
        break;
      }
      case 'basin': B(w, h, d, c, 0, h / 2, 0); { const b2 = this.cyl(w * 0.3, w * 0.22, 0.05, '#dfe6ea', 0, base + h + 0.02, 0.02, g); b2.scale.z = d / w; } break;
      case 'shower': B(w, 0.04, d, '#e8eef2', 0, 0.02, 0); B(0.01, h, d, '#a8cbe0', w / 2, h / 2, 0).material = this.mat('#a8cbe0', { transparent: true, opacity: 0.35 }); B(w, h, 0.01, '#a8cbe0', 0, h / 2, d / 2).material = this.mat('#a8cbe0', { transparent: true, opacity: 0.35 }); break;
      case 'bathtub': B(w, h, d, c, 0, h / 2, 0); B(w * 0.85, 0.02, d * 0.75, '#bcd7e8', 0, h - 0.04, 0); break;
      case 'box': B(w, h, d, c, 0, h / 2, 0); B(w + 0.004, 0.004, 0.06, '#d9c08f', 0, h + 0.001, 0); break;
      case 'bike': { const wr = Math.min(0.34, h * 0.35); for (const sx of [-1, 1]) { const wh = this.cyl(wr, wr, 0.03, '#222', sx * (w / 2 - wr), base + wr, 0, g, 24); wh.rotation.x = Math.PI / 2; } B(w * 0.6, 0.03, 0.03, c, 0, wr * 1.6, 0); B(0.03, 0.03, d, '#222', w / 2 - wr * 1.2, h, 0); break; }
      case 'pillar': B(w, h, d, c, 0, h / 2, 0); break;
      default:
        if (it.shape === 'round') { const m = this.cyl(w / 2, w / 2, h, c, 0, base + h / 2, 0, g); m.scale.z = d / w; }
        else B(w, h, d, c, 0, h / 2, 0);
    }
    if (it.status === 'sai') g.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; } });
    g.position.set(it.x * M, 0, it.y * M);
    g.rotation.y = -rad(it.rot || 0);
    this.group.add(g);
  }

  steel(color) { return { metalness: 0.45, roughness: 0.45 }; }

  // Mezanino metálico: piso, vigas, barrotes, pilares e guarda-corpo
  buildMezz(it, g, p) {
    const col = it.color, deck = it.deck || '#8b939c', so = this.steel(col);
    const w = it.w * M, d = it.d * M, H = Math.max(0.3, it.h * M), t = Math.max(0.02, (it.thick ?? 12) * M);
    const bh = Math.min(0.2, Math.max(0.05, H - t - 0.3)), yb = H - t - bh / 2, bt = 0.08;
    this.box(w, t, d, deck, 0, H - t / 2, 0, g, { roughness: 0.55, metalness: 0.3 });
    this.box(w, bh, bt, col, 0, yb, d / 2 - bt / 2, g, so);
    this.box(w, bh, bt, col, 0, yb, -d / 2 + bt / 2, g, so);
    this.box(bt, bh, d - 2 * bt, col, w / 2 - bt / 2, yb, 0, g, so);
    this.box(bt, bh, d - 2 * bt, col, -w / 2 + bt / 2, yb, 0, g, so);
    // barrotes a cada ~80 cm no vão menor
    const alongX = w < d; // barrote atravessa o lado menor
    const span = alongX ? d : w, nJ = Math.max(1, Math.round(span / 0.8));
    for (let i = 1; i < nJ; i++) {
      const v = -span / 2 + (span * i) / nJ;
      if (alongX) this.box(w - 2 * bt, bh * 0.75, 0.05, col, 0, H - t - bh * 0.375, v, g, so);
      else this.box(0.05, bh * 0.75, d - 2 * bt, col, v, H - t - bh * 0.375, 0, g, so);
    }
    // pilares com chapa de base
    const ch = H - t - bh;
    if (ch > 0.05) for (const [x, y] of mezzCols(it)) {
      this.box(0.1, ch, 0.1, col, x * M, ch / 2, y * M, g, so);
      this.box(0.2, 0.012, 0.2, col, x * M, 0.006, y * M, g, so);
    }
    // guarda-corpo (abre onde a escada chega)
    const rh = (it.railH ?? 110) * M;
    if (rh > 0.05) for (const r of mezzRails(p, it)) this.railLine(g, r.a, r.b, H, rh, col, so, true);
  }

  // Guarda-corpo reto entre dois pontos locais (cm), em cima da altura y0 (m)
  railLine(g, a, b, y0, rh, col, so, kick) {
    const ax = a[0] * M, az = a[1] * M, bx = b[0] * M, bz = b[1] * M;
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) return;
    const ang = -Math.atan2(bz - az, bx - ax);
    // puxa 3 cm para dentro (em direção ao centro)
    let nx = -(bz - az) / L, nz = (bx - ax) / L;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (nx * -mx + nz * -mz < 0) { nx = -nx; nz = -nz; }
    const cx = mx + nx * 0.03, cz = mz + nz * 0.03;
    const bar = (hh, th, y) => { const m = this.box(L, hh, th, col, cx, y, cz, g, so); m.rotation.y = ang; };
    bar(0.045, 0.05, y0 + rh);
    bar(0.025, 0.025, y0 + rh * 0.5);
    if (kick) bar(0.1, 0.008, y0 + 0.05);
    const np = Math.max(1, Math.ceil(L / 1.2));
    for (let i = 0; i <= np; i++) {
      const f = i / np;
      this.box(0.04, rh, 0.04, col, ax + (bx - ax) * f + nx * 0.03, y0 + rh / 2, az + (bz - az) * f + nz * 0.03, g, so);
    }
  }

  // Escada reta: duas longarinas inclinadas, degraus e corrimão
  buildStair(it, g) {
    const S = stairInfo(it), col = it.color, deck = it.deck || '#8b939c', so = this.steel(col);
    const w = it.w * M, d = Math.max(0.05, it.d * M), H = Math.max(0.05, it.h * M);
    const r = S.riser * M, tr = S.tread * M;
    const ang = Math.atan2(H, d), L = Math.hypot(H, d), sh = 0.2;
    for (const sx of [-1, 1]) {
      const m = this.box(0.02, sh, L, col, sx * (w / 2 - 0.01), H / 2 - 0.04, 0, g, so);
      m.rotation.x = ang;
    }
    for (let i = 0; i < S.n; i++) this.box(w - 0.04, 0.035, tr + 0.02, deck, 0, (i + 1) * r - 0.0175, d / 2 - (i + 0.5) * tr, g, { roughness: 0.55, metalness: 0.3 });
    const rh = (it.railH ?? 90) * M, rails = it.rails ?? 'we';
    if (rh > 0.05) for (const [k, sx] of [['w', -1], ['e', 1]]) {
      if (!rails.includes(k)) continue;
      const x = sx * (w / 2 - 0.01);
      const bar = this.box(0.045, 0.045, L, col, x, H / 2 + rh, 0, g, so); bar.rotation.x = ang;
      const np = Math.max(1, Math.ceil(L / 1.2));
      for (let j = 0; j <= np; j++) { const f = j / np; this.box(0.035, rh, 0.035, col, x, f * H + rh / 2, d / 2 - f * d, g, so); }
    }
  }

  snapshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }
}

function shade(hex, amt) {
  const c = new T.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}
