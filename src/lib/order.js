// Order builder: "Add" buttons on every service, a bottom tray, and a checkout window
// that opens WhatsApp with the whole order already written.
// The website never confirms a booking. The customer sends the message, the owner replies.
import { business } from '../config/business.js';
import { buildOrderUrl, orderTotal, pickServices, money } from './orderMessage.js';

const STORE_KEY = 'bbp-order-v1';
const byId = Object.fromEntries(business.services.map((s) => [s.id, s]));

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (data && Array.isArray(data.ids)) {
      return {
        ids: [...new Set(data.ids.filter((id) => typeof id === 'string' && byId[id]))],
        name: typeof data.name === 'string' ? data.name.slice(0, 60) : ''
      };
    }
  } catch (e) { /* storage blocked or broken: start with an empty order */ }
  return { ids: [], name: '' };
}

function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function makeToggle(id) {
  const btn = h('button', 'order-btn');
  btn.type = 'button';
  btn.dataset.order = id;
  btn.setAttribute('aria-pressed', 'false');
  btn.append(h('span', 'order-btn__icon'), h('span', 'order-btn__text', 'Add'));
  btn.querySelector('.order-btn__icon').setAttribute('aria-hidden', 'true');
  return btn;
}

export function initOrder() {
  const html = document.documentElement;
  const state = loadState();

  // ----- 1. Put an Add button on every priced item -----
  function addToggle(container, id) {
    if (!byId[id] || container.querySelector('[data-order]')) return;
    container.append(makeToggle(id));
  }
  document.querySelectorAll('#price-board .price-row[data-service]').forEach((row) => addToggle(row, row.dataset.service));
  document.querySelectorAll('.price-tag, .price-sub li').forEach((el) => {
    const priceEl = el.querySelector('[data-price]');
    if (priceEl) addToggle(el, priceEl.dataset.price);
  });

  // ----- 2. Bottom tray -----
  const live = h('p', 'sr-only');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');

  const tray = h('div', 'order-tray');
  tray.hidden = true;
  const openBtn = h('button', 'order-tray__open');
  openBtn.type = 'button';
  openBtn.setAttribute('aria-haspopup', 'dialog');
  const trayCount = h('span', 'order-tray__count');
  const trayTotal = h('span', 'order-tray__total');
  openBtn.append(trayCount, trayTotal, h('span', 'order-tray__cta', 'View order'));
  tray.append(openBtn);

  // ----- 3. Checkout window -----
  const dialog = document.createElement('dialog');
  dialog.className = 'order-dialog';
  dialog.setAttribute('aria-labelledby', 'order-title');
  const panel = h('div', 'order-dialog__panel');

  const head = h('div', 'order-dialog__head');
  const title = h('h2', null, 'Your order');
  title.id = 'order-title';
  const closeBtn = h('button', 'order-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close order window');
  head.append(title, closeBtn);

  const list = h('ul', 'order-list');
  const totalValue = h('strong');
  const totalRow = h('p', 'order-total');
  totalRow.append(h('span', null, 'Total'), totalValue);

  const field = h('label', 'order-field', 'Your name (optional)');
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 60;
  input.autocomplete = 'name';
  input.placeholder = 'For example: Rahul';
  input.value = state.name;
  field.append(input);

  const note = h('p', 'order-note', 'WhatsApp opens with your order already written. Press Send there. Your order is not confirmed until the parlour replies.');

  const actions = h('div', 'actions');
  const send = h('a', 'btn btn--gold order-send', 'Send order on WhatsApp');
  send.target = '_blank';
  send.rel = 'noopener noreferrer';
  const clearBtn = h('button', 'btn btn--ghost', 'Clear order');
  clearBtn.type = 'button';
  actions.append(send, clearBtn);

  panel.append(head, list, totalRow, field, note, actions);
  dialog.append(panel);
  document.body.append(live, tray, dialog);

  // ----- 4. Drawing -----
  function updateLink() {
    send.href = buildOrderUrl(state.ids, state.name) || '#';
  }

  function render(announce = false) {
    const items = pickServices(state.ids);
    const total = orderTotal(items);

    document.querySelectorAll('[data-order]').forEach((btn) => {
      const id = btn.dataset.order;
      const on = state.ids.includes(id);
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', `${on ? 'Remove' : 'Add'} ${byId[id].name} ${on ? 'from' : 'to'} your order`);
      btn.querySelector('.order-btn__text').textContent = on ? 'Added' : 'Add';
    });

    tray.hidden = items.length === 0;
    html.classList.toggle('has-order', items.length > 0);
    trayCount.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
    trayTotal.textContent = money(total);

    list.replaceChildren(...items.map((s) => {
      const li = h('li');
      const rm = h('button', 'order-remove', '×');
      rm.type = 'button';
      rm.dataset.remove = s.id;
      rm.setAttribute('aria-label', `Remove ${s.name} from your order`);
      li.append(h('span', 'order-list__name', s.name), h('span', 'order-list__price', money(s.price)), rm);
      return li;
    }));
    totalValue.textContent = money(total);
    updateLink();

    if (!items.length && dialog.open) closeDialog();
    if (announce) {
      live.textContent = items.length
        ? `${items.length} ${items.length === 1 ? 'item' : 'items'} in your order. Total ${money(total)}.`
        : 'Your order is empty.';
    }
  }

  function openDialog() {
    if (!pickServices(state.ids).length) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    html.classList.add('order-open');
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    html.classList.remove('order-open');
  }

  function toggle(id) {
    const i = state.ids.indexOf(id);
    if (i >= 0) state.ids.splice(i, 1);
    else state.ids.push(id);
    saveState(state);
    render(true);
  }

  // ----- 5. Events -----
  const onDocClick = (e) => {
    const btn = e.target.closest('[data-order]');
    if (btn) toggle(btn.dataset.order);
  };
  const onListClick = (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) toggle(rm.dataset.remove);
  };
  const onClear = () => { state.ids = []; saveState(state); render(true); };
  const onInput = () => { state.name = input.value; saveState(state); updateLink(); };
  const onDialogClick = (e) => { if (e.target === dialog) closeDialog(); };
  const onDialogClose = () => html.classList.remove('order-open');

  document.addEventListener('click', onDocClick);
  list.addEventListener('click', onListClick);
  clearBtn.addEventListener('click', onClear);
  input.addEventListener('input', onInput);
  openBtn.addEventListener('click', openDialog);
  closeBtn.addEventListener('click', closeDialog);
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('close', onDialogClose);

  render(false);

  return () => {
    document.removeEventListener('click', onDocClick);
    list.removeEventListener('click', onListClick);
    clearBtn.removeEventListener('click', onClear);
    input.removeEventListener('input', onInput);
    openBtn.removeEventListener('click', openDialog);
    closeBtn.removeEventListener('click', closeDialog);
    dialog.removeEventListener('click', onDialogClick);
    dialog.removeEventListener('close', onDialogClose);
    html.classList.remove('has-order', 'order-open');
    live.remove();
    tray.remove();
    dialog.remove();
  };
}
