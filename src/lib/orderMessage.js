// Builds the WhatsApp order message. Pure functions: no page code, easy to test.
import { business } from '../config/business.js';
import { whatsappUrl } from './links.js';

export const money = (n) => `₹${n.toLocaleString('en-IN')}`;

// Keeps menu order, ignores unknown ids and duplicates.
export function pickServices(ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return business.services.filter((s) => wanted.has(s.id));
}

export function orderTotal(items) {
  return items.reduce((sum, s) => sum + s.price, 0);
}

export function buildOrderMessage(ids, customerName = '') {
  const items = pickServices(ids);
  if (!items.length) return '';

  const brand = business.name.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase());
  const lines = [`Hello ${brand}! I would like to place this order:`, ''];
  items.forEach((s, i) => lines.push(`${i + 1}. ${s.name} — ${money(s.price)}`));
  lines.push('', `Total: ${money(orderTotal(items))}`);

  const name = String(customerName || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (name) lines.push(`Name: ${name}`);

  lines.push('', 'Please confirm availability and timing. Thank you!');
  return lines.join('\n');
}

export function buildOrderUrl(ids, customerName = '') {
  const message = buildOrderMessage(ids, customerName);
  return message ? whatsappUrl(message) : '';
}
