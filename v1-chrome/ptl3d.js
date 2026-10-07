/* PTL v1 — chrome "PTL" letters, driven by window.PTL.ptlProgress (0..1). */
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

const stage = document.querySelector(".ptl-stage");
const canvas = document.querySelector(".ptl-canvas");
const PTL = window.PTL || {};

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}

if (stage && canvas && webglOK()) init();
else document.documentElement.classList.add("no-webgl");

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  /* studio environment for the chrome reflections, tuned to the brand blues */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x141c28, side: THREE.BackSide })));
  const panel = (w, h, color, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  // overhead softbox + rim lights
  panel(26, 6, new THREE.Color(8, 8, 8.5), [0, 13, 0]);
  panel(6, 22, new THREE.Color(0.6, 1.9, 5), [-14, 0, 2]);
  panel(5, 20, new THREE.Color(6, 6.4, 7), [14, 0, 2]);
  panel(18, 3, new THREE.Color(2.2, 1.2, 0.6), [0, -13, 2]);
  panel(16, 12, new THREE.Color(0.2, 0.55, 1.4), [0, 0, -16]);
  // strips behind the camera: these are what the flat front faces reflect
  panel(30, 1.6, new THREE.Color(9, 9, 9.5), [0, 5, 16]);
  panel(30, 0.8, new THREE.Color(4, 4.2, 4.6), [0, 1.2, 16]);
  panel(30, 3.5, new THREE.Color(0.35, 0.9, 2.6), [0, -3.5, 16]);
  panel(30, 1.2, new THREE.Color(6, 6.2, 6.6), [0, -7.5, 16]);
  scene.environment = pmrem.fromScene(env, 0.035).texture;

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xf2f6fa, metalness: 1, roughness: 0.14,
    iridescence: 0.35, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 420],
    envMapIntensity: 1.25
  });
  const ballMat = new THREE.MeshPhysicalMaterial({ color: 0x2b8ff0, emissive: 0x0a3a78, metalness: 0, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.45 });

  const root = new THREE.Group();
  scene.add(root);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 48), ballMat);
  root.add(ball);

  const letters = [];
  const side = PTL.rtl ? -1 : 1; // focused letter sits opposite the text panel

  new FontLoader().load("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/fonts/helvetiker_bold.typeface.json", (font) => {
    const widths = [];
    ["P", "T", "L"].forEach((ch) => {
      const g = new TextGeometry(ch, {
        font, size: 1.5, depth: 0.5, curveSegments: 24,
        bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.045, bevelSegments: 10
      });
      g.computeBoundingBox();
      g.center();
      const bb = g.boundingBox;
      widths.push(bb.max.x - bb.min.x);
      const holder = new THREE.Group();
      const mesh = new THREE.Mesh(g, chrome);
      holder.add(mesh);
      root.add(holder);
      letters.push({ holder, mesh, cur: null });
    });
    const gap = 0.22;
    const total = widths.reduce((a, b) => a + b, 0) + gap * 2;
    let x = -total / 2;
    letters.forEach((l, i) => { l.homeX = x + widths[i] / 2; x += widths[i] + gap; });
    resize();
    loop();
  });

  /* ---------- keyframes ---------- */
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  let mobile = false;

  function pose(kind, i) {
    // returns [x, y, z, rx, ry, rz, s]
    const L = letters[i];
    const s = mobile ? 0.62 : 1;
    if (kind === "scatter") {
      const seeds = [[-5, 3, -8, 1.2, -2.4, 0.6], [1, -4, -10, -1.6, 2.2, -0.4], [6, 2.5, -9, 0.9, 2.9, 0.8]];
      const q = seeds[i];
      return [q[0] * s, q[1], q[2], q[3], q[4], q[5], 0.6 * s];
    }
    if (kind === "home") return [L.homeX * s, mobile ? 0.6 : 0, 0, 0.08, -0.25, 0, s];
    if (kind === "end") return [L.homeX * s * 0.8, mobile ? 0.6 : 0, -1.5, 0.05, 0.2, 0, s * 0.8];
    // focus on letter f
    const f = kind;
    if (i === f) {
      return mobile ? [0, 1.35, 0, 0.1, -0.45, 0, 0.95] : [side * 2.35, 0, 0, 0.1, -side * 0.5, 0, 1.3];
    }
    // letters not in focus leave vertically so they never cross the text panel
    const away = i < f ? 1 : -1;
    return [L.homeX * s * 0.6 + side * 2, away * 7, -5, away * 0.9, side * 0.8, 0, 0.6 * s];
  }

  // [progress, pose-kind, spin (extra y-rotation accumulated while holding)]
  const KEYS = [
    [0.0, "scatter"], [0.15, "home"], [0.2, "home"],
    [0.27, 0], [0.43, 0],
    [0.53, 1], [0.69, 1],
    [0.79, 2], [0.94, 2],
    [1.0, "end"]
  ];

  function target(i, p) {
    let k = 0;
    while (k < KEYS.length - 2 && p > KEYS[k + 1][0]) k++;
    const [p0, a] = KEYS[k];
    const [p1, b] = KEYS[k + 1];
    const t = smooth(Math.min(1, Math.max(0, (p - p0) / (p1 - p0))));
    const A = pose(a, i), B = pose(b, i);
    const out = A.map((v, j) => lerp(v, B[j], t));
    // while a letter is held in focus, keep it turning slowly with the scroll
    if (a === b && typeof a === "number" && a === i) out[4] += (t - 0.5) * 0.7 * side;
    return out;
  }

  /* ---------- loop ---------- */
  const mouse = { x: 0, y: 0, cx: 0, cy: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "200px" }).observe(stage);

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    if (!visible || !letters.length) return;
    const time = PTL.reduced ? 0 : clock.getElapsedTime(); // no idle drift when motion is reduced
    const p = PTL.ptlProgress || 0;
    letters.forEach((L, i) => {
      const T = target(i, p);
      if (!L.cur) L.cur = T.slice();
      for (let j = 0; j < 7; j++) L.cur[j] = lerp(L.cur[j], T[j], 0.09);
      const c = L.cur;
      L.holder.position.set(c[0], c[1], c[2]);
      L.holder.rotation.set(c[3], c[4], c[5]);
      L.holder.scale.setScalar(c[6]);
      L.mesh.position.y = Math.sin(time * 0.9 + i * 1.7) * 0.06;
      L.mesh.rotation.y = Math.sin(time * 0.5 + i) * 0.05;
    });

    // accent ball: rests at the base of the letter in focus
    const focus = p < 0.22 || p > 0.96 ? 0 : p < 0.48 ? 0 : p < 0.74 ? 1 : 2;
    const fl = letters[focus].cur;
    const bx = fl[0] + (p < 0.22 || p > 0.96 ? -0.55 : -0.8) * fl[6] + Math.cos(time * 0.8) * 0.06;
    const by = fl[1] - 0.72 * fl[6] + Math.sin(time * 1.1) * 0.05;
    ball.position.lerp(new THREE.Vector3(bx, by, fl[2] + 0.55), 0.08);
    ball.scale.setScalar(lerp(ball.scale.x, p < 0.12 ? 0.001 : (mobile ? 0.8 : 1) * Math.max(0.7, fl[6] * 0.8), 0.08));

    mouse.cx = lerp(mouse.cx, mouse.x, 0.05);
    mouse.cy = lerp(mouse.cy, mouse.y, 0.05);
    root.rotation.y = mouse.cx * 0.25;
    root.rotation.x = mouse.cy * 0.15;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    mobile = w / h < 0.85;
    camera.position.z = mobile ? 11 : 10;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
}
