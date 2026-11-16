// Visualização 3D (Three.js). 1 unidade = 1 metro. Planta (x, y) -> 3D (x, 0, y).
import * as T from '../vendor/three.bundle.js';
import { edgesOf, isConvex, rad } from './geometry.js';
import { openingSeg } from './state.js';

const M = 0.01;

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
    const loop = () => {
      if (!this.running) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
  stop() { this.running = false; }

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
    for (const it of p.items) this.buildItem(it);
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

  buildItem(it) {
    const g = new T.Group();
    const w = it.w * M, d = it.d * M, h = Math.max(0.01, it.h * M);
    const c = it.color;
    const dark = shade(c, -0.18), light = shade(c, 0.22);
    const base = it.layer === 'wall' ? (it.elev || 0) * M : 0;
    const B = (bw, bh, bd, col, x, y, z) => this.box(bw, bh, bd, col, x, base + y, z, g);
    switch (it.sym) {
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

  snapshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }
}

function shade(hex, amt) {
  const c = new T.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}
