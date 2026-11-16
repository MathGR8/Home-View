// Salvamento: sempre no aparelho (localStorage) e, com conta, também na nuvem (Cloudflare).
const IDX = 'planta.indice';
const PFX = 'planta.proj.';
const CLOUD = 'planta.nuvem';

const read = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const local = {
  list() { return read(IDX, []); },
  saveIndex(idx) { write(IDX, idx); },
  get(id) { return read(PFX + id, null); },
  put(p, meta = {}) {
    const ok = write(PFX + p.id, p);
    const idx = this.list();
    const i = idx.findIndex((e) => e.id === p.id);
    const prev = i >= 0 ? idx[i] : {};
    const entry = { ...prev, id: p.id, name: p.name, updatedAt: p.updatedAt, thumb: meta.thumb ?? prev.thumb, ...meta };
    if (i >= 0) idx[i] = entry; else idx.push(entry);
    this.saveIndex(idx);
    return ok;
  },
  markSynced(id, at) { const idx = this.list(); const e = idx.find((x) => x.id === id); if (e) { e.syncedAt = at; this.saveIndex(idx); } },
  remove(id) { localStorage.removeItem(PFX + id); this.saveIndex(this.list().filter((e) => e.id !== id)); },
};

// ---------- nuvem ----------
export const cloud = {
  get session() { return read(CLOUD, null); },
  get user() { return this.session?.usuario || null; },
  setSession(s) { if (s) write(CLOUD, s); else localStorage.removeItem(CLOUD); },
  async call(path, opts = {}) {
    const s = this.session;
    const headers = { 'content-type': 'application/json', ...(s ? { authorization: 'Bearer ' + s.token } : {}) };
    const r = await fetch('/api' + path, { ...opts, headers });
    let data = null;
    try { data = await r.json(); } catch { /* sem corpo */ }
    if (r.status === 401 && s) { this.setSession(null); }
    if (!r.ok) { const e = new Error(data?.erro || `Erro ${r.status}`); e.status = r.status; throw e; }
    return data;
  },
  async criar(usuario, senha) { const d = await this.call('/conta/criar', { method: 'POST', body: JSON.stringify({ usuario, senha }) }); this.setSession(d); return d; },
  async entrar(usuario, senha) { const d = await this.call('/conta/entrar', { method: 'POST', body: JSON.stringify({ usuario, senha }) }); this.setSession(d); return d; },
  async sair() { try { await this.call('/conta/sair', { method: 'POST' }); } catch { /* ignora */ } this.setSession(null); },
  listar() { return this.call('/projetos'); },
  obter(id) { return this.call('/projetos/' + encodeURIComponent(id)); },
  salvar(p, thumb) { return this.call('/projetos/' + encodeURIComponent(p.id), { method: 'PUT', body: JSON.stringify({ nome: p.name, atualizado: p.updatedAt, thumb, dados: p }) }); },
  apagar(id) { return this.call('/projetos/' + encodeURIComponent(id), { method: 'DELETE' }); },
};

// Junta a lista local com a da nuvem; baixa o que é mais novo lá e envia o que é mais novo aqui.
export async function syncAll(thumbOf) {
  if (!cloud.user) return { ok: false };
  const remote = (await cloud.listar()).projetos || [];
  const idx = local.list();
  const byId = new Map(idx.map((e) => [e.id, e]));
  let changed = false;
  for (const r of remote) {
    const l = byId.get(r.id);
    if (r.apagado) { if (l) { local.remove(r.id); changed = true; } continue; }
    if (!l || (l.updatedAt || 0) < r.atualizado) {
      const full = await cloud.obter(r.id);
      if (full?.dados) { local.put(full.dados, { thumb: r.thumb, syncedAt: r.atualizado }); changed = true; }
    } else if ((l.updatedAt || 0) > r.atualizado) {
      const p = local.get(r.id);
      if (p) { await cloud.salvar(p, thumbOf(p)); local.markSynced(p.id, p.updatedAt); }
    } else if (l.syncedAt !== r.atualizado) local.markSynced(r.id, r.atualizado);
  }
  const remoteIds = new Set(remote.map((r) => r.id));
  for (const l of local.list()) {
    if (!remoteIds.has(l.id)) {
      const p = local.get(l.id);
      if (p) { await cloud.salvar(p, thumbOf(p)); local.markSynced(p.id, p.updatedAt); }
    }
  }
  return { ok: true, changed };
}
