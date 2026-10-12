// Scroll animation (GSAP + ScrollTrigger). Normal scrolling is never hijacked: no pinning, no smooth-scroll library.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { heroState } from './lib/state.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

function splitWords(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const frag = document.createDocumentFragment();
  text.split(/\s+/).forEach((word, i, arr) => {
    const outer = document.createElement('span');
    outer.className = 'w';
    outer.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'wi';
    inner.textContent = word;
    outer.append(inner);
    frag.append(outer);
    if (i < arr.length - 1) frag.append(document.createTextNode(' '));
  });
  el.append(frag);
  return qsa('.wi', el);
}

export function initAnimations() {
  const mm = gsap.matchMedia();

  // Only runs when the visitor has NOT asked for reduced motion. Otherwise everything simply stays visible.
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const small = window.matchMedia('(max-width: 760px)').matches;
    const k = small ? 0.5 : 1; // lighter movement on phones, same look
    const cleanups = [];

    // --- Scene 1: controlled cinematic reveal ---
    const introWords = splitWords(qs('#s1-title'));
    gsap.timeline({ delay: 0.5, defaults: { ease: 'power3.out' } })
      .from('.beam', { opacity: 0, scaleY: 0.2, transformOrigin: '50% 0%', duration: 1.8 }, 0)
      .from('.intro .eyebrow', { opacity: 0, y: 14, duration: 0.8 }, 0.2)
      .from(introWords, { yPercent: 115, rotate: 3, duration: 1.1, stagger: 0.09 }, 0.3)
      .from('.intro .tagline', { opacity: 0, letterSpacing: small ? '0.5em' : '0.8em', duration: 1.4 }, 0.8)
      .from('.intro .lede, .intro .actions', { opacity: 0, y: 22, duration: 0.9, stagger: 0.12 }, 1.1)
      .from('.scroll-cue', { opacity: 0, duration: 0.8 }, 1.6);

    // Scroll progress drives the 3D scissors (opening + drift)
    ScrollTrigger.create({
      trigger: '#scene-1', start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (self) => { heroState.progress = self.progress; }
    });
    cleanups.push(() => { heroState.progress = 0; });

    gsap.to('.intro', {
      opacity: 0, y: -60 * k, ease: 'none',
      scrollTrigger: { trigger: '#scene-1', start: '35% top', end: '85% top', scrub: true }
    });

    // --- Headline word reveals ---
    qsa('.split').forEach((h) => {
      if (h.id === 's1-title') return;
      const words = splitWords(h);
      gsap.from(words, {
        yPercent: 115, duration: 1, stagger: 0.07, ease: 'power3.out',
        scrollTrigger: { trigger: h, start: 'top 88%', once: true }
      });
    });

    // --- Generic fade-up reveals ---
    qsa('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        opacity: 0, y: 36 * k, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });

    // --- Layered parallax ---
    qsa('[data-depth]').forEach((el) => {
      const d = parseFloat(el.dataset.depth) || 0;
      gsap.fromTo(el, { y: d * 160 * k }, {
        y: -d * 160 * k, ease: 'none',
        scrollTrigger: { trigger: el.closest('.scene'), start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      });
    });

    // --- Sideways slides (scene 4) ---
    qsa('[data-slide]').forEach((el) => {
      const dir = el.dataset.slide === 'left' ? -1 : 1;
      gsap.from(el, {
        x: dir * 140 * k, opacity: 0, duration: 1.4, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // --- Scene 3: cinematic image reveal ---
    qsa('.reveal-frame').forEach((frame) => {
      gsap.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut',
        scrollTrigger: { trigger: frame, start: 'top 82%', once: true }
      });
      const inner = qs('.art-inner', frame);
      if (inner) {
        gsap.fromTo(inner, { scale: 1.25 }, {
          scale: 1, duration: 1.8, ease: 'power3.out',
          scrollTrigger: { trigger: frame, start: 'top 82%', once: true }
        });
      }
    });

    // --- Scene 4: horizontal marquee motion ---
    qsa('.marquee__track').forEach((track, i) => {
      const forward = i % 2 === 1;
      gsap.fromTo(track, { xPercent: forward ? -30 : 0 }, {
        xPercent: forward ? 0 : -30, ease: 'none',
        scrollTrigger: { trigger: track.closest('.scene'), start: 'top bottom', end: 'bottom top', scrub: 0.5 }
      });
    });

    // --- Scene 5: lighting turns warm as you arrive ---
    gsap.fromTo('.warm-glow', { opacity: 0 }, {
      opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '#scene-5', start: 'top 85%', end: 'top 25%', scrub: true }
    });

    // --- Scene 7: price rows rise in with depth ---
    gsap.from('.price-row', {
      opacity: 0, y: 34 * k, rotateX: -22, transformOrigin: '50% 100%', stagger: 0.12, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: '.price-board', start: 'top 82%', once: true }
    });
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const board = qs('.price-board');
      if (board) {
        const rx = gsap.quickTo(board, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        const ry = gsap.quickTo(board, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        const move = (e) => {
          const r = board.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 6);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 5);
        };
        const leave = () => { rx(0); ry(0); };
        board.addEventListener('pointermove', move);
        board.addEventListener('pointerleave', leave);
        cleanups.push(() => { board.removeEventListener('pointermove', move); board.removeEventListener('pointerleave', leave); });
      }
    }

    // --- Scene 8: tools drift across, leading into booking ---
    gsap.fromTo('.tool-strip', { xPercent: 8 }, {
      xPercent: -30, ease: 'none',
      scrollTrigger: { trigger: '#scene-8', start: 'top bottom', end: 'bottom top', scrub: 0.6 }
    });

    // --- Scene 10: dramatic gold light, then the wordmark ---
    gsap.from('.finale__light', {
      scaleY: 0, opacity: 0, transformOrigin: '50% 0%', duration: 1.8, ease: 'power3.out',
      scrollTrigger: { trigger: '#scene-10', start: 'top 60%', once: true }
    });
    gsap.from('.finale__mark', {
      opacity: 0, scale: 0.9, duration: 1.6, ease: 'power3.out',
      scrollTrigger: { trigger: '.finale__mark', start: 'top 90%', once: true }
    });

    return () => cleanups.forEach((fn) => fn());
  });

  return () => mm.revert();
}
