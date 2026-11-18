// Visualização 3D (Three.js). 1 unidade = 1 metro. Planta (x, y) -> 3D (x, 0, y).
import * as T from '../vendor/three.bundle.js';
import { edgesOf, isConvex, rad, clamp } from './geometry.js';
import { openingSeg, elevOf } from './state.js';
import { isMezz, isStair, isStruct, stairInfo, mezzRails, mezzUnder, floorAt, mezzCols, fenceBars, fencePosts, gateLines } from './struct.js';
import { LIGHT_SYMS } from './catalog.js';

const M = 0.01;
const EYE = 160; // altura dos olhos padrão (cm)
const MAX_LAMPS = 16; // luzes acesas de verdade no 3D (as outras só brilham)
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'c', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown']);
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || document.querySelector('dialog[open]');
// zona morta + curva suave: pequenos toques no controle não fazem a câmera "escorregar"
const curve = (v) => { const a = Math.abs(v); if (a < 0.12) return 0; const t = (a - 0.12) / 0.88; return Math.sign(v) * t * (0.35 + 0.65 * t); };
// Ajustes dos controles na tela (ficam neste aparelho)
const JOY_KEY = 'planta.controles';
const JOY_DEF = { l: { sens: 1, vis: 1, size: 1, pos: null }, r: { sens: 1, vis: 1, size: 1, pos: null }, invY: false };
function loadJoyCfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(JOY_KEY) || '{}') || {}; } catch { /* ignora */ }
  return { l: { ...JOY_DEF.l, ...(c.l || {}) }, r: { ...JOY_DEF.r, ...(c.r || {}) }, invY: !!c.invY };
}
const pct = (v) => Math.round(v * 100);
// tamanho (cm) que cada textura cobre antes de repetir
const TEX_SIZE = { grass: 100, concrete: 200, tiles: 120, deck: 112, gravel: 80, soil: 100, wood: 120, porcelain: 120, cement: 220 };

export class View3D {
  constructor(el) {
    this.el = el;
    this.wallMode = 'low'; // full | low | none
    this.night = false;
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
    this.hemi = new T.HemisphereLight(0xffffff, 0x9a8f80, 1.6);
    this.scene.add(this.hemi);
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
    this.texs = new Map();
    this.ray = new T.Raycaster();
    this.hl = [];
    this.selIds = new Set();
    this.running = false;
    new ResizeObserver(() => this.resize()).observe(el);
    this.renderer.domElement.addEventListener('pointerdown', () => { this.interacted = true; });
    // navegação livre
    this.V3 = this.camera.position.constructor;
    this.camera.rotation.order = 'YXZ';
    this.mode = 'orbit'; // orbit | walk
    this.fly = false;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };  // controle da esquerda: andar
    this.turn = { x: 0, y: 0 }; // controle da direita: girar / olhar
    this.vert = 0;
    this.yaw = 0; this.pitch = 0; this.feet = 0; this.eye = EYE;
    this.anim = null;
    this.joyCfg = loadJoyCfg();
    this.joyEdit = false;
    this.xray = false;
    this.onFly = () => {};
    this.onPick = () => {};
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
        else { lastTap = { x: e.clientX, y: e.clientY, t: now }; if (!this.joyEdit) { const c = this.pickCycle(e.clientX, e.clientY); this.onPick(c.hit, c.list, c.i); } }
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

    // dois controles na tela, como num jogo: esquerda anda, direita gira a câmera
    const makeJoy = (side, label, title, set) => {
      const joy = document.createElement('div');
      joy.className = 'joy ' + side; joy.hidden = true;
      joy.innerHTML = `<i></i><span>${label}</span>`;
      joy.title = title;
      const knob = joy.firstChild;
      let jid = null;
      const upd = (e) => {
        const r = joy.getBoundingClientRect(), R = r.width / 2;
        let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
        const l = Math.hypot(dx, dy), max = R * 0.62;
        if (l > max) { dx *= max / l; dy *= max / l; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        set(dx / max, -dy / max);
      };
      // modo "mover na tela": arrastar muda o lugar do controle
      let drag = null;
      const place = (e) => {
        const r = this.el.getBoundingClientRect(), half = joy.offsetWidth / 2;
        const x = clamp(e.clientX - drag.dx - r.left, half, r.width - half), y = clamp(e.clientY - drag.dy - r.top, half, r.height - half);
        this.joyCfg[side].pos = { x: x / r.width, y: y / r.height };
        this.applyJoyCfg();
      };
      joy.addEventListener('pointerdown', (e) => {
        jid = e.pointerId; joy.setPointerCapture(e.pointerId); e.preventDefault();
        if (this.joyEdit) { const b = joy.getBoundingClientRect(); drag = { dx: e.clientX - (b.left + b.width / 2), dy: e.clientY - (b.top + b.height / 2) }; joy.classList.add('drag'); return; }
        joy.classList.add('on'); upd(e);
      });
      joy.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; if (drag) place(e); else upd(e); });
      const end = (e) => {
        if (e.pointerId !== jid) return; jid = null;
        if (drag) { drag = null; joy.classList.remove('drag'); this.saveJoyCfg(); return; }
        set(0, 0); knob.style.transform = ''; joy.classList.remove('on');
      };
      joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
      return joy;
    };
    const joyL = makeJoy('l', 'andar', 'Arraste para andar (frente, trás e para os lados)', (x, y) => { this.joy = { x, y }; });
    const joyR = makeJoy('r', 'girar', 'Arraste para girar a câmera: direita = sentido horário, esquerda = anti-horário, cima/baixo = olhar', (x, y) => { this.turn = { x, y }; });
    const vb = document.createElement('div');
    vb.className = 'vbtns'; vb.hidden = true;
    vb.innerHTML = '<button data-v="1" aria-label="Subir" title="Subir (E)">▲</button><button data-v="-1" aria-label="Descer" title="Descer (Q)">▼</button>';
    vb.addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (!b) return; this.vert = +b.dataset.v; b.setPointerCapture(e.pointerId); e.preventDefault(); });
    for (const ev of ['pointerup', 'pointercancel']) vb.addEventListener(ev, () => { this.vert = 0; });
    const hint = document.createElement('div');
    hint.className = 'v3-hint'; hint.hidden = true;
    const cfg = document.createElement('div');
    cfg.className = 'joy-cfg'; cfg.hidden = true;
    this.el.append(joyL, joyR, vb, hint, cfg);
    this.ui = { joy: joyL, joyR, vb, hint, cfg };
    this.bindJoyCfg();
    this.applyJoyCfg();
  }

  // ---------- ajustes dos controles: sensibilidade, transparência, tamanho e posição ----------
  saveJoyCfg() { try { localStorage.setItem(JOY_KEY, JSON.stringify(this.joyCfg)); } catch { /* ignora */ } }
  applyJoyCfg() {
    for (const [side, el] of [['l', this.ui.joy], ['r', this.ui.joyR]]) {
      const c = this.joyCfg[side];
      el.style.setProperty('--js', clamp(c.size, 0.5, 2));
      el.style.opacity = clamp(c.vis, 0.05, 1);
      if (c.pos) Object.assign(el.style, { left: pct(c.pos.x) + '%', top: pct(c.pos.y * 10) / 10 + '%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' });
      else Object.assign(el.style, { left: '', top: '', right: '', bottom: '', transform: '' });
    }
  }
  joyCfgHTML() {
    const c = this.joyCfg;
    const rng = (side, k, min, max, label) => `<label class="jc-r"><span>${label} <output>${pct(c[side][k])}%</output></span><input type="range" min="${min}" max="${max}" step="5" value="${pct(c[side][k])}" data-j="${side}.${k}"></label>`;
    const col = (side, name) => `<fieldset><legend>${name}</legend>${rng(side, 'sens', 10, 200, 'Sensibilidade')}${rng(side, 'vis', 5, 100, 'Visibilidade')}${rng(side, 'size', 60, 160, 'Tamanho')}</fieldset>`;
    return `<div class="jc-h"><b>Controles na tela</b><button class="jc-x" data-jc="close" aria-label="Fechar">✕</button></div>
      <div class="jc-cols">${col('l', 'Andar (esquerda)')}${col('r', 'Girar (direita)')}</div>
      <label class="jc-ck"><input type="checkbox" data-j="invY" ${c.invY ? 'checked' : ''}> Inverter olhar para cima/baixo</label>
      <div class="jc-b"><button class="btn sm ${this.joyEdit ? 'pri' : ''}" data-jc="move">${this.joyEdit ? 'Pronto (parar de mover)' : 'Mover na tela'}</button><button class="btn sm" data-jc="reset">Restaurar padrão</button></div>
      <p class="jc-t">${this.joyEdit ? 'Arraste cada controle para onde quiser.' : 'Menos sensibilidade = anda e gira mais devagar. Visibilidade baixa deixa o controle quase transparente.'}</p>`;
  }
  toggleJoyCfg(on = this.ui.cfg.hidden) {
    const p = this.ui.cfg;
    p.hidden = !on;
    if (on) p.innerHTML = this.joyCfgHTML();
    else if (this.joyEdit) { this.joyEdit = false; this.el.classList.remove('joy-edit'); }
    this.showJoys();
    return on;
  }
  bindJoyCfg() {
    const p = this.ui.cfg;
    p.addEventListener('input', (e) => {
      const k = e.target.dataset.j; if (!k) return;
      if (k === 'invY') { this.joyCfg.invY = e.target.checked; this.saveJoyCfg(); return; }
      const [side, f] = k.split('.');
      this.joyCfg[side][f] = +e.target.value / 100;
      const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = e.target.value + '%';
      this.applyJoyCfg(); this.saveJoyCfg();
    });
    p.addEventListener('click', (e) => {
      const a = e.target.closest('[data-jc]')?.dataset.jc; if (!a) return;
      if (a === 'close') { this.toggleJoyCfg(false); this.onJoyCfg?.(false); return; }
      if (a === 'move') { this.joyEdit = !this.joyEdit; this.el.classList.toggle('joy-edit', this.joyEdit); this.showJoys(); }
      if (a === 'reset') { this.joyCfg = { l: { ...JOY_DEF.l }, r: { ...JOY_DEF.r }, invY: false }; this.applyJoyCfg(); this.saveJoyCfg(); }
      p.innerHTML = this.joyCfgHTML();
    });
    for (const ev of ['pointerdown', 'pointermove', 'wheel']) p.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  // Controles aparecem no modo Andar e, em telas de toque, também na perspectiva
  showJoys() {
    const touch = matchMedia('(pointer: coarse)').matches;
    const on = this.mode === 'walk' || touch || !this.ui.cfg.hidden;
    this.ui.joy.hidden = !on; this.ui.joyR.hidden = !on;
    this.ui.vb.hidden = !(this.mode === 'walk' && this.fly);
  }

  fwd() { return [-Math.sin(this.yaw), -Math.cos(this.yaw)]; }

  setFly(on) {
    this.fly = on;
    if (!on && this.mode === 'walk') this.feet = floorAt(this.p, this.camera.position.x / M, this.camera.position.z / M, Math.max(0, this.camera.position.y / M - this.eye) + 30);
    this.showJoys();
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

  // O que está embaixo do dedo/cursor: móvel (e a peça dele), parede ou piso de cômodo
  pick(cx, cy) { return this.pickAll(cx, cy)[0] || null; }
  // Tudo o que o raio atravessa, do mais perto ao mais longe (sem repetir), até o chão
  pickAll(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
    const out = [], seen = new Set();
    const add = (hit, key) => { if (!seen.has(key)) { seen.add(key); out.push(hit); } };
    for (const h of this.ray.intersectObjects(this.group.children, true)) {
      if (h.object.isLight) continue;
      let o = h.object, part = null, skip = false;
      while (o && o !== this.group) {
        const u = o.userData;
        if (u.noPick) { skip = true; break; }
        if (!part && u.part) part = u.part;
        if (u.item) { add({ kind: 'item', id: u.item, part }, 'i' + u.item); break; }
        if (u.room) { add({ kind: 'wall', room: u.room, edge: u.edge, a: u.a, b: u.b, x: h.point.x / M, y: h.point.z / M }, `w${u.room}:${u.edge}:${Math.round(u.a)}`); break; }
        if (u.floorRoom) { add({ kind: 'room', id: u.floorRoom }, 'r' + u.floorRoom); break; }
        if (u.ground) return out;
        o = o.parent;
      }
      if (skip) continue;
    }
    return out;
  }
  // Toques seguidos no mesmo lugar pegam o próximo objeto (o que está atrás ou embaixo)
  pickCycle(cx, cy) {
    const list = this.pickAll(cx, cy);
    const L = this.lastPick, now = performance.now();
    const key = list.map((h) => h.kind + (h.id || h.room + h.edge + h.a)).join('|');
    let i = 0;
    if (L && L.key === key && now - L.t < 6000 && Math.hypot(cx - L.x, cy - L.y) < 16 && list.length > 1) i = (L.i + 1) % list.length;
    this.lastPick = { key, i, x: cx, y: cy, t: now };
    return { hit: list[i] || null, list, i };
  }

  // Destaca em azul o que está selecionado
  highlight(ids) {
    this.selIds = new Set(ids || []);
    for (const o of this.hl) { o.material.dispose(); o.material = o.userData.mat0; }
    this.hl = [];
    if (!this.selIds.size) return;
    for (const g of this.group.children) {
      if (!g.userData.item || !this.selIds.has(g.userData.item)) continue;
      g.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.mat0 = o.material;
        const m = o.material.clone();
        m.emissive = new T.Color('#2563eb'); m.emissiveIntensity = 0.4;
        o.material = m; this.hl.push(o);
      });
    }
  }

  goToScreen(cx, cy) {
    const hit = this.pickFloor(cx, cy);
    if (!hit) return;
    const c = this.camera.position;
    if (this.mode === 'walk') {
      const ty = this.fly ? c.y + (hit.y - (c.y - this.eye * M)) : hit.y + this.eye * M;
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
    const JC = this.joyCfg, sm = clamp(JC.l.sens, 0.05, 3), st = clamp(JC.r.sens, 0.05, 3);
    const jx = curve(this.joy.x) * sm, jy = curve(this.joy.y) * sm;
    const f = clamp((has('w', 'arrowup') ? 1 : 0) - (has('s', 'arrowdown') ? 1 : 0) + jy, -2, 2);
    const r = clamp((has('d') ? 1 : 0) - (has('a') ? 1 : 0) + jx, -2, 2);
    const u = clamp((has('e', ' ', 'pageup') ? 1 : 0) - (has('q', 'c', 'pagedown') ? 1 : 0) + this.vert, -1, 1);
    // girar: controle da direita ou setas ← →. Para a direita = sentido horário (visto de cima)
    const tx = clamp(curve(this.turn.x) * st + (has('arrowright') ? 1 : 0) - (has('arrowleft') ? 1 : 0), -2, 2);
    const ty = curve(this.turn.y) * st * (JC.invY ? -1 : 1);
    const fast = K.has('shift');
    if (this.mode === 'walk') {
      this.yaw -= tx * 1.9 * dt;
      this.pitch = clamp(this.pitch + ty * 1.3 * dt, -1.45, 1.45);
      const sp = (fast ? 3.4 : 1.5) * dt;
      const [fx, fz] = this.fwd();
      c.x += (fx * f + -fz * r) * sp; c.z += (fz * f + fx * r) * sp;
      if (this.fly) c.y = Math.max(0.2, c.y + u * sp);
      else {
        const tgt = floorAt(this.p, c.x / M, c.z / M, this.feet);
        this.feet += (tgt - this.feet) * Math.min(1, dt * (tgt > this.feet ? 14 : 9));
        c.y = (this.feet + this.eye) * M;
      }
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      return;
    }
    const tg = this.controls.target;
    // perspectiva: a câmera gira no próprio lugar (o ponto olhado anda em volta dela)
    if (tx || ty) {
      let vx = tg.x - c.x, vy = tg.y - c.y, vz = tg.z - c.z;
      const a = tx * 1.6 * dt, ca = Math.cos(a), sa = Math.sin(a);
      [vx, vz] = [vx * ca - vz * sa, vx * sa + vz * ca];
      const L = Math.hypot(vx, vy, vz) || 1, hl = Math.hypot(vx, vz) || 1e-6;
      const el = clamp(Math.atan2(vy, hl) + ty * 1.1 * dt, -1.5, 1.2);
      const nh = Math.cos(el) * L;
      tg.set(c.x + (vx / hl) * nh, c.y + Math.sin(el) * L, c.z + (vz / hl) * nh);
    }
    if (!f && !r && !u) return;
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
    for (const o of this.hl) o.material.dispose();
    this.hl = [];
    this.group.clear();
    this.lamps = 0;
  }

  box(w, h, d, color, x, y, z, parent, opts) {
    const m = new T.Mesh(new T.BoxGeometry(Math.max(0.001, w), Math.max(0.001, h), Math.max(0.001, d)), this.mat(color, opts));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  cyl(rt, rb, h, color, x, y, z, parent, seg = 28, opts, open = false) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, open), this.mat(color, opts));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  // Esfera com raios diferentes em x, y, z (elipsoide)
  ell(rx, ry, rz, color, x, y, z, parent, opts) {
    const m = new T.Mesh(new T.SphereGeometry(1, 18, 12), this.mat(color, opts));
    m.scale.set(Math.max(1e-4, rx), Math.max(1e-4, ry), Math.max(1e-4, rz)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  // Barra cilíndrica entre dois pontos locais
  rod(a, b, r, color, parent, opts) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz) || 1e-4;
    const m = this.cyl(r, r, L, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, parent, 10, opts);
    // gira o eixo y do cilindro para a direção a→b
    const axis = new this.V3(dz, 0, -dx); const ang = Math.acos(clamp(dy / L, -1, 1));
    if (axis.length() > 1e-6) m.quaternion.setFromAxisAngle(axis.normalize(), ang);
    else if (dy < 0) m.rotation.x = Math.PI;
    return m;
  }

  // Dia / noite: de noite as lâmpadas acendem de verdade
  // Raio-X: mezanino, escadas e o que está em cima ficam transparentes e o toque passa por eles
  setXray(on) { this.xray = on; if (this.p) this.build(this.p, true); }

  setNight(on) {
    this.night = on;
    this.hemi.intensity = on ? 0.22 : 1.6;
    this.sun.intensity = on ? 0.06 : 1.6;
    this.scene.background = new T.Color(on ? '#0c1220' : '#eef1f4');
    if (this.p) this.build(this.p, true);
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
      const tex = r.floorTex && r.floorTex !== 'plain' ? r.floorTex : null;
      const floor = new T.Mesh(g, tex ? this.floorMat(tex, r.floor) : this.mat(r.floor, { side: T.DoubleSide }));
      floor.position.y = 0.004; floor.receiveShadow = true;
      floor.userData.floorRoom = r.id;
      this.group.add(floor);
      all.push(...r.points);
    }
    // aberturas de todos os cômodos (para furar paredes encostadas)
    const ops = [];
    for (const r of p.rooms) for (const o of r.openings) { const sg = openingSeg(r, o); if (sg) ops.push({ o, s: sg.s, t: sg.t, T: r.wallT, room: r.id }); }
    for (const r of p.rooms) this.buildWalls(r, ops);
    for (const it of p.items) this.buildItem(it, p);
    for (const it of p.items) all.push([it.x, it.y]);
    // chão externo
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), this.mat('#dfe3e6'));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true;
    ground.userData.ground = true;
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
    if (this.selIds.size) this.highlight([...this.selIds]);
  }

  // at (opcional): { x, y, rot, eye, feet, name } para ver pelos olhos de uma pessoa
  view(kind, at = null) {
    const { cx, cz, size } = this.bounds || { cx: 0, cz: 0, size: 6 };
    const dist = Math.max(4, size * 1.25);
    this.anim = null;
    const walk = kind === 'walk';
    this.onMode?.(kind);
    this.mode = walk ? 'walk' : 'orbit';
    this.controls.enabled = !walk;
    this.camera.fov = walk ? 70 : 50; this.camera.updateProjectionMatrix();
    this.showJoys();
    if (walk) {
      if (at) { if (this.fly) this.setFly(false); }
      const x = at ? at.x * M : cx, z = at ? at.y * M : cz + size * 0.45;
      this.eye = at?.eye ?? EYE;
      this.yaw = at ? Math.PI - rad(at.rot || 0) : 0; this.pitch = at ? -0.12 : -0.08;
      this.feet = this.fly ? 0 : at?.feet ?? floorAt(this.p || { items: [] }, x / M, z / M, 0);
      this.camera.position.set(x, (this.feet + this.eye) * M, z);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      const touch = matchMedia('(pointer: coarse)').matches;
      if (at?.name) this.showHint(`Vendo pelos olhos de ${at.name}: olhos a ${String(Math.round(this.eye) / 100).replace('.', ',')} m do chão`);
      else this.showHint(touch ? 'Controle da esquerda: andar · controle da direita: girar a câmera · toque num objeto para ver opções · toque duas vezes no chão para ir até lá' : 'Arraste para olhar · W A S D andar · ← → girar (Shift = correr) · Q/E descer/subir · clique num objeto para ver opções');
      return;
    }
    this.eye = EYE;
    this.ui.hint.hidden = true;
    if (kind === 'top') this.camera.position.set(cx, dist * 1.3, cz + 0.01);
    else if (kind === 'walk') this.camera.position.set(cx, 1.6, cz + size * 0.45);
    else this.camera.position.set(cx + dist * 0.55, dist * 0.8, cz + dist * 0.85);
    this.controls.target.set(cx, kind === 'walk' ? 1.2 : 0, cz);
    this.controls.update();
  }

  buildWalls(r, ops) {
    const H = this.wallMode === 'full' ? r.height : this.wallMode === 'low' ? Math.min(100, r.height) : 0;
    if (!H || r.noWalls) return;
    const t = r.wallT;
    const E = edgesOf(r.points);
    const n = r.points.length;
    const gone = (i) => r.openings.some((o) => o.full && o.edge === (i + n) % n);
    for (const e of E) {
      // canto: a parede passa a espessura além do canto, menos quando a parede vizinha foi tirada (não sobra "pilar")
      const ext0 = isConvex(r.points, e.i) && !gone(e.i - 1) ? t : 0;
      const ext1 = isConvex(r.points, (e.i + 1) % n) && !gone(e.i + 1) ? t : 0;
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
        // parede inteira removida: leva junto os cantos desta parede
        if (q.o.full && q.room === r.id && q.o.edge === e.i) { a = -ext0; b = e.len + ext1; }
        // corte que chega no fim da parede leva o canto junto (senão sobra um pilarzinho)
        else if (q.room === r.id && q.o.edge === e.i && q.o.type === 'cut') { if (a <= 0.5) a = Math.min(a, -ext0); if (b >= e.len - 0.5) b = Math.max(b, e.len + ext1); }
        cuts.push({ a, b, o: q.o });
      }
      cuts.sort((p, q) => p.a - q.a);
      const segs = [];
      let pos = -ext0;
      for (const c of cuts) {
        const o = c.o, cut = o.type === 'cut';
        if (c.a > pos) segs.push({ a: pos, b: c.a, y0: 0, y1: H });
        const top = cut ? Infinity : o.type === 'window' ? o.sill + o.height : o.height;
        const bottom = cut ? Math.max(0, o.sill || 0) : o.type === 'window' ? o.sill : 0;
        const a = Math.max(pos, c.a);
        if (bottom > 0) segs.push({ a, b: c.b, y0: 0, y1: Math.min(bottom, H) });
        if (top < H) segs.push({ a, b: c.b, y0: top, y1: H });
        if (o.type === 'window' && bottom < H) segs.push({ a: c.a, b: c.b, y0: bottom, y1: Math.min(top, H), glass: true });
        if (o.type === 'garage') {
          // portão fechado: chapa com frisos
          const gt = Math.min(top, H);
          segs.push({ a: c.a, b: c.b, y0: 0, y1: gt, color: '#6b7480', th: 4, opts: { metalness: 0.35, roughness: 0.5 } });
          for (let y = 15; y < gt - 5; y += 15) segs.push({ a: c.a + 2, b: c.b - 2, y0: y - 0.6, y1: y + 0.6, color: '#4d555f', th: 5 });
        }
        pos = Math.max(pos, c.b);
      }
      if (pos < e.len + ext1) segs.push({ a: pos, b: e.len + ext1, y0: 0, y1: H });
      for (const s of segs) {
        const L = s.b - s.a, h = s.y1 - s.y0;
        if (L <= 0.1 || h <= 0.1) continue;
        const mid = (s.a + s.b) / 2;
        const cx = e.a[0] + e.dir[0] * mid - e.nIn[0] * (t / 2);
        const cz = e.a[1] + e.dir[1] * mid - e.nIn[1] * (t / 2);
        const th = s.glass ? 1.5 : s.th ?? t;
        const col = s.glass ? '#9fc9e8' : s.color || '#f4f2ee';
        const m = this.box(L * M, h * M, th * M, col, cx * M, ((s.y0 + s.y1) / 2) * M, cz * M, this.group, s.glass ? { transparent: true, opacity: 0.35, roughness: 0.1 } : s.opts);
        m.rotation.y = -Math.atan2(e.dir[1], e.dir[0]);
        m.userData = { room: r.id, edge: e.i, a: s.a, b: s.b, glass: !!s.glass };
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
    const base = (it.lvl ? mezzUnder(p, it.x, it.y) * M : 0) + (it.layer === 'wall' ? elevOf(p, it) * M : 0);
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
      case 'wallseg': this.buildWallSeg(it, g, base); break;
      case 'fence': this.buildFence(it, g, base); break;
      case 'gate': this.buildGate(it, g, base); break;
      case 'ground': this.buildGround(it, g); break;
      case 'bulb': case 'pendant': case 'indlight': case 'ceilinglamp': this.buildLight(it, g, base); break;
      case 'car': this.buildCar(it, g, base); break;
      case 'moto': this.buildMoto(it, g, base); break;
      case 'monitor': case 'pc': case 'laptop': case 'keyboard': case 'printer': this.buildTech(it, g, base); break;
      case 'socket': case 'switch': this.buildPlate(it, g, base); break;
      case 'cat': this.buildCat(it, g, base); break;
      case 'rabbit': this.buildRabbit(it, g, base); break;
      case 'person': this.buildPerson(it, g, base); break;
      case 'litter': {
        const t = 0.008, sand = Math.max(0.02, h * 0.55);
        B(w, t, d, c, 0, t / 2, 0);
        B(w, h, t, c, 0, h / 2, d / 2 - t / 2); B(w, h, t, c, 0, h / 2, -d / 2 + t / 2);
        B(t, h, d - 2 * t, c, w / 2 - t / 2, h / 2, 0); B(t, h, d - 2 * t, c, -w / 2 + t / 2, h / 2, 0);
        B(w - 2 * t, sand, d - 2 * t, '#e2d3a8', 0, sand / 2, 0);
        break;
      }
      default:
        if (it.shape === 'round') { const m = this.cyl(w / 2, w / 2, h, c, 0, base + h / 2, 0, g); m.scale.z = d / w; }
        else B(w, h, d, c, 0, h / 2, 0);
    }
    const ghost = this.xray && (isStruct(it) || it.lvl);
    if (it.status === 'sai' || ghost) g.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = ghost ? 0.14 : 0.35; if (ghost) { o.material.depthWrite = false; o.castShadow = false; } } });
    if (ghost) g.userData.noPick = true;
    g.position.set(it.x * M, 0, it.y * M);
    g.rotation.y = -rad(it.rot || 0);
    g.userData.item = it.id;
    this.group.add(g);
  }

  // ---------- área externa ----------
  // Muro / parede solta. Com h2 diferente de h o topo fica inclinado (ex.: embaixo da escada)
  buildWallSeg(it, g, base) {
    const w = it.w * M, d = Math.max(0.01, it.d * M), h = Math.max(0.01, it.h * M), h2 = Math.max(0, (it.h2 ?? it.h) * M);
    if (Math.abs(h2 - h) < 0.01) {
      this.box(w, h, d, it.color, 0, base + h / 2, 0, g);
      if (it.d >= 12) this.box(w + 0.02, 0.025, d + 0.04, shade(it.color, -0.07), 0, base + h + 0.0125, 0, g);
      return;
    }
    const sh = new T.Shape([new T.Vector2(-w / 2, 0), new T.Vector2(w / 2, 0), new T.Vector2(w / 2, h2), new T.Vector2(-w / 2, h)]);
    const geo = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    const m = new T.Mesh(geo, this.mat(it.color));
    m.position.y = base; m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }

  // Grade: quadro, postes e gradeado (vertical, diagonal, losango ou misto)
  buildFence(it, g, base) {
    const w = it.w * M, h = Math.max(0.1, it.h * M), col = it.color, so = { metalness: 0.5, roughness: 0.45 };
    const bt = clamp(it.d * M * 0.5, 0.012, 0.025);
    this.box(w, 0.03, bt * 1.4, col, 0, base + h - 0.02, 0, g, so);
    this.box(w, 0.03, bt * 1.4, col, 0, base + 0.06, 0, g, so);
    for (const x of fencePosts(it.w)) this.box(0.045, h, 0.045, col, x * M, base + h / 2, 0, g, so);
    for (const [x1, y1, x2, y2] of fenceBars(it.w, it.h, it.pattern)) {
      const L = Math.hypot(x2 - x1, y2 - y1) * M;
      const m = this.box(L, bt, bt, col, ((x1 + x2) / 2) * M, base + ((y1 + y2) / 2) * M, 0, g, so);
      m.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    }
  }

  // Portão: chapa com frisos (basculante), grade ou ripado
  buildGate(it, g, base) {
    const w = it.w * M, h = Math.max(0.1, it.h * M), d = Math.max(0.02, it.d * M), col = it.color, st = it.style || 'panel';
    const so = { metalness: 0.35, roughness: 0.5 }, dark = shade(col, -0.16), f = 0.05;
    this.box(w, f, d, col, 0, base + h - f / 2, 0, g, so);
    this.box(w, f, d, col, 0, base + f / 2, 0, g, so);
    this.box(f, h, d, col, -w / 2 + f / 2, base + h / 2, 0, g, so);
    this.box(f, h, d, col, w / 2 - f / 2, base + h / 2, 0, g, so);
    if (st === 'panel') {
      this.box(w - 2 * f, h - 2 * f, d * 0.5, col, 0, base + h / 2, 0, g, so);
      for (const y of gateLines(it.w, it.h, 'panel')) this.box(w - 2 * f, 0.012, d * 0.8, dark, 0, base + y * M, 0, g, so);
    } else if (st === 'slats') {
      const n = Math.max(2, Math.round((it.w - 10) / 12)), sw = ((w - 2 * f) / n) * 0.75;
      for (let i = 0; i < n; i++) this.box(sw, h - 2 * f, d * 0.6, col, -w / 2 + f + ((w - 2 * f) * (i + 0.5)) / n, base + h / 2, 0, g);
    } else {
      this.box(w - 2 * f, 0.03, d * 0.7, col, 0, base + h * 0.5, 0, g, so);
      for (const x of gateLines(it.w, it.h, 'bars')) this.box(0.016, h - 2 * f, 0.016, col, x * M, base + h / 2, 0, g, so);
    }
  }

  // Piso externo com textura (grama, concreto, cerâmico, deck, pedrisco, terra)
  buildGround(it, g) {
    const w = it.w * M, d = it.d * M, raised = it.h > 1.5;
    const th = raised ? it.h * M : 0.004;
    const m = new T.Mesh(new T.BoxGeometry(w, th, d), this.groundMat(it.tex || 'grass', it.color, it.w, it.d));
    m.position.y = raised ? th / 2 : 0.0015 - th / 2;
    m.receiveShadow = true;
    g.add(m);
  }

  // Piso de cômodo com textura (as coordenadas da forma já estão em metros)
  floorMat(tex, color) {
    const key = `f:${tex}:${color}`;
    if (!this.mats.has(key)) {
      const t = this.groundTex(tex).clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      const k = 100 / (TEX_SIZE[tex] || 100);
      t.repeat.set(k, k);
      this.mats.set(key, new T.MeshStandardMaterial({ color: new T.Color(color), map: t, roughness: tex === 'porcelain' ? 0.35 : tex === 'tiles' ? 0.55 : tex === 'wood' ? 0.6 : 0.95, metalness: 0, side: T.DoubleSide }));
    }
    return this.mats.get(key);
  }

  groundMat(tex, color, wcm, dcm) {
    const size = TEX_SIZE[tex] || 100;
    const rx = Math.max(1, Math.round((wcm / size) * 4) / 4), ry = Math.max(1, Math.round((dcm / size) * 4) / 4);
    const key = `g:${tex}:${color}:${rx}:${ry}`;
    if (!this.mats.has(key)) {
      const t = this.groundTex(tex).clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(rx, ry);
      this.mats.set(key, new T.MeshStandardMaterial({ color: new T.Color(color), map: t, roughness: tex === 'porcelain' ? 0.35 : tex === 'tiles' ? 0.55 : tex === 'wood' ? 0.6 : 0.95, metalness: 0 }));
    }
    return this.mats.get(key);
  }

  // Texturas desenhadas na hora (claras, para serem tingidas pela cor do piso)
  groundTex(tex) {
    if (this.texs.has(tex)) return this.texs.get(tex);
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d');
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const fill = (v) => `rgb(${v},${v},${v})`;
    x.fillStyle = fill(tex === 'grass' ? 225 : tex === 'cement' ? 222 : 232); x.fillRect(0, 0, N, N);
    if (tex === 'grass') {
      for (let i = 0; i < 2600; i++) { const px = rnd() * N, py = rnd() * N, v = 170 + rnd() * 85; x.strokeStyle = `rgb(${v * 0.9},${v},${v * 0.85})`; x.lineWidth = 1 + rnd(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 4, py - 3 - rnd() * 5); x.stroke(); }
    } else if (tex === 'concrete' || tex === 'soil') {
      for (let i = 0; i < 5000; i++) { const v = tex === 'soil' ? 150 + rnd() * 105 : 200 + rnd() * 55; x.fillStyle = fill(v | 0); const r = tex === 'soil' ? 1 + rnd() * 2.5 : 1 + rnd(); x.fillRect(rnd() * N, rnd() * N, r, r); }
      if (tex === 'concrete') { x.fillStyle = fill(165); x.fillRect(0, 0, N, 2); x.fillRect(0, 0, 2, N); }
    } else if (tex === 'tiles') {
      const n = 2, s = N / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = fill((236 + rnd() * 16) | 0); x.fillRect(i * s, j * s, s, s); }
      x.fillStyle = fill(175);
      for (let i = 0; i <= n; i++) { x.fillRect(i * s - 1.5, 0, 3, N); x.fillRect(0, i * s - 1.5, N, 3); }
    } else if (tex === 'deck') {
      const n = 8, s = N / n;
      for (let j = 0; j < n; j++) {
        x.fillStyle = fill((205 + rnd() * 45) | 0); x.fillRect(0, j * s, N, s);
        x.strokeStyle = 'rgba(80,60,40,.18)'; x.lineWidth = 1;
        for (let k = 0; k < 4; k++) { const y = j * s + 4 + rnd() * (s - 8); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(N * 0.3, y + rnd() * 4 - 2, N * 0.7, y + rnd() * 4 - 2, N, y); x.stroke(); }
        x.fillStyle = fill(110); x.fillRect(0, j * s, N, 2);
        const cut = rnd() * N; x.fillRect(cut, j * s, 2, s);
      }
    } else if (tex === 'wood') {
      // tábuas de 15 cm com emendas alternadas
      const n = 8, s = N / n;
      for (let j = 0; j < n; j++) {
        x.fillStyle = fill((200 + rnd() * 45) | 0); x.fillRect(0, j * s, N, s);
        x.strokeStyle = 'rgba(70,45,25,.16)'; x.lineWidth = 1;
        for (let k = 0; k < 5; k++) { const y = j * s + 3 + rnd() * (s - 6); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(N * 0.3, y + rnd() * 3 - 1.5, N * 0.7, y + rnd() * 3 - 1.5, N, y); x.stroke(); }
        x.fillStyle = fill(120); x.fillRect(0, j * s, N, 1.5);
        const cut = (j % 2 ? 0.25 : 0.75) * N + (rnd() - 0.5) * 30; x.fillRect(cut, j * s, 1.5, s);
      }
    } else if (tex === 'porcelain') {
      // placas de 60 × 60 com rejunte fino
      const n = 2, s = N / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x.fillStyle = fill((238 + rnd() * 10) | 0); x.fillRect(i * s, j * s, s, s);
        for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(0,0,0,${0.015 + rnd() * 0.025})`; x.beginPath(); x.ellipse(i * s + rnd() * s, j * s + rnd() * s, 4 + rnd() * 14, 2 + rnd() * 6, rnd() * 3, 0, Math.PI * 2); x.fill(); }
      }
      x.fillStyle = fill(196);
      for (let i = 0; i <= n; i++) { x.fillRect(i * s - 0.75, 0, 1.5, N); x.fillRect(0, i * s - 0.75, N, 1.5); }
    } else if (tex === 'cement') {
      // cimento queimado: manchas suaves
      for (let k = 0; k < 140; k++) { const v = rnd() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${0.03 + rnd() * 0.05})`; x.beginPath(); x.ellipse(rnd() * N, rnd() * N, 10 + rnd() * 40, 6 + rnd() * 26, rnd() * 3, 0, Math.PI * 2); x.fill(); }
      for (let i = 0; i < 1500; i++) { x.fillStyle = fill((205 + rnd() * 40) | 0); x.fillRect(rnd() * N, rnd() * N, 1, 1); }
    } else if (tex === 'gravel') {
      for (let i = 0; i < 1800; i++) { const v = 150 + rnd() * 105; x.fillStyle = fill(v | 0); x.beginPath(); x.ellipse(rnd() * N, rnd() * N, 2 + rnd() * 3, 1.5 + rnd() * 2.5, rnd() * 3, 0, Math.PI * 2); x.fill(); }
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    this.texs.set(tex, t);
    return t;
  }

  // ---------- luz ----------
  // Lâmpadas brilham sempre; no modo Noite iluminam o ambiente de verdade
  glowMat(on) { return this.mat('#fff6dc', { emissive: new T.Color('#ffd27a'), emissiveIntensity: on ? (this.night ? 2.4 : 0.9) : 0, roughness: 0.3 }); }
  addLamp(g, x, y, z, on) {
    if (!on || !this.night || this.lamps >= MAX_LAMPS) return;
    const L = new T.PointLight('#ffd9a0', 4, 0, 1.6);
    L.position.set(x, y, z);
    g.add(L); this.lamps++;
  }
  buildLight(it, g, base) {
    const on = it.lightOn !== false, col = it.color, h = Math.max(0.02, it.h * M), w = it.w * M, so = { metalness: 0.4, roughness: 0.45 };
    const bulb = (r, x, y, z) => { const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), this.glowMat(on)); m.position.set(x, y, z); g.add(m); return m; };
    if (it.sym === 'ceilinglamp') {
      // plafon / spot: disco colado no teto com a parte de baixo acesa
      const r = Math.min(it.w, it.d) * M * 0.5;
      this.cyl(r, r, h, col, 0, base + h / 2, 0, g, 28, { roughness: 0.4 });
      const disc = new T.Mesh(new T.CylinderGeometry(r * 0.86, r * 0.86, 0.004, 28), this.glowMat(on));
      disc.position.set(0, base - 0.002, 0); g.add(disc);
      this.addLamp(g, 0, base - 0.05, 0, on);
      return;
    }
    if (it.sym === 'bulb') {
      const r = Math.min(it.w, it.d) * M * 0.5;
      if (h > 2 * r) this.cyl(r * 0.45, r * 0.45, h - 2 * r, '#e9e6df', 0, base + 2 * r + (h - 2 * r) / 2, 0, g, 12);
      bulb(r, 0, base + r, 0);
      this.addLamp(g, 0, base + r, 0, on);
      return;
    }
    // abajur (cúpula) com lâmpada dentro, pendurado por um cabo
    const shadeAt = (x, r, cable) => {
      const sh = Math.min(r * 1.1, Math.max(0.06, h * 0.45));
      const dome = this.cyl(r * 0.28, r, sh, col, x, base + sh / 2, 0, g, 24, { ...so, side: T.DoubleSide }, true);
      dome.castShadow = false;
      this.cyl(r * 0.28, r * 0.28, 0.01, col, x, base + sh, 0, g, 16, so);
      bulb(r * 0.3, x, base + sh * 0.28, 0);
      if (cable > 0) this.cyl(0.004, 0.004, cable, '#222', x, base + sh + cable / 2, 0, g, 6);
      this.addLamp(g, x, base + sh * 0.2, 0, on);
    };
    if (it.sym === 'pendant') {
      const r = Math.min(it.w, it.d) * M * 0.5, sh = Math.min(r * 1.1, Math.max(0.06, h * 0.45));
      shadeAt(0, r, h - sh);
      this.cyl(0.05, 0.05, 0.02, col, 0, base + h, 0, g, 16, so);
      return;
    }
    const nb = Math.max(1, Math.round(it.bulbs || 4));
    const r = clamp(Math.min((it.w / nb) * 0.34, it.d * 0.6 + 4), 4, 13) * M;
    const sh = Math.min(r * 1.1, Math.max(0.06, h * 0.45));
    this.box(w, 0.03, 0.045, col, 0, base + h, 0, g, so);
    for (let i = 0; i < nb; i++) shadeAt(-w / 2 + (w * (i + 0.5)) / nb, r, h - sh - 0.015);
    // tirantes até o teto
    for (const sx of [-1, 1]) this.cyl(0.003, 0.003, 0.4, '#222', sx * w * 0.4, base + h + 0.2, 0, g, 6);
  }

  // Tomada e interruptor (espelho 4×2 encostado na parede: fundo em -z)
  buildPlate(it, g, base) {
    const w = it.w * M, h = it.h * M, d = Math.max(0.006, it.d * M), mods = Math.max(1, Math.round(it.mods || 1));
    this.box(w, h, d, it.color, 0, base + h / 2, 0, g, { roughness: 0.4 });
    const front = d / 2 + 0.001, mw = w / (it.sym === 'socket' ? mods : 1);
    for (let i = 0; i < mods; i++) {
      if (it.sym === 'socket') {
        const x = -w / 2 + mw * (i + 0.5), r = Math.min(mw, h) * 0.32, y = base + h / 2;
        const c = this.cyl(r, r, 0.004, '#e4e4e2', x, y, front, g, 20); c.rotation.x = Math.PI / 2;
        for (const [hx, hy] of [[-0.3, 0.12], [0.3, 0.12], [0, -0.32]]) { const p = this.cyl(r * 0.13, r * 0.13, 0.006, '#2a2a2a', x + hx * r, y + hy * r, front + 0.002, g, 8); p.rotation.x = Math.PI / 2; }
      } else {
        const kh = (h * 0.62) / mods;
        this.box(w * 0.5, kh * 0.85, 0.008, '#ebebe8', 0, base + h * 0.19 + kh * (i + 0.5), front + 0.003, g, { roughness: 0.35 });
      }
    }
  }

  // ---------- veículos ----------
  // Carro: perfil lateral extrudado (frente em -z), cabine de vidro, rodas, faróis e lanternas
  buildCar(it, g, base) {
    const W = it.w * M, D = it.d * M, H = Math.max(0.6, it.h * M), c = it.color, m = it.model || 'hatch';
    const P = { hatch: [0.29, 0.47, 0.86, 0.97, 0.55], sedan: [0.28, 0.44, 0.7, 0.84, 0.53], suv: [0.23, 0.35, 0.91, 0.98, 0.58] }[m] || [0.29, 0.47, 0.86, 0.97, 0.55];
    const wr = clamp(H * 0.21, 0.26, 0.38), cl = wr * 0.55, hb = H * P[4];
    const u = (f) => -D / 2 + D * f;
    const paint = { metalness: 0.45, roughness: 0.32 };
    const prof = (pts, width, color, opts) => {
      const geo = new T.ExtrudeGeometry(new T.Shape(pts.map(([a, b]) => new T.Vector2(a, b))), { depth: width, bevelEnabled: false });
      geo.translate(0, 0, -width / 2); geo.rotateY(-Math.PI / 2);
      const mesh = new T.Mesh(geo, this.mat(color, opts)); mesh.position.y = base; mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
    };
    // carroceria (embaixo da linha das janelas)
    const back = m === 'sedan' ? [[u(0.96), hb], [D / 2, hb * 0.9]] : [[D / 2 - 0.03, hb], [D / 2, hb * 0.86]];
    // embaixo: caixas de roda (arcos) para as rodas aparecerem
    const WZ = [0.17, 0.82], ar = wr * 1.12, bottom = [];
    for (const fz of [...WZ].reverse()) {
      // de trás para a frente: ângulo φ de +φ0 (chão, lado de trás) a −φ0 (chão, lado da frente)
      const zc = u(fz), f0 = Math.acos(clamp((cl - wr) / ar, -1, 1));
      for (let k = 0; k <= 12; k++) { const f = f0 - (2 * f0 * k) / 12; bottom.push([zc + Math.sin(f) * ar, wr + Math.cos(f) * ar]); }
    }
    prof([[-D / 2, cl], [-D / 2, hb * 0.78], [u(0.04), hb * 0.93], [u(P[0]), hb], ...back, [D / 2, cl], ...bottom], W, c, paint);
    // cabine: vidros escuros, teto na cor do carro
    const cw = W * 0.88;
    prof([[u(P[0]), hb], [u(P[1]), H - 0.04], [u(P[2]), H - 0.04], [u(P[3]), hb]], cw, '#3b4b5c', { metalness: 0.5, roughness: 0.1 });
    const roofL = D * (P[2] - P[1]);
    this.box(cw + 0.01, 0.05, roofL, c, 0, base + H - 0.025, u((P[1] + P[2]) / 2), g, paint);
    // colunas do meio
    this.box(cw + 0.012, H - 0.04 - hb, 0.07, c, 0, base + (hb + H - 0.04) / 2, u(P[1] + (P[2] - P[1]) * 0.45), g, paint);
    // para-choques, faróis e lanternas
    this.box(W + 0.02, 0.12, 0.08, '#2a2d31', 0, base + cl + 0.08, -D / 2 + 0.02, g);
    this.box(W + 0.02, 0.12, 0.08, '#2a2d31', 0, base + cl + 0.08, D / 2 - 0.02, g);
    for (const sx of [-1, 1]) {
      this.box(W * 0.2, 0.07, 0.03, '#f4f1e6', sx * W * 0.34, base + hb * 0.8, -D / 2 + 0.012, g, { emissive: new T.Color('#fff3c8'), emissiveIntensity: this.night ? 1.2 : 0.25 });
      this.box(W * 0.18, 0.07, 0.03, '#b3121b', sx * W * 0.36, base + hb * 0.86, D / 2 - 0.01, g, { emissive: new T.Color('#c0141c'), emissiveIntensity: 0.35 });
      // retrovisores
      this.box(0.12, 0.08, 0.1, c, sx * (W / 2 + 0.05), base + hb + 0.06, u(P[0] + 0.03), g, paint);
    }
    // rodas
    for (const sx of [-1, 1]) for (const fz of WZ) {
      const tyre = this.cyl(wr, wr, 0.21, '#1f2124', sx * (W / 2 - 0.115), base + wr, u(fz), g, 24, { roughness: 0.9 });
      tyre.rotation.z = Math.PI / 2;
      const rim = this.cyl(wr * 0.6, wr * 0.6, 0.215, '#b9bec4', sx * (W / 2 - 0.115), base + wr, u(fz), g, 18, { metalness: 0.7, roughness: 0.3 });
      rim.rotation.z = Math.PI / 2;
    }
  }

  buildMoto(it, g, base) {
    const W = it.w * M, D = it.d * M, H = it.h * M, c = it.color, wr = H * 0.27;
    for (const fz of [-0.34, 0.34]) {
      const t = new T.Mesh(new T.TorusGeometry(wr * 0.78, wr * 0.22, 10, 26), this.mat('#1f2124', { roughness: 0.9 }));
      t.rotation.y = Math.PI / 2; t.position.set(0, base + wr, D * fz); t.castShadow = true; g.add(t);
    }
    this.box(W * 0.35, H * 0.22, D * 0.42, c, 0, base + H * 0.5, -D * 0.02, g, { metalness: 0.45, roughness: 0.35 });
    this.box(W * 0.3, H * 0.08, D * 0.3, '#222', 0, base + H * 0.66, D * 0.12, g);
    this.rod([0, wr, -D * 0.34], [0, H * 0.92, -D * 0.24], 0.025, '#9aa0a6', g, { metalness: 0.7 }).position.y += base;
    this.box(W * 0.95, 0.03, 0.03, '#2a2a2a', 0, base + H * 0.92, -D * 0.24, g);
    this.rod([0, wr, D * 0.34], [0, H * 0.48, D * 0.05], 0.03, '#555', g).position.y += base;
  }

  // Computador, monitor, notebook, teclado e impressora (frente em +z, fundo encostado em -z)
  buildTech(it, g, base) {
    const W = it.w * M, D = Math.max(0.01, it.d * M), H = Math.max(0.01, it.h * M), c = it.color;
    const screen = (w, h, x, y, z, parent = g) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), this.mat('#1d2b3a', { emissive: new T.Color('#4f7fb0'), emissiveIntensity: this.night ? 0.9 : 0.35, roughness: 0.15 }));
      m.position.set(x, y, z); parent.add(m); return m;
    };
    if (it.sym === 'monitor') {
      const sh = H * 0.72, th = 0.025;
      this.box(W, sh, th, c, 0, base + H - sh / 2, -D / 2 + 0.05, g, { roughness: 0.4 });
      screen(W - 0.02, sh - 0.025, 0, base + H - sh / 2 + 0.004, -D / 2 + 0.05 + th / 2 + 0.001);
      this.box(0.04, H - sh + 0.04, 0.03, c, 0, base + (H - sh) / 2, -D / 2 + 0.03, g);
      this.box(Math.min(0.24, W * 0.4), 0.012, Math.min(0.18, D * 0.9), c, 0, base + 0.006, 0, g);
    } else if (it.sym === 'pc') {
      this.box(W, H, D, c, 0, base + H / 2, 0, g, { roughness: 0.45 });
      this.box(W * 0.02, H * 0.85, D * 0.6, '#5d7a99', W / 2 + 0.002, base + H * 0.5, -D * 0.05, g, { transparent: true, opacity: 0.5, roughness: 0.1 });
      const led = this.cyl(0.006, 0.006, 0.004, '#7cd1ff', 0, base + H - 0.03, D / 2 + 0.002, g, 10, { emissive: new T.Color('#3fb6ff'), emissiveIntensity: 1.5 });
      led.rotation.x = Math.PI / 2;
    } else if (it.sym === 'laptop') {
      const bt = 0.018, lid = Math.min(H, D * 0.95), ang = 0.32;
      this.box(W, bt, D, c, 0, base + bt / 2, 0, g, { metalness: 0.5, roughness: 0.35 });
      this.box(W * 0.9, 0.002, D * 0.42, '#2b2f33', 0, base + bt + 0.001, -D * 0.12, g);
      const lg = new T.Group(); lg.position.set(0, base + bt, -D / 2 + 0.005); lg.rotation.x = -ang; g.add(lg);
      this.box(W, lid, 0.008, c, 0, lid / 2, 0, lg, { metalness: 0.5, roughness: 0.35 });
      screen(W * 0.92, lid * 0.86, 0, lid / 2, 0.0045, lg);
    } else if (it.sym === 'keyboard') {
      const kw = W * 0.74;
      this.box(kw, H * 0.6, D, c, -W / 2 + kw / 2, base + H * 0.3, 0, g, { roughness: 0.6 });
      this.box(kw * 0.95, 0.004, D * 0.85, '#45494f', -W / 2 + kw / 2, base + H * 0.6 + 0.002, 0, g);
      this.ell(W * 0.05, H * 0.55, D * 0.36, c, W / 2 - W * 0.08, base + H * 0.25, 0, g, { roughness: 0.4 });
    } else {
      this.box(W, H * 0.8, D, c, 0, base + H * 0.4, 0, g, { roughness: 0.5 });
      this.box(W * 0.6, 0.004, D * 0.5, '#f7f7f5', 0, base + H * 0.8 + 0.01, -D * 0.1, g);
      this.box(W * 0.6, H * 0.2, 0.01, '#f7f7f5', 0, base + H * 0.9, -D / 2 + 0.03, g);
      this.box(W * 0.7, 0.02, D * 0.2, shade(c, -0.2), 0, base + H * 0.3, D / 2, g);
    }
  }

  // ---------- pets ----------
  buildCat(it, g, base) {
    const W = it.w * M, D = it.d * M, H = it.h * M, coat = it.coat || 'rajada', c = it.color;
    const white = '#f4f2ee', dark = shade(c, coat === 'rajada' || coat === 'laranja' ? -0.16 : -0.08);
    const frajola = coat === 'frajola';
    const bz = -D * 0.08, bry = H * 0.21, brz = D * 0.3, brx = W * 0.42;
    this.ell(brx, bry, brz, c, 0, base + H * 0.44, bz, g);
    this.ell(W * 0.3, H * 0.2, D * 0.13, frajola ? white : c, 0, base + H * 0.52, D * 0.16, g);
    const rH = Math.min(W * 0.36, H * 0.2), hy = base + H - rH * 1.15, hz = D * 0.33;
    this.ell(rH, rH * 0.9, rH * 0.92, c, 0, hy, hz, g);
    for (const sx of [-1, 1]) {
      const ear = new T.Mesh(new T.ConeGeometry(rH * 0.36, rH * 0.62, 4), this.mat(c));
      ear.position.set(sx * rH * 0.52, hy + rH * 0.82, hz - rH * 0.05); ear.rotation.z = -sx * 0.28; ear.castShadow = true; g.add(ear);
      this.ell(rH * 0.13, rH * 0.13, rH * 0.07, '#c9b23a', sx * rH * 0.36, hy + rH * 0.12, hz + rH * 0.8, g, { roughness: 0.2 });
      this.ell(rH * 0.05, rH * 0.1, rH * 0.04, '#111', sx * rH * 0.36, hy + rH * 0.12, hz + rH * 0.86, g);
    }
    this.ell(rH * 0.42, rH * 0.3, rH * 0.3, frajola ? white : shade(c, 0.1), 0, hy - rH * 0.3, hz + rH * 0.72, g);
    this.ell(rH * 0.1, rH * 0.07, rH * 0.06, '#d98c99', 0, hy - rH * 0.12, hz + rH * 0.98, g);
    const lr = W * 0.085, lh = H * 0.36;
    for (const [sx, z] of [[-1, D * 0.13], [1, D * 0.13], [-1, -D * 0.28], [1, -D * 0.28]]) {
      this.cyl(lr, lr * 0.9, lh, c, sx * W * 0.2, base + lh / 2, z, g, 10);
      this.ell(lr * 1.15, lr * 0.6, lr * 1.4, frajola ? white : c, sx * W * 0.2, base + lr * 0.5, z + lr * 0.3, g);
    }
    // rabo levantado para trás
    const t0 = [0, base + H * 0.48, bz - brz * 0.92], ang = 1.0, tl = D * 0.55;
    const t1 = [0, t0[1] + Math.sin(ang) * tl, t0[2] - Math.cos(ang) * tl];
    this.rod(t0, t1, W * 0.065, c, g);
    // listras da rajada (anéis em volta do corpo e do rabo)
    if (coat === 'rajada' || coat === 'laranja') {
      for (const f of [-0.7, -0.4, -0.1, 0.2, 0.5]) {
        const dz = f * brz, k = Math.sqrt(Math.max(0.05, 1 - f * f)) * 1.005;
        const ring = new T.Mesh(new T.TorusGeometry(1, 0.035, 5, 32), this.mat(dark));
        ring.scale.set(brx * k, bry * k, 0.35 * D); ring.position.set(0, base + H * 0.44, bz + dz); g.add(ring);
      }
      for (const f of [0.35, 0.6, 0.85]) {
        const ring = new T.Mesh(new T.TorusGeometry(W * 0.066, W * 0.01, 5, 16), this.mat(dark));
        ring.position.set(0, t0[1] + (t1[1] - t0[1]) * f, t0[2] + (t1[2] - t0[2]) * f); ring.rotation.x = Math.PI / 2 - ang; g.add(ring);
      }
    }
  }

  buildRabbit(it, g, base) {
    const W = it.w * M, D = it.d * M, H = it.h * M, c = it.color, inner = shade(c, 0.14);
    this.ell(W * 0.46, H * 0.36, D * 0.36, c, 0, base + H * 0.36, -D * 0.08, g);
    for (const sx of [-1, 1]) this.ell(W * 0.15, H * 0.17, D * 0.22, c, sx * W * 0.34, base + H * 0.16, -D * 0.12, g);
    for (const sx of [-1, 1]) this.ell(W * 0.08, H * 0.06, D * 0.1, c, sx * W * 0.14, base + H * 0.05, D * 0.2, g);
    const rH = Math.min(W * 0.32, H * 0.3), hy = base + H * 0.62, hz = D * 0.26;
    this.ell(rH, rH * 0.92, rH * 1.05, c, 0, hy, hz, g);
    for (const sx of [-1, 1]) {
      const e1 = this.ell(rH * 0.26, rH * 1.15, rH * 0.12, c, sx * rH * 0.32, hy + rH * 1.55, hz - rH * 0.35, g);
      e1.rotation.set(-0.35, 0, -sx * 0.18);
      const e2 = this.ell(rH * 0.16, rH * 0.95, rH * 0.05, inner, sx * rH * 0.32, hy + rH * 1.55, hz - rH * 0.27, g);
      e2.rotation.set(-0.35, 0, -sx * 0.18);
      this.ell(rH * 0.14, rH * 0.16, rH * 0.08, '#3a2414', sx * rH * 0.5, hy + rH * 0.15, hz + rH * 0.82, g, { roughness: 0.15 });
    }
    this.ell(rH * 0.12, rH * 0.08, rH * 0.06, '#b07a86', 0, hy - rH * 0.15, hz + rH * 1.0, g);
    this.ell(W * 0.15, W * 0.15, W * 0.13, '#f1efea', 0, base + H * 0.4, -D * 0.44, g);
  }

  // ---------- pessoas (para comparar alturas) ----------
  buildPerson(it, g, base) {
    const H = it.h * M, W = it.w * M, D = it.d * M, fem = it.gender === 'f';
    const skin = '#d9a98a', hair = fem ? '#4a2f22' : '#2e231d', shirt = it.color, pants = fem ? '#3b4352' : '#36404e', shoe = '#2a2a2a';
    const hR = H * 0.064, hy = base + H - hR * 1.02;
    this.ell(hR * 0.8, hR, hR * 0.88, skin, 0, hy, 0, g);
    this.ell(hR * 0.86, hR * 0.78, hR * 0.95, hair, 0, hy + hR * 0.26, -hR * 0.08, g);
    if (fem) this.ell(hR * 0.88, hR * 1.55, hR * 0.55, hair, 0, hy - hR * 0.85, -hR * 0.45, g);
    for (const sx of [-1, 1]) this.ell(hR * 0.1, hR * 0.08, hR * 0.05, '#2a1d16', sx * hR * 0.3, hy + hR * 0.08, hR * 0.82, g);
    this.cyl(H * 0.028, H * 0.03, H * 0.06, skin, 0, base + H * 0.845, 0, g, 12);
    const yS = H * 0.815, yH = H * 0.53;
    const torso = this.cyl(1, fem ? 0.78 : 0.88, 1, shirt, 0, base + (yS + yH) / 2, 0, g, 22);
    torso.scale.set(W * 0.4, yS - yH, D * 0.42);
    this.ell(W * 0.44, H * 0.035, D * 0.4, shirt, 0, base + yS - H * 0.005, 0, g);
    // pernas
    const legTop = fem ? H * 0.42 : yH + 0.02;
    for (const sx of [-1, 1]) {
      const x = sx * W * 0.12;
      if (fem) this.cyl(W * 0.085, W * 0.065, legTop - H * 0.04, skin, x, base + (legTop + H * 0.04) / 2, 0, g, 12);
      else this.cyl(W * 0.12, W * 0.09, legTop - H * 0.04, pants, x, base + (legTop + H * 0.04) / 2, 0, g, 12);
      this.box(W * 0.14, H * 0.04, D * 0.62, shoe, x, base + H * 0.02, D * 0.12, g);
    }
    if (fem) this.cyl(W * 0.36, W * 0.46, yH + 0.03 - H * 0.4, shirt, 0, base + (yH + 0.03 + H * 0.4) / 2, 0, g, 22).scale.z = (D * 0.5) / (W * 0.46);
    else this.cyl(W * 0.4, W * 0.38, H * 0.06, pants, 0, base + yH, 0, g, 22).scale.z = (D * 0.42) / (W * 0.4);
    // braços: manga curta e antebraço
    for (const sx of [-1, 1]) {
      const sxp = sx * (W * 0.5 - W * 0.07), y0 = base + yS - 0.02, ye = base + H * 0.64, yw = base + H * 0.47;
      this.rod([sxp, y0, 0], [sxp + sx * 0.01, ye, 0], W * 0.075, shirt, g);
      this.rod([sxp + sx * 0.01, ye, 0], [sxp + sx * 0.025, yw, D * 0.04], W * 0.05, skin, g);
      this.ell(W * 0.05, W * 0.075, W * 0.04, skin, sxp + sx * 0.027, yw - W * 0.06, D * 0.045, g);
    }
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
    if (ch > 0.05) for (const [x, y, key] of mezzCols(it)) {
      this.box(0.1, ch, 0.1, col, x * M, ch / 2, y * M, g, so).userData.part = 'col:' + key;
      this.box(0.2, 0.012, 0.2, col, x * M, 0.006, y * M, g, so).userData.part = 'col:' + key;
    }
    // guarda-corpo (abre onde a escada chega)
    const rh = (it.railH ?? 110) * M;
    if (rh > 0.05) for (const r of mezzRails(p, it)) this.railLine(g, r.a, r.b, H, rh, col, so, true, 'rail:' + r.side);
  }

  // Guarda-corpo reto entre dois pontos locais (cm), em cima da altura y0 (m)
  railLine(g, a, b, y0, rh, col, so, kick, part) {
    const n0 = g.children.length;
    this.railLine0(g, a, b, y0, rh, col, so, kick);
    if (part) for (const m of g.children.slice(n0)) m.userData.part = part;
  }
  railLine0(g, a, b, y0, rh, col, so, kick) {
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
      const bar = this.box(0.045, 0.045, L, col, x, H / 2 + rh, 0, g, so); bar.rotation.x = ang; bar.userData.part = 'rail:' + k;
      const np = Math.max(1, Math.ceil(L / 1.2));
      for (let j = 0; j <= np; j++) { const f = j / np; this.box(0.035, rh, 0.035, col, x, f * H + rh / 2, d / 2 - f * d, g, so).userData.part = 'rail:' + k; }
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
