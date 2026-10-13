// Photo helpers: hides a photo card whose optional image file is missing,
// and lifts the "curtain" on each photo when it scrolls into view.
// Visitors who prefer reduced motion simply see the photos right away.
export function initPhotos() {
  const root = document.documentElement;
  const photos = [...document.querySelectorAll('.photo')];

  photos.forEach((card) => {
    const img = card.querySelector('img[data-optional]');
    if (!img) return;
    const hide = () => { card.hidden = true; };
    img.addEventListener('error', hide, { once: true });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) hide();
  });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return () => {};

  root.classList.add('photos-ready');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  photos.forEach((card) => io.observe(card));

  return () => { io.disconnect(); root.classList.remove('photos-ready'); };
}
