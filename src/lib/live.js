// Live visitors, total visits and the top-picks leaderboard (top bar + drop-down panel).
// Talks to server/live.js. If the server is not reachable the bar says "offline" and nothing else breaks.
import { business } from '../config/business.js';

const cfg = business.live || {};
const API = String(cfg.apiUrl || '').replace(/\/+$/, '');
const PING_MS = Math.max(5000, Number(cfg.pingMs) || 15000);
const byId = Object.fromEntries(business.services.map((s) => [s.id, s]));
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const $ = (id) => document.getElementById(id);

function visitorId() {
  try {
    let v = localStorage.getItem('bbp-vid');
    if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('bbp-vid', v);
    }
    return v;
  } catch (e) {
    return 's' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }
}

function sessionFlag(set) {
  try {
    if (set) sessionStorage.setItem('bbp-sess', '1');
    return sessionStorage.getItem('bbp-sess') === '1';
  } catch (e) { return false; }
}

// text/plain keeps these requests "simple" (no CORS pre-flight). The server reads the body as JSON.
async function post(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), signal: ctrl.signal, keepalive: true });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export function initLive() {
  const html = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vid = visitorId();
  const bar = $('lb-bar');
  const toggle = $('lb-toggle');
  const panel = $('lb-panel');
  const cleanups = [];
  if (!bar) return () => {};

  // ----- numbers (count-up) -----
  function setNumber(el, to) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = String(to);
    if (reduce || from === to || Math.abs(to - from) > 5000) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 700);
      el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && el.dataset.v === String(to)) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ----- leaderboard -----
  function renderBoard(top) {
    const list = $('lb-list');
    const empty = $('lb-empty');
    const topName = $('lb-top-name');
    const rows = (Array.isArray(top) ? top : []).filter((t) => byId[t.id]);
    if (topName) topName.textContent = rows.length ? `#1 ${byId[rows[0].id].name}` : 'Be the first to pick';
    if (empty) empty.hidden = rows.length > 0;
    if (!list) return;
    const max = Math.max(1, ...rows.map((t) => t.count));
    list.replaceChildren(...rows.map((t, i) => {
      const s = byId[t.id];
      const li = document.createElement('li');
      li.className = 'lb-row' + (i === 0 ? ' is-first' : '');
      const rank = document.createElement('span');
      rank.className = 'lb-row__rank';
      rank.textContent = String(i + 1);
      const name = document.createElement('span');
      name.className = 'lb-row__name';
      name.textContent = s.name;
      const price = document.createElement('span');
      price.className = 'lb-row__price';
      price.textContent = '₹' + fmt(s.price);
      const count = document.createElement('span');
      count.className = 'lb-row__count';
      count.textContent = `${fmt(t.count)} ${t.count === 1 ? 'pick' : 'picks'}`;
      const track = document.createElement('span');
      track.className = 'lb-row__bar';
      const fill = document.createElement('i');
      fill.style.width = Math.max(6, Math.round((t.count / max) * 100)) + '%';
      track.append(fill);
      li.append(rank, name, price, count, track);
      return li;
    }));
  }

  function apply(data) {
    if (!data || typeof data !== 'object') return;
    document.querySelectorAll('[data-live]').forEach((el) => {
      const key = el.dataset.live;
      if (typeof data[key] === 'number') setNumber(el, data[key]);
    });
    renderBoard(data.top);
    document.dispatchEvent(new CustomEvent('bbp:stats', { detail: data }));
  }

  // ----- pinging -----
  let fails = 0;
  let inflight = false;
  async function ping() {
    if (inflight) return;
    inflight = true;
    try {
      const first = !sessionFlag(false);
      const data = await post('/api/ping', { id: vid, visit: first });
      if (first) sessionFlag(true);
      fails = 0;
      html.classList.remove('live-off');
      apply(data);
    } catch (e) {
      fails += 1;
      if (fails >= 2) html.classList.add('live-off');
    } finally { inflight = false; }
  }

  const picked = new Set();
  async function reportPick(service) {
    if (!byId[service] || picked.has(service)) return;
    picked.add(service);
    try { apply(await post('/api/pick', { id: vid, service })); } catch (e) { /* offline: ignore */ }
  }

  const timer = setInterval(() => { if (!document.hidden) ping(); }, PING_MS);
  const onVisible = () => { if (!document.hidden) ping(); };
  const onLeave = () => {
    try { navigator.sendBeacon(API + '/api/leave', new Blob([JSON.stringify({ id: vid })], { type: 'text/plain' })); } catch (e) { /* ignore */ }
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pagehide', onLeave);
  cleanups.push(() => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pagehide', onLeave); });

  // Count a "pick" when somebody adds a service to the order or taps a service's WhatsApp button.
  const onClick = (e) => {
    const add = e.target.closest('[data-order]');
    if (add) { queueMicrotask(() => { if (add.getAttribute('aria-pressed') === 'true') reportPick(add.dataset.order); }); return; }
    const wa = e.target.closest('[data-wa-service]');
    if (wa) reportPick(wa.dataset.waService);
  };
  document.addEventListener('click', onClick);
  cleanups.push(() => document.removeEventListener('click', onClick));

  // ----- drop-down panel -----
  function setPanel(open) {
    if (!panel || !toggle) return;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    bar.classList.toggle('is-open', open);
  }
  if (toggle && panel) {
    const onToggle = () => setPanel(panel.hidden);
    const onDoc = (e) => { if (!panel.hidden && !e.target.closest('#lb-bar')) setPanel(false); };
    const onKey = (e) => { if (e.key === 'Escape' && !panel.hidden) { setPanel(false); toggle.focus(); } };
    toggle.addEventListener('click', onToggle);
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    cleanups.push(() => {
      toggle.removeEventListener('click', onToggle);
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    });
  }

  ping();
  return () => cleanups.forEach((fn) => fn());
}
