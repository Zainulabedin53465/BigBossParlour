// Live status: loads announcement.json, combines it with the India-time clock, paints the page.
import { business } from '../config/business.js';
import { evaluateStatus, formatClock } from './status.js';

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text; // textContent only: owner text can never inject HTML
  return node;
}

async function fetchAnnouncement() {
  const url = new URL(business.announcementUrl, document.baseURI);
  url.searchParams.set('t', String(Date.now())); // skip stale caches
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid announcement file');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function paintAlert(container, alert) {
  container.replaceChildren();
  container.dataset.tone = alert.tone;
  container.append(el('p', 'status-alert__label', alert.label), el('p', 'status-alert__title', alert.title));
  if (alert.message) container.append(el('p', 'status-alert__msg', alert.message));
  if (alert.lines && alert.lines.length) {
    const ul = el('ul', 'status-alert__lines');
    alert.lines.forEach((line) => ul.append(el('li', null, line)));
    container.append(ul);
  }
}

export function initStatusUi() {
  const state = { announcement: null, loaded: false, error: false, checkedAt: null, busy: false };
  const refreshBtn = $('status-refresh');

  function render() {
    const now = new Date();
    const result = evaluateStatus(state.announcement, now);
    let { badge, tone, headline } = result;
    let note = 'Please check the latest announcement before visiting. Closures appear here only after the owner publishes them.';

    if (!state.loaded) {
      badge = 'CHECKING STATUS…';
      tone = 'neutral';
      headline = 'Checking the latest announcement…';
    } else if (state.error) {
      note = 'We could not load the latest announcement. Please call or message before you travel.';
      if (!state.announcement && result.regularOpen) {
        badge = 'OPEN BY REGULAR HOURS';
        tone = 'neutral';
      }
    }

    document.querySelectorAll('[data-status-badge]').forEach((n) => { n.textContent = badge; });
    document.querySelectorAll('[data-status-tone]').forEach((n) => { n.dataset.statusTone = tone; });
    document.documentElement.dataset.shopState = state.loaded ? result.state : 'unknown';

    $('status-clock').textContent = formatClock(now);
    $('status-headline').textContent = headline;
    $('status-note').textContent = note;
    $('status-meta').textContent = state.checkedAt ? `Last checked ${formatClock(state.checkedAt)} IST.` : '';

    const panel = $('status-alert');
    const bar = $('alert-bar');
    if (state.loaded && result.alert) {
      paintAlert(panel, result.alert);
      panel.hidden = false;
      bar.dataset.tone = result.alert.tone;
      $('alert-label').textContent = result.alert.label;
      const first = result.alert.lines && result.alert.lines[0];
      $('alert-text').textContent = result.alert.title + (first ? ' — ' + first : '');
      bar.hidden = false;
    } else {
      panel.hidden = true;
      bar.hidden = true;
    }
  }

  async function refresh(manual = false) {
    if (state.busy) return;
    state.busy = true;
    if (manual && refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = 'Checking…'; }
    try {
      state.announcement = await fetchAnnouncement();
      state.error = false;
    } catch (err) {
      state.error = true;
      console.warn('Announcement check failed:', err && err.message);
    }
    state.loaded = true;
    state.checkedAt = new Date();
    state.busy = false;
    render();
    if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = 'Check latest notice'; }
  }

  const onRefreshClick = () => refresh(true);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && (!state.checkedAt || Date.now() - state.checkedAt.getTime() > 30000)) refresh();
  };
  if (refreshBtn) refreshBtn.addEventListener('click', onRefreshClick);
  document.addEventListener('visibilitychange', onVisible);

  render();
  refresh();
  const tick = setInterval(render, 30000);
  const poll = setInterval(refresh, business.announcementRefreshMs);

  return () => {
    clearInterval(tick);
    clearInterval(poll);
    document.removeEventListener('visibilitychange', onVisible);
    if (refreshBtn) refreshBtn.removeEventListener('click', onRefreshClick);
  };
}
