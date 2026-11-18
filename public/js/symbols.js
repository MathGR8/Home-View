// Desenhos dos móveis vistos de cima, em coordenadas locais (centro = 0,0).
// w = largura (eixo x), d = profundidade (eixo y). O "fundo" do móvel fica em -y (encostado na parede).
// Classes (estilo dentro do SVG): b = corpo, l = linha de detalhe, f = preenchimento claro, k = preenchimento escuro.

const n = (v) => Math.round(v * 10) / 10;
const n1 = n;
const R = (x, y, w, h, cls = 'f', rx = 0) => `<rect class="${cls}" x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}"${rx ? ` rx="${n(rx)}"` : ''}/>`;
const E = (cx, cy, rx, ry, cls = 'f') => `<ellipse class="${cls}" cx="${n(cx)}" cy="${n(cy)}" rx="${n(Math.max(0, rx))}" ry="${n(Math.max(0, ry))}"/>`;
const L = (x1, y1, x2, y2, cls = 'l') => `<line class="${cls}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`;
const P = (d, cls = 'l') => `<path class="${cls}" d="${d}"/>`;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
import { stairInfo, mezzCols, fenceBars, fencePosts, gateLines } from './struct.js';
export { mezzCols };

// Elipse como subcaminho (para juntar várias formas num corpo só)
const EP = (cx, cy, rx, ry) => `M${n(cx - rx)},${n(cy)}a${n(rx)},${n(ry)} 0 1,0 ${n(2 * rx)},0a${n(rx)},${n(ry)} 0 1,0 ${n(-2 * rx)},0Z`;

export function bodyShape(it, cls = 'b') {
  const hw = it.w / 2, hd = it.d / 2;
  if (it.sym === 'cat') return P(EP(0, -it.d * 0.1, hw * 0.82, hd * 0.6) + EP(0, hd * 0.6, hw * 0.68, hw * 0.68) + `M${n(-hw * 0.62)},${n(hd * 0.52)}L${n(-hw * 0.5)},${n(hd * 0.98)}L${n(-hw * 0.12)},${n(hd * 0.7)}ZM${n(hw * 0.62)},${n(hd * 0.52)}L${n(hw * 0.5)},${n(hd * 0.98)}L${n(hw * 0.12)},${n(hd * 0.7)}Z`, cls);
  if (it.sym === 'rabbit') return P(EP(0, -it.d * 0.12, hw * 0.92, hd * 0.6) + EP(0, hd * 0.55, hw * 0.6, hw * 0.62), cls);
  if (it.sym === 'person') return P(EP(0, 0, hw, hd * 0.78) + EP(0, hd * 0.05, Math.min(hd * 0.82, hw * 0.42), Math.min(hd * 0.82, hw * 0.42)), cls);
  if (it.sym === 'car') return R(-hw, -hd, it.w, it.d, cls, Math.min(it.w * 0.24, 45));
  if (it.sym === 'moto') return P(EP(0, 0, hw * 0.55, hd), cls);
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
    case 'mezz': {
      // piso em chapa/grade: linhas finas na direção do lado menor + pilares
      let s = '';
      const sp = cl(m / 12, 12, 40);
      if (w >= d) for (let x = -hw + sp; x < hw - 2; x += sp) s += L(x, -hd + 2, x, hd - 2, 'l faint');
      else for (let y = -hd + sp; y < hd - 2; y += sp) s += L(-hw + 2, y, hw - 2, y, 'l faint');
      s += R(-hw + 3, -hd + 3, w - 6, d - 6, 'l dash');
      const c = cl(m * 0.04, 6, 12);
      for (const [x, y] of mezzCols(it)) s += R(x - c / 2, y - c / 2, c, c, 'k col');
      return s;
    }
    case 'stair': {
      const { n, tread } = stairInfo(it);
      let s = L(-hw + 3, -hd, -hw + 3, hd, 'l thick') + L(hw - 3, -hd, hw - 3, hd, 'l thick');
      for (let i = 1; i < n; i++) { const y = hd - i * tread; s += L(-hw + 3, y, hw - 3, y); }
      // seta "sobe": do pé (frente) até o topo (fundo)
      const r = cl(w * 0.06, 2.5, 6), ah = cl(w * 0.18, 6, 16);
      s += E(0, hd - tread / 2, r, r, 'k') + L(0, hd - tread / 2, 0, -hd + 4, 'l arrow');
      s += P(`M${n1(-ah * 0.6)},${n1(-hd + 4 + ah)}L0,${n1(-hd + 4)}L${n1(ah * 0.6)},${n1(-hd + 4 + ah)}`, 'l arrow');
      return s;
    }
    case 'wallseg': {
      if (it.h2 === undefined || Math.abs(it.h2 - it.h) < 1) return L(-hw + 2, 0, hw - 2, 0, 'l faint');
      // cunha: grossa no lado mais alto
      const hi = it.h >= it.h2 ? -1 : 1;
      return P(`M${n(hi * hw)},${n(-hd * 0.8)}L${n(-hi * hw)},0L${n(hi * hw)},${n(hd * 0.8)}Z`, 'k');
    }
    case 'fence': {
      let s = L(-hw, 0, hw, 0, 'l');
      const c = cl(d * 1.4, 4, 8);
      for (const x of fencePosts(w)) s += R(x - c / 2, -c / 2, c, c, 'k col');
      return s;
    }
    case 'gate': {
      let s = L(-hw, 0, hw, 0, 'l thick');
      if ((it.style || 'panel') === 'panel') { const sw = cl(it.h * 0.35, 30, 90); s += R(-hw, hd, w, sw, 'l dash'); }
      return s;
    }
    case 'ground': return groundDetails(it);
    case 'car': return carTop(it);
    case 'moto': return L(0, -hd + 6, 0, hd - 6, 'l thick') + R(-hw * 0.15, -hd + 2, hw * 0.3, d * 0.14, 'k', 3) + R(-hw * 0.15, hd - 2 - d * 0.14, hw * 0.3, d * 0.14, 'k', 3) + L(-hw + 4, -hd + d * 0.2, hw - 4, -hd + d * 0.2, 'l thick') + R(-hw * 0.4, -d * 0.05, hw * 0.8, d * 0.3, 'f', 6);
    case 'monitor': return R(-hw, -hd, w, Math.max(2, d * 0.22), 'k', 1) + E(0, d * 0.12, w * 0.14, d * 0.3, 'l');
    case 'pc': return R(-hw + 2, -hd + 2, w - 4, d - 4, 'l', 2) + L(-hw + 3, hd - 4, hw - 3, hd - 4) + E(0, hd - 8, 2, 2, 'k');
    case 'laptop': return R(-hw, -hd, w, Math.max(2, d * 0.08), 'k', 1) + R(-hw + 3, -hd + d * 0.2, w - 6, d * 0.42, 'l', 1) + R(-w * 0.15, hd - d * 0.3, w * 0.3, d * 0.2, 'f', 1);
    case 'keyboard': { const kw = w * 0.74; let s = R(-hw, -hd, kw, d, 'f', 2); for (let i = 1; i < 4; i++) s += L(-hw + 2, -hd + (d * i) / 4, -hw + kw - 2, -hd + (d * i) / 4, 'l faint'); return s + E(hw - w * 0.08, 0, w * 0.05, d * 0.32, 'k'); }
    case 'printer': return R(-hw + 4, -hd, w - 8, d * 0.25, 'k', 2) + R(-hw * 0.6, hd - d * 0.3, w * 0.6, d * 0.26, 'f', 1);
    case 'ceilinglamp': return E(0, 0, hw * 0.6, hd * 0.6, 'f') + E(0, 0, 14, 14, 'hit0');
    case 'bulb': return E(0, 0, hw * 0.75, hd * 0.75, 'f') + L(-hw * 0.6, -hd * 0.6, hw * 0.6, hd * 0.6) + L(hw * 0.6, -hd * 0.6, -hw * 0.6, hd * 0.6) + E(0, 0, 14, 14, 'hit0');
    case 'pendant': return E(0, 0, hw * 0.55, hd * 0.55, 'f') + E(0, 0, hw * 0.18, hd * 0.18, 'k');
    case 'indlight': {
      const nb = Math.max(1, Math.round(it.bulbs || 4));
      let s = L(-hw + 2, 0, hw - 2, 0, 'l thick');
      const r = cl(Math.min(d * 0.5, w / nb / 2.4), 3, 12);
      for (let i = 0; i < nb; i++) { const x = -hw + (w * (i + 0.5)) / nb; s += E(x, 0, r, r, 'f') + L(x - r * 0.6, -r * 0.6, x + r * 0.6, r * 0.6) + L(x + r * 0.6, -r * 0.6, x - r * 0.6, r * 0.6); }
      return s;
    }
    case 'socket': return P(`M${n(-5)},${n(hd)}L5,${n(hd)}L0,${n(hd + 8)}Z`, 'k col') + E(0, hd + 3, 12, 12, 'hit0');
    case 'switch': return E(0, hd + 4, 3.5, 3.5, 'k col') + L(0, hd + 4, 5, hd + 9, 'l thick') + E(0, hd + 3, 12, 12, 'hit0');
    case 'cat': {
      let s = P(`M0,${n(-hd * 0.68)}Q${n(hw * 1.4)},${n(-hd * 0.9)} ${n(hw * 0.7)},${n(-hd * 1.25)}`, 'l tail');
      if (it.coat === 'frajola') s += E(0, hd * 0.25, hw * 0.4, hd * 0.2, 'w') + E(0, hd * 0.78, hw * 0.3, hw * 0.24, 'w');
      else if (it.coat === 'rajada' || !it.coat) for (const f of [-0.42, -0.22, -0.02, 0.18]) s += L(-hw * 0.62, d * f, hw * 0.62, d * f, 'k stripe');
      return s + E(-hw * 0.24, hd * 0.68, 1.4, 1.4, 'k col') + E(hw * 0.24, hd * 0.68, 1.4, 1.4, 'k col');
    }
    case 'rabbit': return E(-hw * 0.22, hd * 0.02, hw * 0.16, hd * 0.42, 'k') + E(hw * 0.22, hd * 0.02, hw * 0.16, hd * 0.42, 'k') + E(0, -hd * 0.78, hw * 0.24, hw * 0.24, 'w');
    case 'litter': return R(-hw + 3, -hd + 3, w - 6, d - 6, 'sand', 3) + E(-w * 0.12, d * 0.05, 1.5, 1.5, 'k') + E(w * 0.15, -d * 0.1, 1.5, 1.5, 'k') + E(w * 0.02, d * 0.2, 1.5, 1.5, 'k');
    case 'person': {
      const hr = Math.min(hd * 0.82, hw * 0.42);
      return E(0, hd * 0.05, hr, hr, 'skin') + P(`M${n(-hr)},${n(hd * 0.05)}A${n(hr)},${n(hr)} 0 0 1 ${n(hr)},${n(hd * 0.05)}Z`, it.gender === 'f' ? 'hair' : 'hair') + P(`M${n(-hr * 0.35)},${n(hd * 0.05 + hr * 0.9)}L0,${n(hd * 0.05 + hr * 1.35)}L${n(hr * 0.35)},${n(hd * 0.05 + hr * 0.9)}`, 'l');
    }
    default: return '';
  }
}

// Carro visto de cima (frente em -y): para-brisa, teto, vidro de trás, rodas e retrovisores
function carTop(it) {
  const w = it.w, d = it.d, hw = w / 2, hd = d / 2, model = it.model || 'hatch';
  const fr = { hatch: [0.26, 0.37, 0.8, 0.9], sedan: [0.27, 0.38, 0.68, 0.76], suv: [0.24, 0.33, 0.84, 0.92] }[model] || [0.26, 0.37, 0.8, 0.9];
  const y = (f) => -hd + d * f, iw = hw * 0.8, tw = hw * 0.7;
  let s = '';
  // rodas
  for (const sx of [-1, 1]) for (const fy of [0.17, 0.82]) s += R(sx * hw - (sx > 0 ? 7 : -1), y(fy) - d * 0.06, 6, d * 0.12, 'k col', 2);
  s += P(`M${n(-iw)},${n(y(fr[0]))}L${n(iw)},${n(y(fr[0]))}L${n(tw)},${n(y(fr[1]))}L${n(-tw)},${n(y(fr[1]))}Z`, 'f');
  s += R(-tw, y(fr[1]), tw * 2, d * (fr[2] - fr[1]), 'l', 6);
  s += P(`M${n(-tw)},${n(y(fr[2]))}L${n(tw)},${n(y(fr[2]))}L${n(iw * 0.95)},${n(y(fr[3]))}L${n(-iw * 0.95)},${n(y(fr[3]))}Z`, 'f');
  s += L(-hw + 8, y(0.12), hw - 8, y(0.12), 'l faint');
  for (const sx of [-1, 1]) s += R(sx > 0 ? hw - 1 : -hw - 9, y(fr[0]) - 2, 10, 6, 'k', 2);
  return s;
}

// Desenho do piso externo (grama, concreto, cerâmico, deck, pedrisco, terra)
function groundDetails(it) {
  const w = it.w, d = it.d, hw = w / 2, hd = d / 2;
  const tex = it.tex || 'grass';
  let s = '';
  const many = (base) => Math.max(base, Math.sqrt((w * d) / 260));
  if (tex === 'cement') return s;
  if (tex === 'tiles' || tex === 'concrete' || tex === 'porcelain') {
    const sp = tex === 'tiles' ? Math.max(60, many(30)) : tex === 'porcelain' ? Math.max(90, many(45)) : Math.max(100, many(50));
    for (let x = -hw + sp; x < hw - 1; x += sp) s += L(x, -hd, x, hd, tex === 'tiles' ? 'l faint' : 'l faint dash');
    for (let y = -hd + sp; y < hd - 1; y += sp) s += L(-hw, y, hw, y, tex === 'tiles' ? 'l faint' : 'l faint dash');
  } else if (tex === 'deck' || tex === 'wood') {
    const sp = Math.max(tex === 'wood' ? 18 : 14, many(8));
    for (let y = -hd + sp; y < hd - 1; y += sp) s += L(-hw, y, hw, y, 'l faint');
  } else {
    const sp = many(tex === 'grass' ? 24 : 18);
    let k = 0;
    for (let y = -hd + sp / 2; y < hd; y += sp) for (let x = -hw + sp / 2 + ((k++ % 2) * sp) / 2; x < hw; x += sp) {
      if (tex === 'grass') s += P(`M${n(x - 3)},${n(y + 3)}L${n(x)},${n(y - 3)}L${n(x + 3)},${n(y + 3)}`, 'l faint');
      else s += E(x, y, tex === 'soil' ? 1.4 : 2.4, tex === 'soil' ? 1.4 : 1.8, 'k faint');
    }
  }
  return s;
}

// ---------- vista de frente (miniaturas do catálogo de muros, grades, pessoas, luz, pets) ----------
const FRONT = new Set(['wallseg', 'fence', 'gate', 'person', 'indlight', 'pendant', 'bulb', 'socket', 'switch', 'cat', 'rabbit', 'car', 'moto', 'monitor', 'pc', 'laptop', 'printer', 'ceilinglamp']);
export function frontSVG(def, size = 56) {
  const w = def.w, h = Math.max(1, def.h), d = def.d;
  const sym = def.sym;
  const side = sym === 'cat' || sym === 'rabbit' || sym === 'car' || sym === 'moto' || sym === 'pc' || sym === 'laptop';
  const W = side ? d : w;
  let body = '', H = h;
  const Y = (y) => n(-y);
  if (sym === 'wallseg') {
    const h2 = def.h2 ?? h; H = Math.max(h, h2);
    body = `<path class="b" d="M${n(-w / 2)},0L${n(w / 2)},0L${n(w / 2)},${Y(h2)}L${n(-w / 2)},${Y(h)}Z"/>`;
  } else if (sym === 'fence') {
    body = `<g class="bar">` + fenceBars(w, h, def.pattern).map(([a, b, c, e]) => `<line x1="${n(a)}" y1="${Y(b)}" x2="${n(c)}" y2="${Y(e)}"/>`).join('') + `</g>`;
    body += `<path class="frame" d="M${n(-w / 2)},${Y(h - 2)}H${n(w / 2)}M${n(-w / 2)},${Y(6)}H${n(w / 2)}${fencePosts(w).map((x) => `M${n(x)},0V${Y(h)}`).join('')}"/>`;
  } else if (sym === 'gate') {
    const st = def.style || 'panel';
    body = st === 'bars' ? '' : `<rect class="b" x="${n(-w / 2)}" y="${Y(h)}" width="${n(w)}" height="${n(h)}"/>`;
    body += `<g class="bar">` + gateLines(w, h, st).map((v) => (st === 'panel' ? `<line x1="${n(-w / 2)}" y1="${Y(v)}" x2="${n(w / 2)}" y2="${Y(v)}"/>` : `<line x1="${n(v)}" y1="${Y(4)}" x2="${n(v)}" y2="${Y(h - 4)}"/>`)).join('') + `</g>`;
    body += `<rect class="frame" x="${n(-w / 2)}" y="${Y(h)}" width="${n(w)}" height="${n(h)}" fill="none"/>`;
  } else if (sym === 'person') {
    const hr = h * 0.065, sw = w / 2;
    body = `<ellipse class="skin" cx="0" cy="${Y(h - hr)}" rx="${n(hr * 0.85)}" ry="${n(hr)}"/>`;
    body += `<path class="b" d="M${n(-sw)},${Y(h * 0.8)}Q0,${Y(h * 0.84)} ${n(sw)},${Y(h * 0.8)}L${n(sw * 0.75)},${Y(h * 0.5)}L${n(-sw * 0.75)},${Y(h * 0.5)}Z"/>`;
    if (def.gender === 'f') body += `<path class="b" d="M${n(-sw * 0.75)},${Y(h * 0.5)}L${n(sw * 0.75)},${Y(h * 0.5)}L${n(sw * 0.95)},${Y(h * 0.3)}L${n(-sw * 0.95)},${Y(h * 0.3)}Z"/>`;
    body += `<path class="pants" d="M${n(-sw * 0.7)},${Y(h * 0.5)}L${n(-sw * 0.08)},${Y(h * 0.5)}L${n(-sw * 0.12)},0L${n(-sw * 0.5)},0ZM${n(sw * 0.7)},${Y(h * 0.5)}L${n(sw * 0.08)},${Y(h * 0.5)}L${n(sw * 0.12)},0L${n(sw * 0.5)},0Z"/>`;
  } else if (sym === 'indlight' || sym === 'pendant' || sym === 'bulb') {
    const nb = sym === 'indlight' ? Math.max(1, Math.round(def.bulbs || 4)) : 1;
    const r = sym === 'indlight' ? Math.min(w / nb / 2.6, 14) : w / 2;
    H = h + 4;
    if (sym === 'indlight') body += `<rect class="frame2" x="${n(-w / 2)}" y="${Y(h + 3)}" width="${n(w)}" height="3"/>`;
    for (let i = 0; i < nb; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / nb;
      body += `<line class="frame" x1="${n(x)}" y1="${Y(h)}" x2="${n(x)}" y2="${Y(r * 1.1)}"/>`;
      body += sym === 'bulb' ? `<circle class="glow" cx="${n(x)}" cy="${Y(r)}" r="${n(r)}"/>` : `<path class="b" d="M${n(x - r)},${Y(r * 0.5)}Q${n(x)},${Y(r * 2)} ${n(x + r)},${Y(r * 0.5)}Z"/><circle class="glow" cx="${n(x)}" cy="${Y(r * 0.42)}" r="${n(r * 0.3)}"/>`;
    }
  } else if (sym === 'socket' || sym === 'switch') {
    body = `<rect class="b" x="${n(-w / 2)}" y="${Y(h)}" width="${n(w)}" height="${n(h)}" rx="1"/>`;
    if (sym === 'socket') body += `<circle class="frame" cx="0" cy="${Y(h / 2)}" r="${n(Math.min(w, h) * 0.3)}" fill="none"/><circle class="dot" cx="${n(-w * 0.1)}" cy="${Y(h / 2 + 0.6)}" r=".5"/><circle class="dot" cx="${n(w * 0.1)}" cy="${Y(h / 2 + 0.6)}" r=".5"/><circle class="dot" cx="0" cy="${Y(h / 2 - 1)}" r=".5"/>`;
    else body += `<rect class="frame" x="${n(-w * 0.18)}" y="${Y(h * 0.68)}" width="${n(w * 0.36)}" height="${n(h * 0.36)}" fill="none"/>`;
  } else if (sym === 'car') {
    const L2 = d / 2, m = def.model || 'hatch';
    // perfil: frente à direita
    const roof = { hatch: [-0.86, 0.2, 0.95], sedan: [-0.55, 0.15, 0.92], suv: [-0.9, 0.12, 0.98] }[m] || [-0.86, 0.2, 0.95];
    const hb = h * 0.55, wr = Math.min(h * 0.22, d * 0.08);
    body = `<path class="b" d="M${n(-L2)},${Y(wr * 0.6)}L${n(-L2)},${Y(hb)}L${n(L2 * roof[0])},${Y(hb)}L${n(L2 * (roof[0] + 0.12))},${Y(h * roof[2])}L${n(L2 * roof[1])},${Y(h * roof[2])}L${n(L2 * 0.5)},${Y(hb)}L${n(L2)},${Y(hb * 0.85)}L${n(L2)},${Y(wr * 0.6)}Z"/>`;
    body += `<path class="glass" d="M${n(L2 * roof[0] + 8)},${Y(hb + 4)}L${n(L2 * (roof[0] + 0.12) + 4)},${Y(h * roof[2] - 6)}L${n(L2 * roof[1] - 4)},${Y(h * roof[2] - 6)}L${n(L2 * 0.5 - 10)},${Y(hb + 4)}Z"/>`;
    for (const f of [-0.62, 0.62]) body += `<circle class="tyre" cx="${n(L2 * f)}" cy="${Y(wr)}" r="${n(wr)}"/><circle class="frame" cx="${n(L2 * f)}" cy="${Y(wr)}" r="${n(wr * 0.45)}" fill="none"/>`;
  } else if (sym === 'moto') {
    const L2 = d / 2, wr = h * 0.27;
    for (const f of [-0.68, 0.68]) body += `<circle class="tyre" cx="${n(L2 * f)}" cy="${Y(wr)}" r="${n(wr)}"/>`;
    body += `<path class="b" d="M${n(-L2 * 0.55)},${Y(h * 0.55)}L${n(L2 * 0.25)},${Y(h * 0.7)}L${n(L2 * 0.45)},${Y(h * 0.55)}L${n(L2 * 0.1)},${Y(h * 0.38)}L${n(-L2 * 0.4)},${Y(h * 0.4)}Z"/>`;
    body += `<path class="frame" d="M${n(L2 * 0.68)},${Y(wr)}L${n(L2 * 0.45)},${Y(h)}M${n(-L2 * 0.68)},${Y(wr)}L${n(-L2 * 0.2)},${Y(h * 0.45)}"/>`;
  } else if (sym === 'monitor') {
    const sh = h * 0.72;
    body = `<rect class="b" x="${n(-w / 2)}" y="${Y(h)}" width="${n(w)}" height="${n(sh)}" rx="1"/><rect class="glass" x="${n(-w / 2 + 2)}" y="${Y(h - 2)}" width="${n(w - 4)}" height="${n(sh - 4)}"/>`;
    body += `<rect class="b" x="${n(-w * 0.04)}" y="${Y(h - sh)}" width="${n(w * 0.08)}" height="${n(h - sh)}"/><rect class="b" x="${n(-w * 0.18)}" y="${Y(1.5)}" width="${n(w * 0.36)}" height="1.5"/>`;
  } else if (sym === 'pc') {
    body = `<rect class="b" x="${n(-d / 2)}" y="${Y(h)}" width="${n(d)}" height="${n(h)}" rx="1.5"/><rect class="glass" x="${n(-d / 2 + 4)}" y="${Y(h - 4)}" width="${n(d * 0.55)}" height="${n(h - 8)}"/><circle class="dot" cx="${n(d * 0.32)}" cy="${Y(h - 5)}" r="1.4"/>`;
  } else if (sym === 'laptop') {
    body = `<path class="b" d="M${n(-d / 2)},${Y(1.5)}L${n(d / 2)},${Y(1.5)}L${n(d / 2)},0L${n(-d / 2)},0Z"/><path class="b" d="M${n(-d / 2 + 1)},${Y(1.5)}L${n(-d / 2 + 5)},${Y(h)}L${n(-d / 2 + 7)},${Y(h)}L${n(-d / 2 + 3)},${Y(1.5)}Z"/>`;
  } else if (sym === 'printer') {
    body = `<rect class="b" x="${n(-w / 2)}" y="${Y(h * 0.8)}" width="${n(w)}" height="${n(h * 0.8)}" rx="2"/><rect class="w" x="${n(-w * 0.3)}" y="${Y(h)}" width="${n(w * 0.6)}" height="${n(h * 0.25)}"/><rect class="frame" x="${n(-w * 0.35)}" y="${Y(h * 0.35)}" width="${n(w * 0.7)}" height="2" fill="none"/>`;
  } else if (sym === 'ceilinglamp') {
    H = Math.max(h, w * 0.3);
    body = `<rect class="frame2" x="${n(-w * 0.6)}" y="${Y(H)}" width="${n(w * 1.2)}" height="${n(H * 0.12)}"/><path class="glow" d="M${n(-w / 2)},${Y(H * 0.88)}Q0,${Y(-H * 0.4)} ${n(w / 2)},${Y(H * 0.88)}Z"/>`;
  } else if (sym === 'cat' || sym === 'rabbit') {
    const L2 = d / 2, cat = sym === 'cat';
    const hr = cat ? h * 0.24 : h * 0.26;
    body = `<ellipse class="b" cx="${n(-L2 * 0.12)}" cy="${Y(h * 0.42)}" rx="${n(L2 * 0.62)}" ry="${n(h * 0.24)}"/>`;
    body += `<circle class="b" cx="${n(L2 * 0.6)}" cy="${Y(h - hr * (cat ? 1.25 : 1.6))}" r="${n(hr)}"/>`;
    if (cat) {
      body += `<path class="b" d="M${n(L2 * 0.42)},${Y(h - hr * 0.6)}L${n(L2 * 0.5)},${Y(h)}L${n(L2 * 0.62)},${Y(h - hr * 0.4)}Z"/>`;
      body += `<path class="tail" d="M${n(-L2 * 0.7)},${Y(h * 0.45)}Q${n(-L2 * 1.05)},${Y(h * 0.6)} ${n(-L2 * 0.9)},${Y(h * 0.95)}"/>`;
      body += `<path class="frame" d="M${n(-L2 * 0.45)},${Y(h * 0.25)}V0M${n(L2 * 0.25)},${Y(h * 0.25)}V0"/>`;
      if (def.coat === 'frajola') body += `<ellipse class="w" cx="${n(L2 * 0.45)}" cy="${Y(h * 0.35)}" rx="${n(L2 * 0.14)}" ry="${n(h * 0.12)}"/>`;
    } else {
      body += `<ellipse class="b" cx="${n(L2 * 0.42)}" cy="${Y(h * 0.95)}" rx="${n(L2 * 0.1)}" ry="${n(h * 0.3)}" transform="rotate(-25 ${n(L2 * 0.42)} ${Y(h * 0.95)})"/>`;
      body += `<circle class="w" cx="${n(-L2 * 0.72)}" cy="${Y(h * 0.45)}" r="${n(h * 0.1)}"/>`;
    }
  }
  const pad = Math.max(W, H) * 0.08 + 2;
  const top = H + pad, vbW = W + pad * 2, vbH = H + pad * 2;
  return `<svg class="prev front" viewBox="${n(-W / 2 - pad)} ${n(-top)} ${n(vbW)} ${n(vbH)}" width="${size}" height="${size}" style="--c:${def.color}">${body}</svg>`;
}

// Miniatura para o catálogo
export function previewSVG(def, size = 56) {
  if (FRONT.has(def.sym)) return frontSVG(def, size);
  const it = { ...def, shape: def.shape || 'rect' };
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
.l.faint{stroke:rgba(20,24,30,.16)}
.l.arrow{stroke:rgba(20,24,30,.7);stroke-width:1.6}
.k.col{fill:rgba(20,24,30,.7)}
.rail{fill:none;stroke:rgba(20,24,30,.75);stroke-width:2.6;vector-effect:non-scaling-stroke;stroke-linecap:round}
.leaf{fill:rgba(255,255,255,.22)}
.hit0{fill:transparent;stroke:none}
.w{fill:#f4f2ee;stroke:none}
.skin{fill:#d9a98a;stroke:rgba(20,24,30,.3);stroke-width:1;vector-effect:non-scaling-stroke}
.hair{fill:#3b2a20;stroke:none}
.sand{fill:#e2d3a8;stroke:rgba(20,24,30,.2);stroke-width:1;vector-effect:non-scaling-stroke}
.l.tail{stroke:var(--c);stroke-width:3.5;stroke-linecap:round;vector-effect:none}
.k.stripe{stroke:rgba(20,24,30,.45);stroke-width:2;vector-effect:none}
.k.faint{fill:rgba(20,24,30,.14);stroke:none}
.prev.front .bar line,.prev.front .frame,.prev.front .tail{stroke:var(--c);fill:none;stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linecap:round}
.prev.front .frame2{fill:var(--c)}
.prev.front .tail{stroke-width:3.5}
.prev.front .pants{fill:#36404e}
.prev.front .glow{fill:#ffe9a0;stroke:rgba(20,24,30,.3);stroke-width:1;vector-effect:non-scaling-stroke}
.prev.front .dot{fill:#333}
.prev.front .glass{fill:#9fc0d8;stroke:rgba(20,24,30,.3);stroke-width:1;vector-effect:non-scaling-stroke}
.prev.front .tyre{fill:#25282c}
.prev.front .gate .b{fill:var(--c)}
`;
