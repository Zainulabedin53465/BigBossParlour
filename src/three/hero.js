// 3D hero: gold-and-chrome scissors, straight razor, comb, barber pole and a gold halo, with floating gold dust.
// Scroll opens the blades. Pauses when off-screen. Fully disposed on cleanup.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { heroState } from '../lib/state.js';

const BLADE = [[-0.1, -0.2], [0.22, -0.2], [0.13, 3.3], [0.0, 3.8]];
const SHANK = [[-0.09, -1.3], [0.2, -1.3], [0.22, -0.2], [-0.1, -0.2]];
const RAZOR_BLADE = [[0, -0.15], [1.9, -0.15], [2.12, 0.0], [1.9, 0.17], [0, 0.17]];

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
  const textures = [];
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

  function geo(g) { geometries.push(g); return g; }

  // ---------- scissors (the star of the scene) ----------
  const ringGeo = geo(new THREE.TorusGeometry(0.56, 0.12, 20, 48));

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
  const screwGeo = geo(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 24));
  screwGeo.rotateX(Math.PI / 2);
  const screw = new THREE.Mesh(screwGeo, darkGold);

  const scissors = new THREE.Group();
  scissors.add(halfA, halfB, screw);
  scissors.rotation.z = -0.35;
  const rig = new THREE.Group();
  rig.add(scissors);
  scene.add(rig);

  // ---------- supporting props (wide screens only) ----------
  const props = new THREE.Group();
  rig.add(props);

  // Gold halo behind the scissors
  const halo = new THREE.Mesh(geo(new THREE.TorusGeometry(3.3, 0.022, 8, 160)), gold);
  halo.position.set(0, 0.9, -0.9);
  halo.rotation.x = 1.1;
  const halo2 = new THREE.Mesh(geo(new THREE.TorusGeometry(2.7, 0.014, 8, 140)), chrome);
  halo2.position.set(0, 0.9, -0.9);
  halo2.rotation.set(0.5, 0.9, 0);
  rig.add(halo, halo2);

  // Barber pole: striped cylinder with gold caps
  function stripeTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d');
    const colors = ['#efe9da', '#d4af37', '#efe9da', '#14110b'];
    colors.forEach((col, i) => {
      g.fillStyle = col;
      const y = i * 64;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(64, y - 32);
      g.lineTo(64, y + 32);
      g.lineTo(0, y + 64);
      g.closePath();
      g.fill();
      // wrap the band that leaves the top edge back in at the bottom
      g.beginPath();
      g.moveTo(0, y + 256);
      g.lineTo(64, y + 224);
      g.lineTo(64, y + 288);
      g.lineTo(0, y + 320);
      g.closePath();
      g.fill();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1, 2);
    textures.push(tex);
    return tex;
  }
  const poleTex = stripeTexture();
  const poleMat = new THREE.MeshStandardMaterial({ map: poleTex, metalness: 0.25, roughness: 0.32 });
  materials.push(poleMat);
  const pole = new THREE.Group();
  const poleBody = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.3, 2.7, 40, 1, false)), poleMat);
  const capGeo = geo(new THREE.CylinderGeometry(0.38, 0.38, 0.16, 40));
  const capTop = new THREE.Mesh(capGeo, gold);
  capTop.position.y = 1.43;
  const capBottom = new THREE.Mesh(capGeo, gold);
  capBottom.position.y = -1.43;
  const knob = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 24, 16)), gold);
  knob.position.y = 1.68;
  pole.add(poleBody, capTop, capBottom, knob);
  pole.position.set(2.65, -0.3, -0.3);
  pole.rotation.z = 0.1;

  // Comb: bar plus teeth
  function makeComb() {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(geo(new THREE.BoxGeometry(2.6, 0.32, 0.12)), gold);
    bar.position.y = 0.38;
    g.add(bar);
    const toothGeo = geo(new THREE.BoxGeometry(0.07, 0.74, 0.08));
    const n = 18;
    for (let i = 0; i < n; i++) {
      const tooth = new THREE.Mesh(toothGeo, chrome);
      tooth.position.set(-1.2 + (i * 2.4) / (n - 1), -0.1, 0);
      g.add(tooth);
    }
    return g;
  }
  const comb = makeComb();
  comb.position.set(-2.2, -2.2, 0.3);
  comb.rotation.z = 0.45;

  // Straight razor: handle plus an opened blade
  function makeRazor() {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(geo(new THREE.BoxGeometry(1.8, 0.24, 0.13)), darkGold);
    handle.position.x = -0.9;
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(poly(RAZOR_BLADE, 0.05), chrome));
    pivot.rotation.z = 0.85;
    const pin = geo(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 20));
    pin.rotateX(Math.PI / 2);
    const pinMesh = new THREE.Mesh(pin, gold);
    g.add(handle, pivot, pinMesh);
    return g;
  }
  const razor = makeRazor();
  razor.position.set(-2.3, 2.5, 0.2);
  razor.rotation.z = -0.5;

  props.add(pole, comb, razor);

  // ---------- lights ----------
  const key = new THREE.SpotLight(0xffe0a8, 120, 0, 0.55, 0.6, 2);
  key.position.set(4, 6, 7);
  const rim = new THREE.PointLight(0xd4af37, 40, 20, 2);
  rim.position.set(-5, -2, 3);
  scene.add(key, rim);

  // ---------- gold dust ----------
  const count = lite ? 160 : 420;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 11;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
    speeds[i] = 0.12 + Math.random() * 0.25;
  }
  const dustGeo = geo(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const sctx = sprite.getContext('2d');
  const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(1, 'rgba(255,240,200,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const spriteTex = new THREE.CanvasTexture(sprite);
  textures.push(spriteTex);
  const dustMat = new THREE.PointsMaterial({ map: spriteTex, size: lite ? 0.14 : 0.11, color: 0xf3d98b, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.push(dustMat);
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // Layout: full set on wide screens; scissors + halo only, centred behind the text, on phones
  const base = { y: 0 };
  function layout(aspect) {
    if (aspect > 1.15) { rig.position.set(3.0, 0.1, 0); rig.scale.setScalar(0.95); props.visible = true; }
    else { rig.position.set(0, -0.2, 0); rig.scale.setScalar(0.72); props.visible = false; }
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
      halo.rotation.z = t * 0.12;
      halo2.rotation.z = -t * 0.09;
      poleTex.offset.y = -t * 0.25;
      pole.rotation.y = Math.sin(t * 0.4) * 0.3 + pointer.x * 0.2;
      comb.position.y = -2.2 + Math.sin(t * 0.8) * 0.08;
      comb.rotation.y = Math.sin(t * 0.5) * 0.5 + p * 0.8;
      razor.position.y = 2.5 + Math.sin(t * 0.7 + 1) * 0.08;
      razor.rotation.y = Math.cos(t * 0.45) * 0.5 - p * 0.8;

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
    textures.forEach((t) => t.dispose());
    envTexture.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { dispose };
}
