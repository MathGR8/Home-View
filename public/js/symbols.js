// Desenhos dos móveis vistos de cima, em coordenadas locais (centro = 0,0).
// w = largura (eixo x), d = profundidade (eixo y). O "fundo" do móvel fica em -y (encostado na parede).
// Classes (estilo dentro do SVG): b = corpo, l = linha de detalhe, f = preenchimento claro, k = preenchimento escuro.

const n = (v) => Math.round(v * 10) / 10;
const R = (x, y, w, h, cls = 'f', rx = 0) => `<rect class="${cls}" x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}"${rx ? ` rx="${n(rx)}"` : ''}/>`;
const E = (cx, cy, rx, ry, cls = 'f') => `<ellipse class="${cls}" cx="${n(cx)}" cy="${n(cy)}" rx="${n(Math.max(0, rx))}" ry="${n(Math.max(0, ry))}"/>`;
const L = (x1, y1, x2, y2, cls = 'l') => `<line class="${cls}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`;
const P = (d, cls = 'l') => `<path class="${cls}" d="${d}"/>`;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

export function bodyShape(it, cls = 'b') {
  const hw = it.w / 2, hd = it.d / 2;
  if (it.shape === 'round') return E(0, 0, hw, hd, cls);
  if (it.sym === 'sofaL' || it.sym === 'deskL') {
    const a = lArm(it);
    return P(`M${n(-hw)},${n(-hd)}H${n(hw)}V${n(hd)}H${n(hw - a.cw)}V${n(-hd + a.sd)}H${n(-hw)}Z`, cls);
  }
  const rx = it.sym === 'bathtub' ? Math.min(it.w, it.d) * 0.18 : it.sym === 'suitcase' ? 6 : Math.min(it.w, it.d) * 0.03;
  return R(-hw, -hd, it.w, it.d, cls, rx);
}

function lArm(it) {
  if (it.sym === 'deskL') return { cw: cl(it.w * 0.4, 40, 80), sd: cl(it.d * 0.4, 40, 80) };
  return { cw: cl(it.w * 0.36, 60, 100), sd: cl(it.d * 0.6, 60, 100) };
}

export function symbolDetails(it) {
  const w = it.w, d = it.d, hw = w / 2, hd = d / 2, m = Math.min(w, d);
  switch (it.sym) {
    case 'bed': case 'crib': {
      const hb = cl(d * 0.06, 4, 12);
      let s = R(-hw, -hd, w, hb, 'k');
      if (it.sym === 'crib') {
        s += R(-hw + 4, -hd + 4, w - 8, d - 8, 'l');
        for (let x = -hw + 8; x < hw - 4; x += 8) s += L(x, -hd + 2, x, -hd + 6) + L(x, hd - 6, x, hd - 2);
        return s;
      }
      const np = w >= 120 ? 2 : 1, gap = 6, ph = cl(d * 0.13, 18, 32);
      const pw = (w - gap * (np + 1)) / np;
      for (let i = 0; i < np; i++) s += R(-hw + gap + i * (pw + gap), -hd + hb + 5, pw, ph, 'f', 6);
      const by = -hd + hb + ph + 14;
      s += R(-hw + 2, by, w - 4, hd - by - 2, 'f', 3);
      s += L(-hw + 2, by + 14, hw - 2, by + 14);
      return s;
    }
    case 'sofa': case 'armchair': {
      const bd = cl(d * 0.24, 12, 26), aw = cl(w * 0.1, 10, 22);
      let s = R(-hw, -hd, w, bd, 'k', 4) + R(-hw, -hd, aw, d, 'k', 4) + R(hw - aw, -hd, aw, d, 'k', 4);
      const sw = w - 2 * aw, nc = it.sym === 'armchair' ? 1 : Math.max(1, Math.round(sw / 65));
      const cw = sw / nc;
      for (let i = 0; i < nc; i++) s += R(-hw + aw + i * cw + 1.5, -hd + bd + 1.5, cw - 3, d - bd - 4, 'f', 5);
      return s;
    }
    case 'sofaL': {
      const { cw, sd } = lArm(it), bd = cl(sd * 0.26, 12, 24), aw = 14;
      let s = R(-hw, -hd, w, bd, 'k', 4) + R(-hw, -hd, aw, sd, 'k', 4) + R(hw - bd, -hd, bd, d, 'k', 4);
      const seatW = w - aw - bd, nc = Math.max(1, Math.round((seatW - cw + bd) / 65));
      const sw = (seatW - (cw - bd)) / nc;
      for (let i = 0; i < nc; i++) s += R(-hw + aw + i * sw + 1.5, -hd + bd + 1.5, sw - 3, sd - bd - 3, 'f', 5);
      s += R(hw - cw + 1.5, -hd + bd + 1.5, cw - bd - 3, d - bd - 4, 'f', 5);
      return s;
    }
    case 'table': case 'desk': return R(-hw + 3, -hd + 3, w - 6, d - 6, 'l', 2) + (it.sym === 'desk' ? R(hw - Math.min(45, w * 0.35) - 3, -hd + 3, Math.min(45, w * 0.35), d - 6, 'l') : '');
    case 'deskL': { const { cw, sd } = lArm(it); return L(hw - cw, -hd + sd, hw - cw, -hd + 3) + L(-hw + 3, -hd + sd - 3, hw - cw, -hd + sd - 3); }
    case 'roundtable': return E(0, 0, hw * 0.88, hd * 0.88, 'l');
    case 'stool': return E(0, 0, hw * 0.6, hd * 0.6, 'l');
    case 'chair': { const bd = cl(d * 0.18, 5, 10); return R(-hw, -hd, w, bd, 'k', 2) + R(-hw + 3, -hd + bd + 2, w - 6, d - bd - 5, 'f', 3); }
    case 'officechair': return P(`M${n(-hw * 0.8)},${n(-hd * 0.45)} A${n(hw * 0.9)},${n(hd * 0.9)} 0 0 1 ${n(hw * 0.8)},${n(-hd * 0.45)}`, 'l') + E(0, hd * 0.1, hw * 0.6, hd * 0.55, 'f');
    case 'cabinet': case 'counter': {
      let s = L(-hw + 2, hd - 4, hw - 2, hd - 4);
      const nd = Math.max(1, Math.round(w / 45));
      for (let i = 1; i < nd; i++) { const x = -hw + (w * i) / nd; s += L(x, -hd + 2, x, hd - 4, 'l dash'); }
      return s;
    }
    case 'wardrobe': {
      let s = L(-hw + 2, hd - 5, hw - 2, hd - 5) + L(-hw + 6, 0, hw - 6, 0, 'l dash');
      const nd = Math.max(2, Math.round(w / 50));
      for (let i = 1; i < nd; i++) { const x = -hw + (w * i) / nd; s += L(x, hd - 5, x, hd); }
      for (let x = -hw + 15; x < hw - 10; x += 22) s += L(x - 5, -6, x + 5, 6);
      return s;
    }
    case 'drawers': { let s = ''; for (let i = 1; i < 4; i++) s += L(-hw + 3, -hd + (d * i) / 4, hw - 3, -hd + (d * i) / 4); return s; }
    case 'shelf': { let s = ''; const nd = Math.max(1, Math.round(w / 40)); for (let i = 1; i < nd; i++) { const x = -hw + (w * i) / nd; s += L(x, -hd + 1, x, hd - 1); } return s + L(-hw + 1, hd - 3, hw - 1, hd - 3, 'l dash'); }
    case 'tv': return '';
    case 'fridge': return L(-hw + 2, hd - 6, hw - 2, hd - 6) + R(-hw + w * 0.2, hd - 5, w * 0.6, 3, 'k', 1) + L(0, -hd + 3, 0, hd - 8, 'l dash');
    case 'stove': {
      const r = m * 0.15, ox = w * 0.24, oy = d * 0.2;
      let s = R(-hw, hd - 8, w, 8, 'k');
      const pts = w > 70 ? [[-ox, -oy], [ox, -oy], [-ox, oy * 0.8], [ox, oy * 0.8], [0, 0]] : [[-ox, -oy], [ox, -oy], [-ox, oy * 0.8], [ox, oy * 0.8]];
      for (const [x, y] of pts) s += E(x, y - 3, r, r, 'l') + E(x, y - 3, r * 0.45, r * 0.45, 'l');
      return s;
    }
    case 'sink': {
      const bw = Math.min(w * 0.45, 55), bh = d * 0.6;
      return R(-bw / 2, -hd + d * 0.18, bw, bh, 'f', 6) + E(0, -hd + d * 0.18 + bh / 2, 3, 3, 'k') + E(0, -hd + 6, 3, 3, 'k') + L(-hw + 2, hd - 4, hw - 2, hd - 4);
    }
    case 'washer': return E(0, d * 0.05, m * 0.34, m * 0.34, 'l') + E(0, d * 0.05, m * 0.22, m * 0.22, 'f') + R(-hw + 3, -hd + 3, w - 6, d * 0.15, 'k', 2);
    case 'toilet': { const th = d * 0.27; return R(-hw, -hd, w, th, 'f', 3) + E(0, -hd + th + (d - th) * 0.47, hw * 0.88, (d - th) * 0.47, 'f') + E(0, -hd + th + (d - th) * 0.5, hw * 0.55, (d - th) * 0.32, 'l'); }
    case 'basin': return E(0, d * 0.06, w * 0.33, d * 0.3, 'f') + E(0, -hd + 7, 2.5, 2.5, 'k');
    case 'shower': return L(-hw + 4, -hd + 4, hw - 4, hd - 4) + L(hw - 4, -hd + 4, -hw + 4, hd - 4) + E(0, 0, 4, 4, 'f');
    case 'bathtub': { const ins = 8; return R(-hw + ins, -hd + ins, w - 2 * ins, d - 2 * ins, 'f', m * 0.25) + E(-hw + ins + 12, 0, 3, 3, 'k'); }
    case 'rug': {
      let s = R(-hw + 4, -hd + 4, w - 8, d - 8, 'l dash');
      for (let y = -hd + 6; y < hd - 4; y += 8) s += L(-hw - 4, y, -hw, y) + L(hw, y, hw + 4, y);
      return s;
    }
    case 'lamp': return E(0, 0, hw * 0.55, hd * 0.55, 'f') + L(-hw * 0.8, 0, hw * 0.8, 0) + L(0, -hd * 0.8, 0, hd * 0.8);
    case 'plant': {
      let s = '';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s += `<ellipse class="f leaf" cx="${n(Math.cos(a) * hw * 0.45)}" cy="${n(Math.sin(a) * hd * 0.45)}" rx="${n(hw * 0.42)}" ry="${n(hd * 0.2)}" transform="rotate(${n((a * 180) / Math.PI)} ${n(Math.cos(a) * hw * 0.45)} ${n(Math.sin(a) * hd * 0.45)})"/>`;
      }
      return s + E(0, 0, hw * 0.22, hd * 0.22, 'k');
    }
    case 'box': return L(-hw, -hd, hw, hd) + L(hw, -hd, -hw, hd) + R(-hw, -3, w, 6, 'k');
    case 'suitcase': return R(-w * 0.15, -hd - 4, w * 0.3, 5, 'k', 2) + L(-hw * 0.5, -hd + 3, -hw * 0.5, hd - 3) + L(hw * 0.5, -hd + 3, hw * 0.5, hd - 3);
    case 'ac': return L(-hw + 3, hd - 5, hw - 3, hd - 5) + L(-hw + 3, hd - 9, hw - 3, hd - 9);
    case 'bike': return L(-hw + 8, 0, hw - 8, 0, 'l thick') + E(-hw + 30, 0, 28, 3, 'k') + E(hw - 30, 0, 28, 3, 'k') + L(hw - 40, -hd + 6, hw - 40, hd - 6, 'l thick');
    case 'piano': {
      let s = R(-hw + 2, hd - d * 0.45, w - 4, d * 0.45 - 2, 'f');
      for (let x = -hw + 6; x < hw - 4; x += 4) s += L(x, hd - d * 0.45, x, hd - 2);
      return s;
    }
    case 'petbed': return E(0, 0, hw * 0.7, hd * 0.65, 'f');
    case 'rack': { let s = ''; for (let y = -hd + 8; y < hd - 4; y += 9) s += L(-hw + 4, y, hw - 4, y); return s; }
    case 'pillar': return L(-hw, -hd, hw, hd) + L(hw, -hd, -hw, hd);
    default: return '';
  }
}

// Miniatura para o catálogo
export function previewSVG(def, size = 56) {
  const it = { w: def.w, d: def.d, sym: def.sym, shape: def.shape || 'rect' };
  const pad = Math.max(def.w, def.d) * 0.08 + 4;
  const vb = `${-def.w / 2 - pad} ${-def.d / 2 - pad} ${def.w + pad * 2} ${def.d + pad * 2}`;
  return `<svg class="prev" viewBox="${vb}" width="${size}" height="${size}" style="--c:${def.color}">${bodyShape(it)}${symbolDetails(it)}</svg>`;
}

// Estilo dos desenhos (vai junto no SVG exportado)
export const SYM_CSS = `
.b{fill:var(--c,#a7b1bd);stroke:rgba(20,24,30,.55);stroke-width:1.2;vector-effect:non-scaling-stroke}
.f{fill:rgba(255,255,255,.5);stroke:rgba(20,24,30,.28);stroke-width:1;vector-effect:non-scaling-stroke}
.k{fill:rgba(20,24,30,.16);stroke:rgba(20,24,30,.25);stroke-width:.8;vector-effect:non-scaling-stroke}
.l{fill:none;stroke:rgba(20,24,30,.38);stroke-width:1;vector-effect:non-scaling-stroke}
.l.dash{stroke-dasharray:4 3}
.l.thick{stroke-width:2.2}
.leaf{fill:rgba(255,255,255,.22)}
`;
