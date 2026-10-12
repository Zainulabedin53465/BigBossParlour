// Fills the page from src/config/business.js so prices/phone/hours live in ONE place.
import { business } from '../config/business.js';
import { telUrl, whatsappUrl } from './links.js';

const all = (sel) => document.querySelectorAll(sel);

export function bindBusiness() {
  const byId = Object.fromEntries(business.services.map((s) => [s.id, s]));

  all('[data-price]').forEach((el) => {
    const s = byId[el.dataset.price];
    if (s) el.textContent = s.price.toLocaleString('en-IN');
  });
  all('[data-service-name]').forEach((el) => {
    const s = byId[el.dataset.serviceName];
    if (s) el.textContent = s.name;
  });

  const values = {
    name: business.name,
    tagline: business.tagline,
    phone: business.phoneDisplay,
    hours: `${business.hours.openLabel}–${business.hours.closeLabel}`
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
    el.href = whatsappUrl(message);
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  });

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}
