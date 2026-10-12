// 3D hero: a gold-and-chrome pair of scissors with floating gold dust.
// Scroll opens the blades. Pauses when off-screen. Fully disposed on cleanup.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { heroState } from '../lib/state.js';

const BLADE = [[-0.1, -0.2], [0.22, -0.2], [0.13, 3.3], [0.0, 3.8]];
const SHANK = [[-0.09, -1.3], [0.2, -1.3], [0.22, -0.2], [-0.1, -0.2]];

export function createHero(canvas, { lite = false, reducedMotion = false } = {}) {
  // Throws if WebGL is unavailable. main.js catches it and keeps the CSS fallback.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.9;

  const geometries = [];
  const materials = [];
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.28 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dbe0, metalness: 1, roughness: 0.16 });
  const darkGold = new THREE.MeshStandardMaterial({ color: 0x8a6a1c, metalness: 1, roughness: 0.4 });
  materials.push(gold, chrome, darkGold);

  function poly(points, depth = 0.07) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8 });
    geo.translate(0, 0, -depth / 2);
    geometries.push(geo);
    return geo;
  }

  const ringGeo = new THREE.TorusGeometry(0.56, 0.12, 20, 48);
  geometries.push(ringGeo);

  function makeHalf(z) {
    const half = new THREE.Group();
    half.add(new THREE.Mesh(poly(BLADE), chrome));
    half.add(new THREE.Mesh(poly(SHANK, 0.09), gold));
    const ring = new THREE.Mesh(ringGeo, gold);
    ring.position.set(0.05, -1.78, 0);
    half.add(ring);
    half.position.z = z;
    return half;
  }

  const halfA = makeHalf(0.045);
  const halfB = makeHalf(-0.045);
  const screwGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.34, 24);
  screwGeo.rotateX(Math.PI / 2);
  geometries.push(screwGeo);
  const screw = new THREE.Mesh(screwGeo, darkGold);

  const scissors = new THREE.Group();
  scissors.add(halfA, halfB, screw);
  scissors.rotation.z = -0.35;
  const rig = new THREE.Group();
  rig.add(scissors);
  scene.add(rig);

  // Lights
  const key = new THREE.SpotLight(0xffe0a8, 120, 0, 0.55, 0.6, 2);
  key.position.set(4, 6, 7);
  const rim = new THREE.PointLight(0xd4af37, 40, 20, 2);
  rim.position.set(-5, -2, 3);
  scene.add(key, rim);

  // Gold dust
  const count = lite ? 160 : 420;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 11;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
    speeds[i] = 0.12 + Math.random() * 0.25;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometries.push(dustGeo);
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const sctx = sprite.getContext('2d');
  const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(1, 'rgba(255,240,200,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const spriteTex = new THREE.CanvasTexture(sprite);
  const dustMat = new THREE.PointsMaterial({ map: spriteTex, size: lite ? 0.14 : 0.11, color: 0xf3d98b, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.push(dustMat);
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // Layout: scissors on the right on wide screens, centred behind the text on phones
  const base = { y: 0 };
  function layout(aspect) {
    if (aspect > 1.15) { rig.position.set(3.0, 0.1, 0); rig.scale.setScalar(0.95); }
    else { rig.position.set(0, -0.2, 0); rig.scale.setScalar(0.72); }
    base.y = rig.position.y;
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  function update(t) {
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const p = heroState.progress;
    const idle = reducedMotion ? 0 : Math.sin(t * 0.9) * 0.025;
    const open = 0.1 + 0.32 * p + idle;
    halfA.rotation.z = open;
    halfB.rotation.z = -open;
    scissors.rotation.y = (reducedMotion ? 0 : Math.sin(t * 0.35) * 0.35) + pointer.x * 0.3 + p * 0.9;
    scissors.rotation.x = -pointer.y * 0.18;
    rig.position.y = base.y + p * 1.4;

    if (!reducedMotion) {
      const arr = dustGeo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i * 3 + 1] += speeds[i] * 0.012;
        arr[i * 3] += Math.sin(t * 0.3 + i) * 0.0015;
        if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = -5.5;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }
  }

  function renderFrame(t) {
    update(t);
    renderer.render(scene, camera);
  }

  // Loop control: only render while visible, and never when reduced motion is on
  let raf = 0;
  let visible = true;
  let pageVisible = !document.hidden;
  let last = 0;
  const frameGap = lite ? 33 : 0;
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (frameGap && ts - last < frameGap) return;
    last = ts;
    renderFrame(ts / 1000);
  }
  function sync() {
    const shouldRun = visible && pageVisible && !reducedMotion;
    if (shouldRun && !raf) raf = requestAnimationFrame(loop);
    else if (!shouldRun && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layout(w / h);
    if (reducedMotion) renderFrame(0);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 });
  io.observe(canvas.parentElement || canvas);
  const onVis = () => { pageVisible = !document.hidden; sync(); };
  document.addEventListener('visibilitychange', onVis);

  const onLost = (e) => {
    e.preventDefault();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    document.documentElement.classList.remove('has-webgl');
    document.documentElement.classList.add('no-webgl');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  renderFrame(0); // first frame immediately so there is never an empty canvas
  sync();

  function dispose() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('webglcontextlost', onLost);
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    spriteTex.dispose();
    envTexture.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { dispose };
}
