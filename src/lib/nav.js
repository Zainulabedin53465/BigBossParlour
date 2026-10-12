// Mobile menu, scene dots and "which scene am I in" tracking.
import { scenes } from '../config/scenes.js';

export function initNav() {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('menu');
  const list = document.getElementById('menu-list');
  const rail = document.getElementById('rail');
  const header = document.querySelector('.site-header');
  const html = document.documentElement;
  const cleanups = [];

  scenes.forEach((scene, i) => {
    const num = String(i + 1).padStart(2, '0');

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${scene.id}`;
    const n = document.createElement('span');
    n.className = 'menu__num';
    n.textContent = num;
    const label = document.createElement('span');
    label.textContent = scene.label;
    a.append(n, label);
    li.append(a);
    list.append(li);

    const dot = document.createElement('a');
    dot.href = `#${scene.id}`;
    dot.setAttribute('aria-label', `Scene ${i + 1}: ${scene.label}`);
    dot.title = scene.label;
    rail.append(dot);
  });

  function setOpen(open, returnFocus = true) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    html.classList.toggle('menu-open', open);
    if (open) menu.querySelector('a')?.focus();
    else if (returnFocus) toggle.focus();
  }
  const isOpen = () => !menu.hidden;

  const onToggle = () => setOpen(!isOpen());
  const onMenuClick = (e) => { if (e.target.closest('a')) setOpen(false, false); };
  const onKey = (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;
    const items = [toggle, ...menu.querySelectorAll('a')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  toggle.addEventListener('click', onToggle);
  menu.addEventListener('click', onMenuClick);
  document.addEventListener('keydown', onKey);
  cleanups.push(() => {
    toggle.removeEventListener('click', onToggle);
    menu.removeEventListener('click', onMenuClick);
    document.removeEventListener('keydown', onKey);
    html.classList.remove('menu-open');
  });

  // Highlight the current scene in the menu + dots.
  const links = [...document.querySelectorAll('#menu-list a, #rail a')];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const href = '#' + entry.target.id;
      links.forEach((l) => {
        if (l.getAttribute('href') === href) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  scenes.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
  cleanups.push(() => io.disconnect());

  const onScroll = () => { header.classList.toggle('is-scrolled', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));

  return () => cleanups.forEach((fn) => fn());
}
