import '@fontsource/bebas-neue/400.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './styles/main.css';

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bindBusiness } from './lib/bind.js';
import { initNav } from './lib/nav.js';
import { initStatusUi } from './lib/statusUi.js';
import { initAnimations } from './animations.js';

const html = document.documentElement;
const cleanups = [];

function fontsReady() {
  const wait = new Promise((resolve) => setTimeout(resolve, 1500));
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  return Promise.race([fonts, wait]);
}

function hardwareProfile() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  return {
    allowed: !(mem <= 1 || (coarse && cores <= 2)), // very weak phones keep the CSS fallback
    lite: coarse && (mem <= 4 || cores <= 4)         // phones get a lighter 3D scene, same look
  };
}

async function startHero() {
  const canvas = document.getElementById('hero-canvas');
  const { allowed, lite } = hardwareProfile();
  if (!canvas || !allowed) { html.classList.add('no-webgl'); return; }
  try {
    const { createHero } = await import('./three/hero.js');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hero = createHero(canvas, { lite, reducedMotion });
    cleanups.push(hero.dispose);
    html.classList.add('has-webgl');
  } catch (err) {
    console.warn('3D hero unavailable, using the CSS fallback:', err);
    html.classList.add('no-webgl');
  }
}

async function boot() {
  bindBusiness();
  cleanups.push(initNav(), initStatusUi());
  startHero(); // loads in parallel; the page never waits for it
  await fontsReady();
  cleanups.push(initAnimations());
  ScrollTrigger.refresh();
  html.classList.add('is-ready');
  const loader = document.getElementById('loader');
  if (loader) loader.setAttribute('aria-hidden', 'true');
}

boot().catch((err) => {
  console.error('Startup problem:', err);
  html.classList.add('is-ready'); // never leave the visitor stuck on the loader
});

function cleanupAll() {
  while (cleanups.length) {
    const fn = cleanups.pop();
    try { fn(); } catch (e) { /* ignore */ }
  }
}
window.addEventListener('pagehide', (e) => { if (!e.persisted) cleanupAll(); });
if (import.meta.hot) import.meta.hot.dispose(cleanupAll);
