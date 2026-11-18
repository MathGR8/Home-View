// Estruturas: mezanino (piso suspenso) e escadas. Cálculos usados pela planta, pelo 3D e pela caminhada.
// Medidas em cm. Escada: começa embaixo na frente (+y local) e chega em cima no fundo (-y local).
import { rotPt, deg, clamp } from './geometry.js';

export const isMezz = (it) => it?.sym === 'mezz';
export const isStair = (it) => it?.sym === 'stair';
export const isStruct = (it) => it?.layer === 'struct';

// Campos extras que os itens de estrutura carregam (copiados do catálogo / Meus móveis)
export const STRUCT_KEYS = ['deck', 'thick', 'railH', 'rails', 'steps'];

export const STEEL_COLORS = ['#2b2f33', '#3c4650', '#6b7680', '#a3acb5', '#e9ecef', '#e0b13a', '#b8432f', '#2f5f8a'];
export const DECK_COLORS = ['#8b939c', '#5d6670', '#b08d6e', '#c9a874', '#bdbab4', '#d9d4ca', '#7a5c43', '#e9e4dc'];

export const toWorld = (it, x, y) => { const [rx, ry] = rotPt(x, y, it.rot || 0); return [it.x + rx, it.y + ry]; };
export const toLocal = (it, x, y) => rotPt(x - it.x, y - it.y, -(it.rot || 0));
const inside = (it, x, y, pad = 0) => { const [lx, ly] = toLocal(it, x, y); return Math.abs(lx) <= it.w / 2 + pad && Math.abs(ly) <= it.d / 2 + pad; };

// Degraus, espelho (altura de cada degrau), piso (profundidade) e inclinação
export function stairInfo(it) {
  const h = Math.max(1, +it.h || 1), d = Math.max(1, +it.d || 1);
  const n = it.steps > 0 ? Math.max(1, Math.round(it.steps)) : Math.max(2, Math.round(h / 18));
  const riser = h / n, tread = d / n;
  const blondel = 2 * riser + tread; // regra de Blondel: confortável entre 60 e 66 cm
  return { n, riser, tread, angle: deg(Math.atan2(h, d)), len: Math.hypot(h, d), blondel, comfy: blondel >= 59 && blondel <= 67 && riser <= 19.5 };
}

// Altura (topo do degrau) num ponto local da escada
export function stairTopAt(it, ly) {
  const { n, riser, tread } = stairInfo(it);
  const i = clamp(Math.floor((it.d / 2 - ly) / tread), 0, n - 1);
  return (i + 1) * riser;
}

// Altura do piso do mezanino que está embaixo de um ponto (0 se não houver)
export function mezzUnder(p, x, y) {
  let top = 0;
  for (const m of p.items) if (isMezz(m) && inside(m, x, y, 1) && m.h > top) top = m.h;
  return top;
}

// Altura do chão onde se pisa (caminhada no 3D): térreo, mezanino ou degrau, sem "subir pela parede"
export function floorAt(p, x, y, feet, climb = 50) {
  let best = 0;
  for (const it of p.items) {
    if (!isStruct(it) || !inside(it, x, y)) continue;
    let top;
    if (isMezz(it)) top = it.h;
    else if (isStair(it)) top = stairTopAt(it, toLocal(it, x, y)[1]);
    else continue;
    if (top <= feet + climb && top > best) best = top;
  }
  return best;
}

// Lados do mezanino em coordenadas locais (n = fundo, s = frente, w = esquerda, e = direita)
export function mezzSides(m) {
  const hw = m.w / 2, hd = m.d / 2;
  return { n: [[-hw, -hd], [hw, -hd]], e: [[hw, -hd], [hw, hd]], s: [[hw, hd], [-hw, hd]], w: [[-hw, hd], [-hw, -hd]] };
}
export const SIDE_NAMES = { n: 'Fundo', s: 'Frente', w: 'Esquerda', e: 'Direita' };

// Trechos de guarda-corpo (coordenadas locais do mezanino). Abre um vão onde uma escada chega,
// mesmo que ela chegue torta (em diagonal).
export function mezzRails(p, m) {
  const rails = m.rails ?? 'nsew';
  const out = [];
  const stairs = p.items.filter(isStair);
  for (const [k, [a, b]] of Object.entries(mezzSides(m))) {
    if (!rails.includes(k)) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const along = (q) => (q[0] - a[0]) * dir[0] + (q[1] - a[1]) * dir[1];
    const perp = (q) => Math.abs((q[0] - a[0]) * -dir[1] + (q[1] - a[1]) * dir[0]);
    const cuts = [];
    for (const s of stairs) {
      const topC = toLocal(m, ...toWorld(s, 0, -s.d / 2));
      if (perp(topC) > 45 || along(topC) < -s.w || along(topC) > len + s.w) continue;
      // pontos do contorno da escada que estão encostados neste lado
      const cs = [[-s.w / 2, -s.d / 2], [s.w / 2, -s.d / 2], [s.w / 2, s.d / 2], [-s.w / 2, s.d / 2]].map(([x, y]) => toLocal(m, ...toWorld(s, x, y)));
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < 4; i++) {
        const P = cs[i], Q = cs[(i + 1) % 4];
        for (let j = 0; j <= 24; j++) {
          const q = [P[0] + ((Q[0] - P[0]) * j) / 24, P[1] + ((Q[1] - P[1]) * j) / 24];
          if (perp(q) <= 22) { const t = along(q); lo = Math.min(lo, t); hi = Math.max(hi, t); }
        }
      }
      if (hi > lo) cuts.push([lo - 4, hi + 4]);
    }
    cuts.sort((u, v) => u[0] - v[0]);
    let pos = 0;
    const push = (u, v) => { if (v - u > 8) out.push({ side: k, a: [a[0] + dir[0] * u, a[1] + dir[1] * u], b: [a[0] + dir[0] * v, a[1] + dir[1] * v], len: v - u }); };
    for (const [u, v] of cuts) { if (u > pos) push(pos, Math.min(u, len)); pos = Math.max(pos, v); }
    if (pos < len) push(pos, len);
  }
  return out;
}

// Muda o comprimento da escada mantendo o topo no lugar (continua encostada no mezanino)
export function setStairRun(s, d) {
  const before = toWorld(s, 0, -s.d / 2);
  s.d = Math.max(10, Math.round(d));
  const after = toWorld(s, 0, -s.d / 2);
  s.x = Math.round((s.x + before[0] - after[0]) * 10) / 10;
  s.y = Math.round((s.y + before[1] - after[1]) * 10) / 10;
}

// Mezanino mais próximo do topo da escada (para encaixar)
export function nearestMezzEdge(p, s) {
  const top = toWorld(s, 0, -s.d / 2);
  let best = null;
  for (const m of p.items) {
    if (!isMezz(m)) continue;
    const loc = toLocal(m, ...top);
    // direção em que a escada sobe, vista pelo mezanino
    const u0 = toLocal(m, ...toWorld(s, 0, 0)), u1 = toLocal(m, ...toWorld(s, 0, -1));
    const up = [u1[0] - u0[0], u1[1] - u0[1]];
    for (const [k, [a, b]] of Object.entries(mezzSides(m))) {
      const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey || 1;
      const len0 = Math.sqrt(l2);
      // só serve o lado em que subir a escada leva para cima do mezanino
      if ((up[0] * -ey + up[1] * ex) / len0 < 0.2) continue;
      // mantém a escada inteira encostada no lado (não pendura na quina)
      const len = Math.sqrt(l2), m0 = Math.min(0.5, (s.w / 2) / len);
      const t = clamp(((loc[0] - a[0]) * ex + (loc[1] - a[1]) * ey) / l2, m0, 1 - m0);
      const q = [a[0] + ex * t, a[1] + ey * t];
      const dist = Math.hypot(loc[0] - q[0], loc[1] - q[1]);
      if (!best || dist < best.dist) best = { m, side: k, dist, point: toWorld(m, q[0], q[1]), top };
    }
  }
  return best;
}
