/* PTL final — dotted globe with live routes from Cairo (from the Globe version).
   Reads window.PTL.geo = { p, region, inRegions } written by main.js. */
import * as THREE from "three";

const stage = document.querySelector(".geo-stage");
const canvas = document.querySelector(".globe-canvas");
const PTL = window.PTL || {};
const DEG = Math.PI / 180;

const HQ = { lat: 30.04, lon: 31.24 };
// Countries named on the source site; one port/capital each.
const CITIES = [
  ["asia", 31.23, 121.47], ["asia", 3.14, 101.69], ["asia", 25.03, 121.56], ["asia", 13.75, 100.5], ["asia", 35.68, 139.69],
  ["asia", 37.57, 126.98], ["asia", 22.32, 114.17], ["asia", 1.35, 103.82], ["asia", 19.08, 72.88],
  ["europe", 41.01, 28.98], ["europe", 48.86, 2.35], ["europe", 53.55, 9.99], ["europe", 40.42, -3.7], ["europe", 51.92, 4.48],
  ["europe", 51.22, 4.4], ["europe", 51.51, -0.13], ["europe", 47.38, 8.54], ["europe", 48.21, 16.37],
  ["gulf", 21.49, 39.19], ["gulf", 25.2, 55.27], ["gulf", 29.38, 47.99], ["gulf", 26.23, 50.59],
  ["americas", 40.71, -74.0], ["americas", 43.65, -79.38], ["americas", 55.76, 37.62], ["americas", -33.87, 151.21],
  ["americas", -23.96, -46.33], ["americas", -34.6, -58.38]
];
const FOCUS = {
  hero: [22, 40], asia: [24, 108], europe: [47, 12], gulf: [26, 44], americas: [18, -45], africa: [8, 22]
};
const ORDER = ["asia", "europe", "gulf", "americas", "africa"];

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}
// Build the globe after first paint (idle after load) or on the first scroll, so the hero stays smooth.
if (stage && canvas && webglOK()) {
  let started = false;
  const start = () => { if (started) return; started = true; init(); };
  const kick = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200));
  if (document.readyState === "complete") kick(); else window.addEventListener("load", kick, { once: true });
  window.addEventListener("scroll", start, { once: true, passive: true });
} else document.documentElement.classList.add("no-webgl");

function vec(lat, lon, r = 1) {
  const phi = (90 - lat) * DEG, theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

async function landMask() {
  const res = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json");
  const topo = await res.json();
  const geo = window.topojson.feature(topo, topo.objects.land);
  const W = 1440, H = 720;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  const polys = geo.features.flatMap((f) => f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
  polys.forEach((rings) => {
    g.beginPath();
    rings.forEach((ring) => ring.forEach(([lon, lat], i) => {
      const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }));
    g.fill("evenodd");
  });
  const data = g.getImageData(0, 0, W, H).data;
  return (lat, lon) => {
    const x = Math.min(W - 1, Math.floor((lon + 180) / 360 * W));
    const y = Math.min(H - 1, Math.floor((90 - lat) / 180 * H));
    return data[(y * W + x) * 4] > 128;
  };
}

async function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);

  const world = new THREE.Group();   // placement on screen
  const globe = new THREE.Group();   // rotation
  world.add(globe);
  scene.add(world);

  // ocean sphere hides the back-side dots
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 64), new THREE.MeshBasicMaterial({ color: 0x051428 })));

  // atmosphere
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.18, 64, 64), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 p = modelViewMatrix * vec4(position,1.); vP = p.xyz; gl_Position = projectionMatrix * p; }",
    fragmentShader: "varying vec3 vN; varying vec3 vP; void main(){ float f = pow(clamp(dot(vN, normalize(-vP)) - 0.05, 0., 1.), 2.2); gl_FragColor = vec4(0.23,0.62,1.0,1.) * f * 1.25; }"
  }));
  world.add(atmo);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 64), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 p = modelViewMatrix * vec4(position,1.); vP = p.xyz; gl_Position = projectionMatrix * p; }",
    fragmentShader: "varying vec3 vN; varying vec3 vP; void main(){ float f = pow(1. - abs(dot(vN, normalize(-vP))), 3.); gl_FragColor = vec4(0.37,0.83,1.,1.) * f * 0.9; }"
  }));
  world.add(rim);

  // land dots
  let isLand = null;
  try { isLand = await landMask(); } catch (e) { isLand = null; }
  const N = 26000, pos = [], shade = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const v = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    const lat = Math.asin(v.y) / DEG;
    const lon = ((Math.atan2(v.z, -v.x) / DEG) + 360) % 360 - 180; // inverse of vec()
    if (isLand ? isLand(lat, lon) : Math.random() < 0.3) {
      pos.push(v.x * 1.002, v.y * 1.002, v.z * 1.002);
      shade.push(0.55 + Math.random() * 0.45);
    }
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  dotGeo.setAttribute("aShade", new THREE.Float32BufferAttribute(shade, 1));
  const dotMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSize: { value: 4.4 * renderer.getPixelRatio() }, uHQ: { value: vec(HQ.lat, HQ.lon) } },
    vertexShader: `attribute float aShade; uniform float uSize; uniform vec3 uHQ; varying float vS; varying float vNear;
      void main(){ vS = aShade; vNear = smoothstep(0.35, 0.0, distance(position, uHQ));
        vec4 p = modelViewMatrix * vec4(position,1.); gl_PointSize = uSize * (4.0 / -p.z); gl_Position = projectionMatrix * p; }`,
    fragmentShader: `varying float vS; varying float vNear;
      void main(){ vec2 c = gl_PointCoord - .5; if(dot(c,c) > .25) discard;
        vec3 col = mix(vec3(0.42,0.72,1.0), vec3(0.75,0.95,1.0), vNear);
        gl_FragColor = vec4(col * (0.55 + 0.6 * vS), 1.0); }`
  });
  globe.add(new THREE.Points(dotGeo, dotMat));

  // routes
  const hqV = vec(HQ.lat, HQ.lon);
  const arcs = CITIES.map(([region, lat, lon], i) => {
    const end = vec(lat, lon);
    const d = hqV.distanceTo(end);
    const mid = hqV.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1 + 0.12 + d * 0.28);
    const curve = new THREE.QuadraticBezierCurve3(hqV, mid, end);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOff: { value: (i * 0.137) % 1 }, uActive: { value: 0.35 } },
      vertexShader: "varying float vT; void main(){ vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      fragmentShader: `uniform float uTime; uniform float uOff; uniform float uActive; varying float vT;
        void main(){ float head = fract(uTime * 0.22 + uOff) * 1.4 - 0.2;
          float trail = smoothstep(head - 0.35, head, vT) * step(vT, head);
          float a = 0.10 * uActive + trail * (0.25 + 0.75 * uActive);
          vec3 col = mix(vec3(0.16,0.5,1.0), vec3(0.6,0.95,1.0), trail);
          gl_FragColor = vec4(col, a); }`
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.0042, 6, false), mat);
    globe.add(mesh);
    // city marker
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true }));
    m.position.copy(end.clone().multiplyScalar(1.004));
    m.lookAt(end.clone().multiplyScalar(2));
    globe.add(m);
    return { region, mat, marker: m, active: 0.35 };
  });

  // HQ beacon
  const hqDot = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  hqDot.position.copy(hqV.clone().multiplyScalar(1.005));
  hqDot.lookAt(hqV.clone().multiplyScalar(2));
  globe.add(hqDot);
  const rings = [0, 1, 2].map((k) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 48), new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.copy(hqV.clone().multiplyScalar(1.006));
    ring.lookAt(hqV.clone().multiplyScalar(2));
    ring.userData.k = k;
    globe.add(ring);
    return ring;
  });

  /* ---------- layout + motion ---------- */
  const side = PTL.rtl ? -1 : 1;
  let mobile = false;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    mobile = w / h < 0.9;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const lerp = (a, b, t) => a + (b - a) * t;
  const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
  function rotFor(lat, lon) {
    const v = vec(lat, lon);
    return [lat * DEG * 0.85, Math.atan2(-v.x, v.z)];
  }

  const mouse = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "100px" }).observe(stage);

  const clock = new THREE.Clock();
  let rx = rotFor(...FOCUS.hero)[0], ry = rotFor(...FOCUS.hero)[1];
  let spin = 0;
  const place = { x: 0, y: 0, s: 1 };

  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = PTL.reduced ? 1.5 : clock.getElapsedTime(); // routes hold still when motion is reduced
    const geo = PTL.geo || { p: 0, region: -1, inRegions: false };
    const key = geo.inRegions && geo.region >= 0 ? ORDER[geo.region] : "hero";

    // where the globe sits on screen
    const short = stage.clientHeight < 560 && !mobile;
    // no hero text shares this stage here, so the globe keeps the regions layout throughout
    const tx = mobile ? 0 : side * (short ? 1.25 : 0.95);
    const ty = mobile ? 0.55 : 0;
    const ts = mobile ? 0.7 : 0.98;
    place.x = lerp(place.x, tx, 0.05); place.y = lerp(place.y, ty, 0.05); place.s = lerp(place.s, ts, 0.05);
    world.position.set(place.x, place.y, 0);
    world.scale.setScalar(place.s);

    // rotation: gentle spin in the hero, locked onto a region after
    let [frx, fry] = rotFor(...FOCUS[key]);
    if (key === "hero" && !PTL.reduced) { spin += 0.0012; fry += Math.sin(spin) * 0.5; }
    rx = lerp(rx, frx + mouse.y * 0.12, 0.04);
    ry = angLerp(ry, fry + mouse.x * 0.2, 0.04);
    globe.rotation.set(rx, ry, 0);

    arcs.forEach((a) => {
      const target = key === "hero" ? 0.55 : key === "africa" ? 0.2 : a.region === key ? 1 : 0.08;
      a.active = lerp(a.active, target, 0.06);
      a.mat.uniforms.uActive.value = a.active;
      a.mat.uniforms.uTime.value = t;
      a.marker.material.opacity = 0.25 + a.active * 0.75;
    });
    rings.forEach((r) => {
      const k = ((t * 0.6 + r.userData.k / 3) % 1);
      r.scale.setScalar(1 + k * 3.2);
      r.material.opacity = (1 - k) * 0.8;
    });
    renderer.render(scene, camera);
  })();
}
