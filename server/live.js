// BIG BOSS PARLOUR — live server (zero dependencies, Node 18+).
// Live visitors, total visits, popular services, BigBoss Premium members, order approval and the leaderboard.
// Also serves the built website from ./dist and the owner page at /owner.
//   npm run build && npm run live      ->  http://localhost:8787
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { business } from '../src/config/business.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const DATA_FILE = path.join(__dirname, 'data.json');
const OWNER_HTML = path.join(__dirname, 'owner.html');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const LIVE_WINDOW_MS = 45_000;
const VISIT_COOLDOWN_MS = 30 * 60_000;
const PICK_COOLDOWN_MS = 60 * 60_000;
const MAX_UNIQUE = 100_000;
const MAX_ORDERS_KEPT = 500;
const MAX_PENDING_PER_MEMBER = 3;
const BOARD_SIZE = 10;
const SERVICES = Object.fromEntries(business.services.map((s) => [s.id, s]));
const SERVICE_IDS = new Set(Object.keys(SERVICES));
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const TOKEN_RE = /^[a-f0-9]{32}$/;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

// ---------- state (saved to server/data.json) ----------
const istDay = () => new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
let data = { total: 0, unique: [], picks: {}, today: { day: istDay(), visits: 0 }, ownerKey: '', members: {}, orders: [] };
try {
  const s = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  data = {
    total: Number(s.total) || 0,
    unique: Array.isArray(s.unique) ? s.unique.slice(-MAX_UNIQUE) : [],
    picks: s.picks && typeof s.picks === 'object' ? s.picks : {},
    today: s.today && s.today.day ? s.today : { day: istDay(), visits: 0 },
    ownerKey: typeof s.ownerKey === 'string' ? s.ownerKey : '',
    members: s.members && typeof s.members === 'object' ? s.members : {},
    orders: Array.isArray(s.orders) ? s.orders : []
  };
} catch { /* first run */ }

let dirty = false;
if (!process.env.OWNER_KEY && !data.ownerKey) { data.ownerKey = crypto.randomBytes(9).toString('hex'); dirty = true; }
const OWNER_KEY = process.env.OWNER_KEY || data.ownerKey;
const KEY_HASH = sha(OWNER_KEY);

const uniqueSet = new Set(data.unique);
const visitors = new Map();
const lastVisit = new Map();
const lastPick = new Map();

function save() {
  if (!dirty) return;
  dirty = false;
  data.unique = [...uniqueSet].slice(-MAX_UNIQUE);
  try {
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(data));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (e) { console.warn('Could not save data.json:', e.message); }
}
save();
setInterval(save, 3000).unref();

function prune(now = Date.now()) {
  for (const [id, seen] of visitors) if (now - seen > LIVE_WINDOW_MS) visitors.delete(id);
  if (lastVisit.size > 50_000) lastVisit.clear();
  if (lastPick.size > 50_000) lastPick.clear();
}
setInterval(prune, 15_000).unref();

// ---------- members, orders, leaderboard ----------
const cleanName = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
function cleanPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
const byToken = (token) => (TOKEN_RE.test(String(token)) ? Object.values(data.members).find((m) => m.token === token) : null);
const approved = () => Object.values(data.members).filter((m) => m.status === 'approved');
const ranking = () => approved().filter((m) => m.orders > 0).sort((a, b) => b.spent - a.spent || b.orders - a.orders || a.at - b.at);
const topItems = (m) => Object.entries(m.items || {}).filter(([id]) => SERVICE_IDS.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, qty]) => ({ id, qty }));
const pendingCount = (m) => data.orders.filter((o) => o.memberId === m.id && o.status === 'pending').length;

function stats() {
  const now = Date.now();
  prune(now);
  if (data.today.day !== istDay()) { data.today = { day: istDay(), visits: 0 }; dirty = true; }
  const top = Object.entries(data.picks)
    .filter(([id, n]) => SERVICE_IDS.has(id) && n > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ id, count }));
  const board = ranking().slice(0, BOARD_SIZE).map((m) => ({ name: m.name, orders: m.orders, spent: m.spent, items: topItems(m) }));
  return { live: visitors.size, total: data.total, unique: uniqueSet.size, today: data.today.visits, top, board, members: approved().length, at: now };
}

// ---------- helpers ----------
const rate = new Map();
function limited(ip) {
  const now = Date.now();
  let r = rate.get(ip);
  if (!r || now > r.reset) { r = { n: 0, reset: now + 60_000 }; rate.set(ip, r); }
  r.n += 1;
  if (rate.size > 20_000) rate.clear();
  return r.n > 120;
}
const joins = new Map();
function joinRecord(ip) {
  const now = Date.now();
  let r = joins.get(ip);
  if (!r || now > r.reset) { r = { n: 0, reset: now + 3_600_000 }; joins.set(ip, r); }
  return r;
}
const joinLimited = (ip) => joinRecord(ip).n >= 5;
const fails = new Map();
function ownerLocked(ip) { const r = fails.get(ip); return !!r && Date.now() < r.reset && r.n >= 8; }
function ownerFail(ip) {
  const now = Date.now();
  let r = fails.get(ip);
  if (!r || now > r.reset) { r = { n: 0, reset: now + 600_000 }; fails.set(ip, r); }
  r.n += 1;
}
function isOwner(req) {
  const k = String(req.headers['x-owner-key'] || '');
  return crypto.timingSafeEqual(sha(k), KEY_HASH);
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff) return xff;
  }
  return req.socket.remoteAddress || 'unknown';
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Key',
    ...headers
  });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
const fail = (res, code, error) => json(res, code, { error });

function readJson(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 4096) { req.destroy(); resolve(null); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

// ---------- owner API ----------
function ownerState() {
  const members = Object.values(data.members).sort((a, b) => b.at - a.at).map((m) => ({
    id: m.id, name: m.name, phone: m.phone, status: m.status, orders: m.orders, spent: m.spent, at: m.at
  }));
  const named = (o) => {
    const m = data.members[o.memberId];
    return {
      id: o.id, memberId: o.memberId, name: m ? m.name : '(removed)', phone: m ? m.phone : '', status: o.status, total: o.total, at: o.at,
      items: o.items.map((id) => ({ id, name: SERVICES[id].name, price: SERVICES[id].price }))
    };
  };
  const pending = data.orders.filter((o) => o.status === 'pending').map(named).reverse();
  const recent = data.orders.filter((o) => o.status !== 'pending').slice(-30).map(named).reverse();
  return { members, pending, recent, now: Date.now() };
}

function ownerApi(req, res, pathname, body) {
  if (pathname === '/api/owner/state') return json(res, 200, ownerState());
  if (!body) return fail(res, 400, 'bad body');

  if (pathname === '/api/owner/member') {
    const m = data.members[String(body.member)];
    if (!m) return fail(res, 404, 'no such member');
    if (body.action === 'approve') m.status = 'approved';
    else if (body.action === 'remove' || body.action === 'reject') {
      delete data.members[m.id];
      data.orders = data.orders.filter((o) => o.memberId !== m.id);
    } else return fail(res, 400, 'bad action');
    dirty = true;
    return json(res, 200, ownerState());
  }

  if (pathname === '/api/owner/order') {
    const o = data.orders.find((x) => x.id === String(body.order));
    if (!o) return fail(res, 404, 'no such order');
    if (o.status !== 'pending') return fail(res, 409, 'already handled');
    if (body.action === 'accept') {
      const m = data.members[o.memberId];
      if (!m || m.status !== 'approved') return fail(res, 409, 'member is not approved');
      o.status = 'accepted';
      o.doneAt = Date.now();
      m.orders += 1;
      m.spent += o.total;
      m.items = m.items || {};
      o.items.forEach((id) => { m.items[id] = (m.items[id] || 0) + 1; });
    } else if (body.action === 'reject') {
      o.status = 'rejected';
      o.doneAt = Date.now();
    } else return fail(res, 400, 'bad action');
    dirty = true;
    return json(res, 200, ownerState());
  }
  return fail(res, 404, 'not found');
}

// ---------- member API ----------
function memberApi(req, res, pathname, body, ip) {
  if (pathname === '/api/member/join') {
    if (joinLimited(ip)) return fail(res, 429, 'Too many sign-ups from this connection. Please try later.');
    const name = cleanName(body.name);
    const phone = cleanPhone(body.phone);
    if (name.length < 2) return fail(res, 400, 'Please enter your name (at least 2 letters).');
    if (!phone) return fail(res, 400, 'Please enter a valid 10-digit mobile number.');
    if (Object.keys(data.members).length >= 5000) return fail(res, 503, 'Sign-ups are full right now.');
    if (Object.values(data.members).some((m) => m.phone === phone)) return fail(res, 409, 'This number is already registered. Please ask the parlour.');
    const m = { id: crypto.randomBytes(6).toString('hex'), token: crypto.randomBytes(16).toString('hex'), name, phone, status: 'pending', orders: 0, spent: 0, items: {}, at: Date.now() };
    data.members[m.id] = m;
    joinRecord(ip).n += 1;
    dirty = true;
    return json(res, 200, { token: m.token, name: m.name, status: m.status });
  }

  if (pathname === '/api/member/me') {
    const m = byToken(body.token);
    if (!m) return fail(res, 404, 'unknown member');
    const rank = m.status === 'approved' ? ranking().findIndex((x) => x.id === m.id) + 1 : 0;
    return json(res, 200, { name: m.name, status: m.status, orders: m.orders, spent: m.spent, rank, pending: pendingCount(m) });
  }

  if (pathname === '/api/order') {
    const m = byToken(body.token);
    if (!m) return fail(res, 404, 'Your Premium membership was not found. Please join again.');
    if (m.status !== 'approved') return fail(res, 403, 'Your Premium request is still waiting for the owner to approve it.');
    const ids = [...new Set(Array.isArray(body.items) ? body.items.map(String) : [])].filter((id) => SERVICE_IDS.has(id));
    if (!ids.length) return fail(res, 400, 'Your order is empty.');
    if (pendingCount(m) >= MAX_PENDING_PER_MEMBER) return fail(res, 429, 'You already have orders waiting for the owner.');
    const order = { id: crypto.randomBytes(5).toString('hex'), memberId: m.id, items: ids, total: ids.reduce((s, id) => s + SERVICES[id].price, 0), status: 'pending', at: Date.now() };
    data.orders.push(order);
    if (data.orders.length > MAX_ORDERS_KEPT) {
      const drop = data.orders.length - MAX_ORDERS_KEPT;
      let removed = 0;
      data.orders = data.orders.filter((o) => (removed < drop && o.status !== 'pending' ? (removed++, false) : true));
    }
    dirty = true;
    return json(res, 200, { ok: true, order: order.id, total: order.total });
  }
  return fail(res, 404, 'not found');
}

// ---------- API router ----------
async function api(req, res, pathname, ip) {
  if (req.method === 'GET' && pathname === '/api/stats') return json(res, 200, stats());
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true });

  if (pathname.startsWith('/api/owner/')) {
    if (ownerLocked(ip)) return fail(res, 429, 'Too many wrong keys. Try again in 10 minutes.');
    if (!isOwner(req)) { ownerFail(ip); return fail(res, 401, 'wrong owner key'); }
    if (req.method === 'GET') return ownerApi(req, res, pathname, null);
    if (req.method !== 'POST') return fail(res, 405, 'method');
    return ownerApi(req, res, pathname, await readJson(req));
  }

  if (req.method !== 'POST') return fail(res, 405, 'method');
  const body = await readJson(req);
  if (!body || typeof body !== 'object') return fail(res, 400, 'bad body');

  if (pathname.startsWith('/api/member/') || pathname === '/api/order') return memberApi(req, res, pathname, body, ip);

  const id = String(body.id || '');
  if (!ID_RE.test(id)) return fail(res, 400, 'bad id');
  const now = Date.now();

  if (pathname === '/api/ping') {
    visitors.set(id, now);
    if (body.visit === true && now - (lastVisit.get(id) || 0) > VISIT_COOLDOWN_MS) {
      lastVisit.set(id, now);
      data.total += 1;
      if (data.today.day !== istDay()) data.today = { day: istDay(), visits: 0 };
      data.today.visits += 1;
      uniqueSet.add(id);
      dirty = true;
    }
    return json(res, 200, stats());
  }
  if (pathname === '/api/leave') { visitors.delete(id); return json(res, 200, { ok: true }); }
  if (pathname === '/api/pick') {
    const service = String(body.service || '');
    if (!SERVICE_IDS.has(service)) return fail(res, 400, 'bad service');
    const key = `${id}:${service}`;
    if (now - (lastPick.get(key) || 0) > PICK_COOLDOWN_MS) {
      lastPick.set(key, now);
      data.picks[service] = (Number(data.picks[service]) || 0) + 1;
      dirty = true;
    }
    visitors.set(id, now);
    return json(res, 200, stats());
  }
  return fail(res, 404, 'not found');
}

// ---------- static files ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (pathname === '/owner' || pathname === '/owner/') {
    if (!fs.existsSync(OWNER_HTML)) return send(res, 404, 'owner.html missing');
    return send(res, 200, fs.readFileSync(OWNER_HTML), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Frame-Options': 'DENY' });
  }
  if (!fs.existsSync(DIST)) return send(res, 404, 'Site not built yet. Run: npm run build', { 'Content-Type': 'text/plain; charset=utf-8' });
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel.includes('\0')) return send(res, 400, 'Bad request');
  let file = path.join(DIST, path.normalize(rel));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return send(res, 403, 'Forbidden');
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch { /* handled below */ }
  if (!fs.existsSync(file)) {
    const nf = path.join(DIST, '404.html');
    return send(res, 404, fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found', { 'Content-Type': 'text/html; charset=utf-8' });
  }
  const ext = path.extname(file).toLowerCase();
  const immutable = file.includes(path.sep + 'assets' + path.sep);
  const noStore = path.basename(file) === 'announcement.json';
  send(res, 200, req.method === 'HEAD' ? '' : fs.readFileSync(file), {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': noStore ? 'no-store' : immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://x').pathname;
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (pathname.startsWith('/api/')) {
      const ip = clientIp(req);
      if (limited(ip)) return fail(res, 429, 'slow down');
      return await api(req, res, pathname, ip);
    }
    return serveStatic(req, res, pathname);
  } catch (e) {
    console.warn('Request error:', e.message);
    if (!res.headersSent) fail(res, 500, 'server');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`BIG BOSS PARLOUR live server on http://localhost:${PORT}`);
  console.log(`OWNER PAGE:  http://localhost:${PORT}/owner`);
  console.log(`OWNER KEY:   ${OWNER_KEY}   (keep it private; set OWNER_KEY=... to choose your own)`);
});
const quit = () => { save(); process.exit(0); };
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
