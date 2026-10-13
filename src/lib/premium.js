// BigBoss Premium: join form, member status, order submission and the premium leaderboard.
// Needs the live server (server/live.js). Everything stays hidden/quiet if the server is offline.
import { business } from '../config/business.js';

const cfg = business.live || {};
const prem = business.premium || {};
const API = String(cfg.apiUrl || '').replace(/\/+$/, '');
const byId = Object.fromEntries(business.services.map((s) => [s.id, s]));
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const $ = (id) => document.getElementById(id);
const MEMBER_KEY = 'bbp-member';

function h(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function getMember() {
  try {
    const m = JSON.parse(localStorage.getItem(MEMBER_KEY) || 'null');
    if (m && typeof m.token === 'string' && /^[a-f0-9]{32}$/.test(m.token)) return m;
  } catch (e) { /* ignore */ }
  return null;
}
function setMember(m) {
  try { if (m) localStorage.setItem(MEMBER_KEY, JSON.stringify(m)); else localStorage.removeItem(MEMBER_KEY); } catch (e) { /* ignore */ }
}

async function post(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), signal: ctrl.signal, keepalive: true });
    let data = null;
    try { data = await res.json(); } catch (e) { /* not json */ }
    if (!res.ok) { const err = new Error((data && data.error) || 'Something went wrong. Please try again.'); err.status = res.status; throw err; }
    return data;
  } finally { clearTimeout(timer); }
}

export function initPremium() {
  const html = document.documentElement;
  const cleanups = [];
  let me = null;            // { status, name, orders, spent, rank, pending } from the server
  let lastBoard = [];

  // ----- perks list on the offer card -----
  const perks = Array.isArray(prem.perks) ? prem.perks : [];
  const perkList = $('premium-perks');
  if (perkList) perkList.replaceChildren(...perks.map((p) => h('li', null, p)));

  // ----- leaderboard rendering -----
  function fillBoard(ol, emptyEl, rows, limit) {
    if (!ol) return;
    const list = rows.slice(0, limit);
    if (emptyEl) emptyEl.hidden = list.length > 0;
    ol.replaceChildren(...list.map((r, i) => {
      const li = h('li', 'lb-row lb-row--member' + (i === 0 ? ' is-first' : ''));
      li.append(h('span', 'lb-row__rank', String(i + 1)));
      const name = h('span', 'lb-row__name');
      name.append(h('b', null, r.name));
      if (i === 0) name.append(h('em', 'lb-crown', 'TOP'));
      li.append(name, h('span', 'lb-row__price', '₹' + fmt(r.spent)));
      const items = (r.items || []).filter((x) => byId[x.id]).map((x) => `${byId[x.id].name.split(/[\s(]/)[0]}${x.qty > 1 ? ' ×' + x.qty : ''}`).join(' · ');
      li.append(h('span', 'lb-row__count', `${fmt(r.orders)} ${r.orders === 1 ? 'order' : 'orders'}${items ? ' · ' + items : ''}`));
      return li;
    }));
  }

  function renderBoards(board) {
    lastBoard = Array.isArray(board) ? board : [];
    fillBoard($('lb-board'), $('lb-board-empty'), lastBoard, 10);
    fillBoard($('lb-mini'), $('lb-mini-empty'), lastBoard, 3);
    const topName = $('lb-top-name');
    if (topName) topName.textContent = lastBoard.length ? `#1 ${lastBoard[0].name} · ₹${fmt(lastBoard[0].spent)}` : 'Join Premium and take #1';
  }

  // ----- "my status" area in the panel -----
  function renderMe() {
    const box = $('lb-me');
    const joinBtn = $('lb-join-btn');
    if (!box) return;
    const m = getMember();
    box.replaceChildren();
    box.dataset.state = !m ? 'none' : me ? me.status : 'loading';
    if (joinBtn) joinBtn.hidden = !!m && !!me && me.status === 'approved';
    if (!m) {
      box.append(h('p', 'lb-me__title', 'Become a BigBoss Premium customer'));
      box.append(h('p', 'lb-me__text', perks[0] || 'Fast, priority cutting and your name on this leaderboard.'));
      const b = h('button', 'btn btn--gold', 'Join Premium');
      b.type = 'button';
      b.dataset.join = '';
      box.append(b);
      return;
    }
    if (!me) { box.append(h('p', 'lb-me__text', 'Checking your membership…')); return; }
    if (me.status === 'pending') {
      box.append(h('p', 'lb-me__title', `Thanks, ${me.name}!`));
      box.append(h('p', 'lb-me__text', 'Your Premium request is waiting for the owner to approve it. This page updates by itself.'));
      return;
    }
    box.append(h('p', 'lb-me__title', `Welcome, ${me.name} — BigBoss Premium`));
    const line = me.rank ? `Rank #${me.rank} · ${fmt(me.orders)} accepted ${me.orders === 1 ? 'order' : 'orders'} · ₹${fmt(me.spent)}` : 'Place your first order to join the ranking.';
    box.append(h('p', 'lb-me__text', line + (me.pending ? ` · ${me.pending} waiting for the owner` : '')));
    box.append(h('p', 'lb-me__hint', 'Add services to your order and send it. Once the owner accepts it, it moves you up.'));
  }

  async function refreshMe() {
    const m = getMember();
    if (!m) { me = null; renderMe(); return; }
    try {
      me = await post('/api/member/me', { token: m.token });
      if (me && me.name && me.name !== m.name) setMember({ token: m.token, name: me.name });
    } catch (e) {
      if (e.status === 404) { setMember(null); me = null; }
    }
    renderMe();
  }

  // ----- toast -----
  let toastTimer = 0;
  const toastEl = h('div', 'toast');
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastEl.hidden = true;
  document.body.append(toastEl);
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastEl.classList.remove('is-in');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 6500);
  }

  // ----- join dialog -----
  const dialog = document.createElement('dialog');
  dialog.className = 'join-dialog';
  dialog.setAttribute('aria-labelledby', 'join-title');
  const panel = h('div', 'join-dialog__panel');
  const head = h('div', 'join-dialog__head');
  const title = h('h2', null, prem.name || 'BigBoss Premium');
  title.id = 'join-title';
  const closeBtn = h('button', 'order-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.append(title, closeBtn);
  const lead = h('p', 'join-dialog__lead', 'Become a Premium customer and get:');
  const perkUl = h('ul', 'join-dialog__perks');
  perkUl.append(...perks.map((p) => h('li', null, p)));
  const form = document.createElement('form');
  form.noValidate = true;
  const nameLabel = h('label', 'order-field', 'Your name (shown on the leaderboard)');
  const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.maxLength = 24; nameIn.autocomplete = 'name'; nameIn.required = true; nameIn.placeholder = 'For example: Rahul';
  nameLabel.append(nameIn);
  const phoneLabel = h('label', 'order-field', 'Mobile number (private, only the owner sees it)');
  const phoneIn = document.createElement('input');
  phoneIn.type = 'tel'; phoneIn.inputMode = 'numeric'; phoneIn.autocomplete = 'tel'; phoneIn.maxLength = 16; phoneIn.required = true; phoneIn.placeholder = '99377 22001';
  phoneLabel.append(phoneIn);
  const consentLabel = h('label', 'join-consent');
  const consent = document.createElement('input');
  consent.type = 'checkbox';
  consentLabel.append(consent, h('span', null, 'I am happy for my name and spending to show on the public leaderboard.'));
  const err = h('p', 'join-error');
  err.setAttribute('role', 'alert');
  const note = h('p', 'order-note', 'The owner approves each request. You can order from the website straight after.');
  const submit = h('button', 'btn btn--gold', 'Join Premium');
  submit.type = 'submit';
  form.append(nameLabel, phoneLabel, consentLabel, err, note, submit);
  const done = h('div', 'join-done');
  done.hidden = true;
  panel.append(head, lead, perkUl, form, done);
  dialog.append(panel);
  document.body.append(dialog);

  function showDone(text) {
    form.hidden = true; lead.hidden = true; perkUl.hidden = true;
    done.hidden = false;
    done.replaceChildren(h('p', 'join-done__title', 'Request sent'), h('p', null, text));
    const ok = h('button', 'btn btn--ghost', 'Close');
    ok.type = 'button';
    ok.addEventListener('click', () => dialog.close());
    done.append(ok);
  }

  function openJoin() {
    if (html.classList.contains('live-off')) { toast('Premium needs the live server, which is offline right now.'); return; }
    const m = getMember();
    err.textContent = '';
    if (m) {
      showDone(me && me.status === 'approved' ? 'You are already a BigBoss Premium customer.' : 'Your request is waiting for the owner to approve it.');
    } else {
      form.hidden = false; lead.hidden = false; perkUl.hidden = false; done.hidden = true;
    }
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    if (!m) nameIn.focus();
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    err.textContent = '';
    if (nameIn.value.trim().length < 2) { err.textContent = 'Please enter your name.'; nameIn.focus(); return; }
    if (phoneIn.value.replace(/\D/g, '').length < 10) { err.textContent = 'Please enter a valid 10-digit mobile number.'; phoneIn.focus(); return; }
    if (!consent.checked) { err.textContent = 'Please tick the box to show your name on the leaderboard.'; consent.focus(); return; }
    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      const r = await post('/api/member/join', { name: nameIn.value, phone: phoneIn.value });
      setMember({ token: r.token, name: r.name });
      showDone('Thank you, ' + r.name + '. The owner will approve your Premium membership soon. Your name appears on the leaderboard once you place an order and the owner accepts it.');
      refreshMe();
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Join Premium';
    }
  };
  form.addEventListener('submit', onSubmit);
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  // ----- clicks: join buttons, "see leaderboard", sending an order -----
  async function submitOrder() {
    const m = getMember();
    if (!m || !me || me.status !== 'approved') return;
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem('bbp-order-v1') || '{}').ids || []; } catch (e) { /* ignore */ }
    if (!ids.length) return;
    try {
      const r = await post('/api/order', { token: m.token, items: ids });
      toast(`Order of ₹${fmt(r.total)} sent to the owner. It joins the leaderboard once accepted.`);
      setTimeout(refreshMe, 800);
    } catch (ex) {
      toast(ex.message);
    }
  }

  const onClick = (e) => {
    if (e.target.closest('[data-join]')) { e.preventDefault(); openJoin(); return; }
    if (e.target.closest('[data-open-board]')) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const panelEl = $('lb-panel');
      if (panelEl && panelEl.hidden) $('lb-toggle')?.click();
      return;
    }
    if (e.target.closest('#lb-toggle')) { refreshMe(); return; }
    if (e.target.closest('.order-send')) submitOrder();
  };
  document.addEventListener('click', onClick);

  const onStats = (e) => renderBoards(e.detail && e.detail.board);
  document.addEventListener('bbp:stats', onStats);

  const poll = setInterval(() => { if (!document.hidden && getMember()) refreshMe(); }, 30000);

  renderMe();
  refreshMe();

  cleanups.push(() => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('bbp:stats', onStats);
    form.removeEventListener('submit', onSubmit);
    clearInterval(poll);
    clearTimeout(toastTimer);
    dialog.remove();
    toastEl.remove();
  });
  return () => cleanups.forEach((fn) => fn());
}
