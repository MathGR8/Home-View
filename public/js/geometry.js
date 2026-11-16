// Geometria 2D. Todas as medidas em centímetros; y cresce para baixo (como na tela).

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const round = (v, s = 1) => Math.round(v / s) * s;
export const normAng = (a) => ((a % 360) + 360) % 360;

export function signedArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

// Garante área positiva (sentido horário na tela) => normal interna = (-dy, dx)
export function normalizePoly(pts) {
  return signedArea(pts) < 0 ? pts.slice().reverse() : pts.slice();
}

export function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-6) return bboxCenter(pts);
  return [cx / (3 * a), cy / (3 * a)];
}

export function bbox(pts) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x1) x1 = x; if (y < y1) y1 = y;
    if (x > x2) x2 = x; if (y > y2) y2 = y;
  }
  return { x1, y1, x2, y2 };
}
export const bboxCenter = (pts) => { const b = bbox(pts); return [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2]; };
export const unionBox = (a, b) => (!a ? b : !b ? a : { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) });
export const boxesIntersect = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function edgesOf(pts) {
  const n = pts.length;
  return pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1e-9;
    const dir = [dx / len, dy / len];
    return { i, a, b, len, dir, nIn: [-dir[1], dir[0]] };
  });
}

// Desloca o polígono para fora (paredes) usando esquadria nos cantos
export function offsetPoly(pts, d) {
  const E = edgesOf(pts);
  const n = pts.length;
  return pts.map((p, i) => {
    const e0 = E[(i - 1 + n) % n], e1 = E[i];
    const n0 = [-e0.nIn[0], -e0.nIn[1]], n1 = [-e1.nIn[0], -e1.nIn[1]];
    const dot = n0[0] * n1[0] + n0[1] * n1[1];
    const s = d / Math.max(0.15, 1 + dot);
    return [p[0] + (n0[0] + n1[0]) * s, p[1] + (n0[1] + n1[1]) * s];
  });
}

// Canto convexo? (para fechar as paredes no 3D)
export function isConvex(pts, i) {
  const n = pts.length;
  const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
  return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0;
}

export function rotPt(x, y, angDeg) {
  const c = Math.cos(rad(angDeg)), s = Math.sin(rad(angDeg));
  return [x * c - y * s, x * s + y * c];
}

export function itemCorners(it) {
  const hw = it.w / 2, hd = it.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => {
    const [rx, ry] = rotPt(x, y, it.rot || 0);
    return [it.x + rx, it.y + ry];
  });
}
export const itemBox = (it) => bbox(itemCorners(it));

// Colisão entre retângulos girados (eixos separadores)
export function polysOverlap(A, B, eps = 0.6) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      const ax = -(q[1] - p[1]), ay = q[0] - p[0];
      const l = Math.hypot(ax, ay) || 1;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const [x, y] of A) { const v = (x * ax + y * ay) / l; aMin = Math.min(aMin, v); aMax = Math.max(aMax, v); }
      for (const [x, y] of B) { const v = (x * ax + y * ay) / l; bMin = Math.min(bMin, v); bMax = Math.max(bMax, v); }
      if (Math.min(aMax, bMax) - Math.max(aMin, bMin) < eps) return false;
    }
  }
  return true;
}

// Distância de um raio até um segmento (Infinity se não cruza)
export function raySeg(ox, oy, dx, dy, a, b) {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return Infinity;
  const wx = a[0] - ox, wy = a[1] - oy;
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * dy - wy * dx) / den;
  if (u < -1e-6 || u > 1 + 1e-6 || t < -0.5) return Infinity;
  return Math.max(0, t);
}

export function projectOnSeg(px, py, a, b) {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const l2 = ex * ex + ey * ey || 1;
  const t = ((px - a[0]) * ex + (py - a[1]) * ey) / l2;
  const tc = clamp(t, 0, 1);
  const cx = a[0] + ex * tc, cy = a[1] + ey * tc;
  return { t: tc, dist: Math.hypot(px - cx, py - cy), along: tc * Math.sqrt(l2) };
}

// ---------- formatação (pt-BR) ----------
const nf = (max) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max });
const nf2 = nf(2), nf1 = nf(1), nf0 = nf(0);
export function fmtLen(cm, unit = 'cm') {
  if (unit === 'm') return nf2.format(cm / 100) + ' m';
  return nf0.format(Math.round(cm)) + ' cm';
}
export const fmtNum = (v) => nf1.format(v);
export const fmtArea = (cm2) => nf2.format(cm2 / 10000) + ' m²';
export const fmtMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
export const parseNum = (s) => {
  if (typeof s === 'number') return s;
  const v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
