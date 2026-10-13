// Smooth 3D tilt for cards marked data-tilt, and hides cards whose optional cover image is missing.
// Mouse / trackpad: the card follows the pointer.
// Touch phones: a gentle CSS float (only cheap GPU movement, so it stays smooth on any Android).
export function initTilt() {
  const cleanups = [];
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hide a card when its cover image file does not exist.
  document.querySelectorAll('[data-hide-if-missing]').forEach((card) => {
    const img = card.querySelector('img');
    if (!img) return;
    const hide = () => { card.hidden = true; };
    img.addEventListener('error', hide, { once: true });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) hide();
  });

  const cards = [...document.querySelectorAll('[data-tilt]')];

  // Only animate cards that are on screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('in-view', e.isIntersecting));
    }, { rootMargin: '80px' });
    cards.forEach((c) => io.observe(c));
    cleanups.push(() => io.disconnect());
  } else {
    cards.forEach((c) => c.classList.add('in-view'));
  }

  if (fine && !reduce) {
    cards.forEach((card) => {
      let frame = 0;
      let rx = 0;
      let ry = 0;
      const paint = () => {
        frame = 0;
        card.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        card.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      };
      const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        ry = ((e.clientX - r.left) / r.width - 0.5) * 16;
        rx = -((e.clientY - r.top) / r.height - 0.5) * 16;
        queue();
      };
      const onLeave = () => { rx = 0; ry = 0; queue(); };
      card.classList.add('is-tilting');
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
        if (frame) cancelAnimationFrame(frame);
        card.classList.remove('is-tilting');
      });
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
