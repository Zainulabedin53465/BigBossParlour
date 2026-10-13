// Fills the page from src/config/business.js so prices/phone/hours live in ONE place.
import { business } from '../config/business.js';
import { telUrl, whatsappUrl } from './links.js';

const all = (sel) => document.querySelectorAll(sel);
const fmt = (n) => n.toLocaleString('en-IN');

function span(className, text) {
  const node = document.createElement('span');
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function openInNewTab(el, url) {
  el.href = url;
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
}

// Builds the big price board (scene 7) and the small price list (scene 10) from the config.
function renderPriceLists() {
  const board = document.getElementById('price-board');
  if (board) {
    board.replaceChildren(...business.services.map((s) => {
      const li = document.createElement('li');
      li.className = 'price-row';
      li.dataset.service = s.id; // the order buttons use this
      const line = span('price-row__line');
      line.setAttribute('aria-hidden', 'true');
      const amt = span('price-row__amt gold-text');
      amt.append(span('rupee', '₹'), span('', fmt(s.price)));
      li.append(span('price-row__name', s.name), line, amt);
      return li;
    }));
  }

  const mini = document.getElementById('mini-prices');
  if (mini) {
    mini.replaceChildren(...business.services.map((s) => {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.className = 'gold-text';
      b.append(span('rupee', '₹'), span('', fmt(s.price)));
      li.append(span('', s.name + ' '), b);
      return li;
    }));
  }
}

export function bindBusiness() {
  renderPriceLists();
  const byId = Object.fromEntries(business.services.map((s) => [s.id, s]));

  all('[data-price]').forEach((el) => {
    const s = byId[el.dataset.price];
    if (s) el.textContent = fmt(s.price);
  });
  all('[data-service-name]').forEach((el) => {
    const s = byId[el.dataset.serviceName];
    if (s) el.textContent = s.name;
  });

  const values = {
    name: business.name,
    tagline: business.tagline,
    phone: business.phoneDisplay,
    hours: `${business.hours.openLabel}–${business.hours.closeLabel}`,
    ownerName: business.owner.name,
    ownerRole: business.owner.role,
    handle: business.social.handle
  };
  all('[data-bind]').forEach((el) => {
    const v = values[el.dataset.bind];
    if (v != null) el.textContent = v;
  });

  all('[data-tel]').forEach((el) => { el.href = telUrl(); });
  all('[data-wa]').forEach((el) => {
    const s = byId[el.dataset.waService];
    const message = s
      ? `Hello ${business.name.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase())}! I would like to enquire about ${s.name.toLowerCase()} (₹${s.price}).`
      : undefined;
    openInNewTab(el, whatsappUrl(message));
  });
  all('[data-reel]').forEach((el) => openInNewTab(el, business.social.reelUrl));
  all('[data-reel-featured]').forEach((el) => openInNewTab(el, business.social.featuredReelUrl));
  all('[data-ig-profile]').forEach((el) => openInNewTab(el, business.social.profileUrl));

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}
