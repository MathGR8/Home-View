/**
 * Worker da Home-View (Cloudflare).
 *
 * Serve o app (pasta public/) e a API para guardar projetos na nuvem:
 *   POST   /api/conta/criar     { usuario, senha } -> { usuario, token }
 *   POST   /api/conta/entrar    { usuario, senha } -> { usuario, token }
 *   POST   /api/conta/sair
 *   GET    /api/projetos                 -> { projetos: [{ id, nome, atualizado, thumb, apagado }] }
 *   GET    /api/projetos/:id             -> { id, nome, atualizado, dados }
 *   PUT    /api/projetos/:id   { nome, atualizado, thumb, dados }
 *   DELETE /api/projetos/:id
 *
 * Os dados ficam num Durable Object com SQLite (incluído no plano grátis, nada para criar no painel).
 * Senhas: PBKDF2-SHA256 com sal. Sessões: token aleatório (guardado só o hash).
 */
import { DurableObject } from 'cloudflare:workers';

const MAX_BODY = 2_000_000;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url);
    } catch (e) {
      return json({ erro: 'Erro no servidor', detalhe: String(e?.message || e) }, 500);
    }
  },
};

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function body(req) {
  const len = +req.headers.get('content-length') || 0;
  if (len > MAX_BODY) throw Object.assign(new Error('Projeto grande demais'), { status: 413 });
  const txt = await req.text();
  if (txt.length > MAX_BODY) throw Object.assign(new Error('Projeto grande demais'), { status: 413 });
  try { return JSON.parse(txt || '{}'); } catch { return {}; }
}

async function api(req, env, url) {
  const db = env.BANCO.get(env.BANCO.idFromName('principal'));
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;
  const ip = req.headers.get('cf-connecting-ip') || '';

  if (path === '/api/conta/criar' && m === 'POST') {
    const { usuario, senha } = await body(req);
    const r = await db.criarConta(String(usuario || ''), String(senha || ''), ip);
    return json(r.erro ? { erro: r.erro } : r, r.erro ? r.status || 400 : 200);
  }
  if (path === '/api/conta/entrar' && m === 'POST') {
    const { usuario, senha } = await body(req);
    const r = await db.entrar(String(usuario || ''), String(senha || ''), ip);
    return json(r.erro ? { erro: r.erro } : r, r.erro ? r.status || 401 : 200);
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const usuario = token ? await db.sessao(token) : null;
  if (!usuario) return json({ erro: 'Entre na sua conta de novo' }, 401);

  if (path === '/api/conta/sair' && m === 'POST') { await db.sair(token); return json({ ok: true }); }
  if (path === '/api/projetos' && m === 'GET') return json({ projetos: await db.listar(usuario) });

  const mm = path.match(/^\/api\/projetos\/([A-Za-z0-9_-]{1,64})$/);
  if (mm) {
    const id = mm[1];
    if (m === 'GET') { const p = await db.obter(usuario, id); return p ? json(p) : json({ erro: 'Projeto não encontrado' }, 404); }
    if (m === 'PUT') {
      let b;
      try { b = await body(req); } catch (e) { return json({ erro: e.message }, e.status || 400); }
      if (!b.dados || typeof b.dados !== 'object') return json({ erro: 'Dados inválidos' }, 400);
      await db.salvar(usuario, id, String(b.nome || 'Projeto').slice(0, 200), +b.atualizado || Date.now(), String(b.thumb || '').slice(0, 200_000), JSON.stringify(b.dados));
      return json({ ok: true });
    }
    if (m === 'DELETE') { await db.apagar(usuario, id); return json({ ok: true }); }
  }
  return json({ erro: 'Rota não encontrada' }, 404);
}

// ---------------- banco (Durable Object com SQLite) ----------------
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const rand = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hashSenha(senha, sal) {
  const key = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal), iterations: 100000 }, key, 256);
  return hex(bits);
}
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const SESSAO_MS = 1000 * 60 * 60 * 24 * 180; // 180 dias

export class Banco extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (usuario TEXT PRIMARY KEY, sal TEXT NOT NULL, hash TEXT NOT NULL, criado INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessoes (token TEXT PRIMARY KEY, usuario TEXT NOT NULL, expira INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS projetos (usuario TEXT NOT NULL, id TEXT NOT NULL, nome TEXT, atualizado INTEGER, thumb TEXT, dados TEXT, apagado INTEGER DEFAULT 0, PRIMARY KEY (usuario, id));
      CREATE TABLE IF NOT EXISTS tentativas (chave TEXT PRIMARY KEY, n INTEGER NOT NULL, desde INTEGER NOT NULL);
    `);
  }

  limite(chave, max, janelaMs) {
    const now = Date.now();
    const row = this.sql.exec('SELECT n, desde FROM tentativas WHERE chave = ?', chave).toArray()[0];
    if (!row || now - row.desde > janelaMs) { this.sql.exec('INSERT OR REPLACE INTO tentativas (chave, n, desde) VALUES (?, 1, ?)', chave, now); return false; }
    if (row.n >= max) return true;
    this.sql.exec('UPDATE tentativas SET n = n + 1 WHERE chave = ?', chave);
    return false;
  }

  async novaSessao(usuario) {
    const token = rand(32);
    this.sql.exec('INSERT INTO sessoes (token, usuario, expira) VALUES (?, ?, ?)', await sha(token), usuario, Date.now() + SESSAO_MS);
    return { usuario, token };
  }

  async criarConta(usuario, senha, ip) {
    usuario = usuario.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(usuario)) return { erro: 'Usuário inválido (3 a 32 letras, números, ponto, hífen ou _).' };
    if (senha.length < 6 || senha.length > 200) return { erro: 'A senha precisa ter pelo menos 6 caracteres.' };
    if (this.limite('criar:' + ip, 10, 3600_000)) return { erro: 'Muitas contas criadas. Tente mais tarde.', status: 429 };
    if (this.sql.exec('SELECT 1 FROM usuarios WHERE usuario = ?', usuario).toArray().length) return { erro: 'Esse usuário já existe. Escolha outro ou use “Entrar”.', status: 409 };
    const sal = rand(16);
    this.sql.exec('INSERT INTO usuarios (usuario, sal, hash, criado) VALUES (?, ?, ?, ?)', usuario, sal, await hashSenha(senha, sal), Date.now());
    return this.novaSessao(usuario);
  }

  async entrar(usuario, senha, ip) {
    usuario = usuario.trim().toLowerCase();
    if (this.limite('entrar:' + usuario, 10, 900_000) || this.limite('ip:' + ip, 40, 900_000)) return { erro: 'Muitas tentativas. Espere 15 minutos.', status: 429 };
    const u = this.sql.exec('SELECT sal, hash FROM usuarios WHERE usuario = ?', usuario).toArray()[0];
    if (!u || !iguais(await hashSenha(senha, u.sal), u.hash)) return { erro: 'Usuário ou senha incorretos.', status: 401 };
    this.sql.exec('DELETE FROM tentativas WHERE chave = ?', 'entrar:' + usuario);
    return this.novaSessao(usuario);
  }

  async sessao(token) {
    const h = await sha(token);
    const row = this.sql.exec('SELECT usuario, expira FROM sessoes WHERE token = ?', h).toArray()[0];
    if (!row) return null;
    if (row.expira < Date.now()) { this.sql.exec('DELETE FROM sessoes WHERE token = ?', h); return null; }
    return row.usuario;
  }

  async sair(token) { this.sql.exec('DELETE FROM sessoes WHERE token = ?', await sha(token)); }

  listar(usuario) {
    return this.sql.exec('SELECT id, nome, atualizado, thumb, apagado FROM projetos WHERE usuario = ? ORDER BY atualizado DESC', usuario)
      .toArray().map((r) => ({ id: r.id, nome: r.nome, atualizado: r.atualizado, thumb: r.thumb, apagado: !!r.apagado }));
  }

  obter(usuario, id) {
    const r = this.sql.exec('SELECT id, nome, atualizado, dados FROM projetos WHERE usuario = ? AND id = ? AND apagado = 0', usuario, id).toArray()[0];
    return r ? { id: r.id, nome: r.nome, atualizado: r.atualizado, dados: JSON.parse(r.dados) } : null;
  }

  salvar(usuario, id, nome, atualizado, thumb, dados) {
    const cur = this.sql.exec('SELECT atualizado, apagado FROM projetos WHERE usuario = ? AND id = ?', usuario, id).toArray()[0];
    if (cur && cur.apagado) return { ok: false };
    if (cur && cur.atualizado > atualizado) return { ok: false, antigo: true };
    this.sql.exec('INSERT OR REPLACE INTO projetos (usuario, id, nome, atualizado, thumb, dados, apagado) VALUES (?, ?, ?, ?, ?, ?, 0)', usuario, id, nome, atualizado, thumb, dados);
    return { ok: true };
  }

  apagar(usuario, id) {
    this.sql.exec('INSERT OR REPLACE INTO projetos (usuario, id, nome, atualizado, thumb, dados, apagado) VALUES (?, ?, NULL, ?, NULL, NULL, 1)', usuario, id, Date.now());
  }
}
