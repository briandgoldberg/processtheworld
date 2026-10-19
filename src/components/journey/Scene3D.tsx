"use client";
// The stage: a world the drop travels through. Terrain rises and falls with the route, the sea and rivers wave, clouds
// drift overhead, trees stand on land, strata show underground, snow falls in the ice stage, a sun hangs in the sky
// and everything glows a little. The drop changes form by stage (sphere, vapour swarm, falling drop, ice crystal), glides
// along each new segment, splashes when it lands on water, and the branches flash in a roulette while the dice roll.
// Built on three.js, no framework in between.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Stage } from "@/lib/journeys/raindrop";
import type { SceneLive, Visit } from "./Journey";

// sky, fog, ground and water colours by stage
const LOOK: Record<Stage, { sky: number; fog: number; ground: number; water: number; sun: number; rain: number }> = {
  sea: { sky: 0x1a4e8a, fog: 0x12365f, ground: 0x0e2b45, water: 0x1b6fa8, sun: 0xffd9a0, rain: 0xbfdcff },
  air: { sky: 0x3f8ad8, fog: 0x2b6cb8, ground: 0x2f6a4a, water: 0x2a7fb8, sun: 0xfff2d0, rain: 0xdff1ff },
  cloud: { sky: 0x7d8ca6, fog: 0x5f6c86, ground: 0x3a5a48, water: 0x33627f, sun: 0xd9dde6, rain: 0xcfe0ff },
  land: { sky: 0x4d6f9b, fog: 0x3b5578, ground: 0x3e7a3f, water: 0x2e6f8f, sun: 0xd8e4ff, rain: 0xbfdcff },
  soil: { sky: 0x2a1c12, fog: 0x1b120b, ground: 0x4a3221, water: 0x2d4a5e, sun: 0x000000, rain: 0x8c6a4a },
  ice: { sky: 0x8fb6d8, fog: 0xb4cde1, ground: 0xd6e3ee, water: 0x7fb4d6, sun: 0xfff6e0, rain: 0xffffff },
  river: { sky: 0x3f7fa8, fog: 0x2d607f, ground: 0x4c7f46, water: 0x1f88b4, sun: 0xffe7b0, rain: 0xbfdcff },
  end: { sky: 0x1a4e8a, fog: 0x12365f, ground: 0x0e2b45, water: 0x1b6fa8, sun: 0xffd9a0, rain: 0xbfdcff },
};
const RISE: Record<Stage, number> = { sea: 0.2, air: 1.3, cloud: 0.6, land: -1.0, soil: -1.0, ice: -0.4, river: -0.6, end: -0.4 };
const GROUND_STAGE = new Set<Stage>(["sea", "land", "ice", "river", "end"]);
const STEP = 3.4; // distance between nodes along the route

const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x: number, z: number) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** node positions along the route: air stages climb, ground stages descend, with a gentle weave */
function layout(trail: Visit[]): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []; let y = 0;
  trail.forEach((v, i) => { if (i > 0) y += RISE[v.stage]; pts.push(new THREE.Vector3(Math.sin(i * 0.9) * 2.4, y, -i * STEP)); });
  return pts;
}
/** ground level under the route: the height of the last ground stage, held through the air */
function groundProfile(trail: Visit[], pts: THREE.Vector3[]): number[] {
  const g: number[] = []; let last = 0;
  trail.forEach((v, i) => { if (GROUND_STAGE.has(v.stage)) last = pts[i].y - 0.5; g.push(last); });
  return g;
}
const groundAt = (g: number[], z: number) => { const f = Math.max(0, Math.min(g.length - 1, -z / STEP)); const i = Math.floor(f), t = f - i; return i >= g.length - 1 ? g[g.length - 1] : g[i] + (g[i + 1] - g[i]) * t; };

function softTexture(inner: string, outer: string) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!;
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, outer); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function Scene3D({ trail, scenes, rolling }: { trail: Visit[]; scenes: Map<string, SceneLive>; rolling: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ trail, scenes, rolling }); state.current = { trail, scenes, rolling };
  const api = useRef<{ route: (trail: Visit[], scenes: Map<string, SceneLive>) => void } | null>(null);
  const stage = trail[trail.length - 1].stage;

  useEffect(() => {
    const el = host.current; if (!el) return;
    const phone = el.clientWidth < 700;
    const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(phone ? 1.5 : 2, window.devicePixelRatio)); renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(LOOK.sea.fog, 10, 60);
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(LOOK.sea.sky) }, bottom: { value: new THREE.Color(LOOK.sea.fog) } },
      vertexShader: "varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vW; void main(){ float h = clamp(normalize(vW).y * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }" });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 24, 16), skyMat); scene.add(sky);
    const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 220);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 0.32, 0.6, 0.92); composer.addPass(bloom);

    // light
    const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x1a2a1a, 0.8); scene.add(hemi);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8); sunLight.position.set(6, 12, -6); scene.add(sunLight);
    const glint = new THREE.PointLight(0xffffff, 30, 16); scene.add(glint);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture("rgba(255,245,220,1)", "rgba(255,220,150,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sun.scale.set(7, 7, 1); scene.add(sun);

    // terrain: a long strip beneath the route whose height follows the ground profile
    const TW = 90, TL = 160, SEG = phone ? 60 : 110;
    const tg = new THREE.PlaneGeometry(TW, TL, SEG, SEG * 2); tg.rotateX(-Math.PI / 2);
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: LOOK.sea.ground, roughness: 0.95, metalness: 0, transparent: true }));
    scene.add(terrain);
    // strata: translucent bands seen when the drop is underground
    const strata = new THREE.Group(); scene.add(strata);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(TW, TL), new THREE.MeshBasicMaterial({ color: [0x5a3b25, 0x4a3a30, 0x6a5540, 0x3f2f24, 0x55473a][i], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; strata.add(m); }
    // water: a waving sheet, visible on sea and river stages
    const wg = new THREE.PlaneGeometry(TW, TL, 60, 120); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, new THREE.MeshPhysicalMaterial({ color: LOOK.sea.water, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1, envMapIntensity: 0.8 }));
    scene.add(water);
    const waterBase = (wg.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;
    // trees for the land stage
    const TREES = phone ? 80 : 160;
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.9, flatShading: true }), TREES);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 }), TREES);
    scene.add(trees); scene.add(trunks);
    const treeSeed: { x: number; z: number; s: number }[] = []; for (let i = 0; i < TREES; i++) treeSeed.push({ x: (hash(i, 7) - 0.5) * 70, z: -hash(i, 13) * 150 + 10, s: 0.7 + hash(i, 3) * 0.8 });
    // clouds
    const cloudTex = softTexture("rgba(255,255,255,0.95)", "rgba(255,255,255,0)");
    const clouds: THREE.Sprite[] = [];
    for (let i = 0; i < (phone ? 18 : 34); i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0, depthWrite: false })); const sc = 5 + hash(i, 21) * 9; s.scale.set(sc, sc * 0.55, 1); s.position.set((hash(i, 31) - 0.5) * 60, 3 + hash(i, 41) * 5, -hash(i, 51) * 150 + 10); s.userData.drift = 0.2 + hash(i, 61) * 0.4; scene.add(s); clouds.push(s); }
    // the drop, in its forms
    const dropMat = new THREE.MeshPhysicalMaterial({ color: 0x4fa3f0, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.55, emissive: new THREE.Color(0x12406f), emissiveIntensity: 0.3, specularIntensity: 0.8 });
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 48), dropMat); scene.add(drop);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 24), new THREE.MeshBasicMaterial({ color: 0x8ec8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(halo);
    const crystal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 6), new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, roughness: 0.1, metalness: 0, clearcoat: 1, emissive: new THREE.Color(0x9fd4ff), emissiveIntensity: 0.5, transparent: true, opacity: 0.95 })); crystal.rotation.x = Math.PI / 2; crystal.scale.setScalar(0.001); scene.add(crystal);
    // vapour swarm for the air stages
    const VN = 90; const vp = new Float32Array(VN * 3); const vg = new THREE.BufferGeometry(); vg.setAttribute("position", new THREE.BufferAttribute(vp, 3));
    const vapour = new THREE.Points(vg, new THREE.PointsMaterial({ color: 0xdff1ff, size: 0.06, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(vapour);
    // rain, snow or motes
    const N = phone ? 900 : 1800; const pos = new Float32Array(N * 3); const vel = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 36; pos[i * 3 + 1] = Math.random() * 30 - 10; pos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 10; vel[i] = 0.08 + Math.random() * 0.12; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xbfdcff, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false });
    const rain = new THREE.Points(rg, rainMat); scene.add(rain);
    // trail and branches
    const trailGroup = new THREE.Group(); scene.add(trailGroup);
    const ghosts = new THREE.Group(); scene.add(ghosts);
    const ghostMats: THREE.MeshBasicMaterial[] = [];
    // ripples
    const ripples: { m: THREE.Mesh; t0: number }[] = [];

    // motion state
    let pts = layout(state.current.trail), ground = groundProfile(state.current.trail, pts);
    let move: { from: THREE.Vector3; ctrl: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number } | null = null;
    let prevLen = state.current.trail.length; let lastStage: Stage = state.current.trail[state.current.trail.length - 1].stage;
    const dropPos = pts[pts.length - 1].clone(); drop.position.copy(dropPos);
    let dragX = 0, dragging = false, lastX = 0; let t = 0, lastFrame = performance.now();
    const col = { sky: new THREE.Color(LOOK.sea.sky), fog: new THREE.Color(LOOK.sea.fog), ground: new THREE.Color(LOOK.sea.ground), water: new THREE.Color(LOOK.sea.water), sun: new THREE.Color(LOOK.sea.sun), rain: new THREE.Color(LOOK.sea.rain) };
    const camPos = new THREE.Vector3(0, 2, 7); camera.position.copy(camPos);
    let terrainAlpha = 1, waterAlpha = 1, cloudAlpha = 0.15, treeAlpha = 0, strataAlpha = 0, vapourAlpha = 0, crystalK = 0, dropK = 1, stretch = 1;

    const rebuildTerrain = () => {
      const a = tg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) { const x = a.getX(i), z = a.getZ(i) - 50; const h = groundAt(ground, z) + (noise(x * 0.09, z * 0.09) * 1.9 + noise(x * 0.3, z * 0.3) * 0.4) * Math.min(1, Math.abs(x) / 3 + 0.1) - 0.8; a.setY(i, h); }
      a.needsUpdate = true; tg.computeVertexNormals(); terrain.position.z = -50;
      const d = new THREE.Object3D();
      for (let i = 0; i < TREES; i++) { const s = treeSeed[i]; const y = groundAt(ground, s.z) + (noise(s.x * 0.09, s.z * 0.09) * 1.9 + noise(s.x * 0.3, s.z * 0.3) * 0.4) * Math.min(1, Math.abs(s.x) / 3 + 0.1) - 0.8; d.position.set(s.x, y + 0.8 * s.s, s.z); d.scale.setScalar(s.s); d.updateMatrix(); trees.setMatrixAt(i, d.matrix); d.position.y = y + 0.2 * s.s; d.updateMatrix(); trunks.setMatrixAt(i, d.matrix); }
      trees.instanceMatrix.needsUpdate = true; trunks.instanceMatrix.needsUpdate = true;
    };
    const rebuildRoute = (tr: Visit[], sc: Map<string, SceneLive>) => {
      pts = layout(tr); ground = groundProfile(tr, pts); rebuildTerrain();
      trailGroup.clear(); ghosts.clear(); ghostMats.length = 0;
      if (pts.length > 1) {
        const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.6);
        trailGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 14), 0.045, 10, false), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x3d8fe0, emissiveIntensity: 0.6, roughness: 0.3 })));
      }
      pts.forEach((p, i) => { if (i === pts.length - 1) return; const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0x6fb6ff, emissiveIntensity: 0.6 })); m.position.copy(p); trailGroup.add(m); });
      const cur = sc.get(tr[tr.length - 1].scene); const last = pts[pts.length - 1]; const i = pts.length;
      const nexts: { stage: Stage; share?: number; to: string }[] = cur?.fork ? cur.fork.options.map(o => ({ stage: sc.get(o.to)?.stage || "air", share: o.share, to: o.to })) : cur?.choice ? cur.choice.options.map(o => ({ stage: sc.get(o.to)?.stage || "air", to: o.to })) : cur?.next ? [{ stage: sc.get(cur.next)?.stage || "air", to: cur.next }] : [];
      nexts.forEach((n, k) => {
        const spread = (k - (nexts.length - 1) / 2) * 1.8;
        const q = new THREE.Vector3(Math.sin(i * 0.9) * 2.4 + spread, last.y + RISE[n.stage], -i * STEP);
        const curve = new THREE.QuadraticBezierCurve3(last, new THREE.Vector3((last.x + q.x) / 2, Math.max(last.y, q.y) + 0.5, (last.z + q.z) / 2), q);
        const thick = n.share != null ? 0.03 + (n.share / 100) * 0.1 : 0.05;
        const mat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, depthWrite: false }); mat.userData.to = n.to; ghostMats.push(mat);
        ghosts.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, thick, 8, false), mat));
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), mat); dot.position.copy(q); ghosts.add(dot);
      });
      // a new node: glide along the segment that leads to it
      if (tr.length > prevLen) {
        const from = pts[pts.length - 2], to = pts[pts.length - 1];
        move = { from: from.clone(), ctrl: new THREE.Vector3((from.x + to.x) / 2, Math.max(from.y, to.y) + 0.5, (from.z + to.z) / 2), to: to.clone(), t0: t, dur: 1.3 };
        const st = tr[tr.length - 1].stage;
        if ((st === "end" || st === "river" || st === "sea") && GROUND_STAGE.has(st)) ripples.push({ m: new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 48), new THREE.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })), t0: t + move.dur });
      }
      prevLen = tr.length;
    };
    api.current = { route: rebuildRoute };
    rebuildRoute(state.current.trail, state.current.scenes);

    const onResize = () => { if (!host.current) return; const W = host.current.clientWidth, H = host.current.clientHeight; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; }; const mv = (e: PointerEvent) => { if (dragging) { dragX += (e.clientX - lastX) * 0.004; lastX = e.clientX; } }; const up = () => { dragging = false; };
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now(); const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now; t += dt;
      const { trail: tr, rolling: rl } = state.current;
      const st = tr[tr.length - 1].stage; const look = LOOK[st];
      if (st !== lastStage) lastStage = st;
      const k = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
      // colours
      col.sky.lerp(new THREE.Color(look.sky), k * 0.5); col.fog.lerp(new THREE.Color(look.fog), k * 0.5); col.ground.lerp(new THREE.Color(look.ground), k * 0.5); col.water.lerp(new THREE.Color(look.water), k * 0.5); col.sun.lerp(new THREE.Color(look.sun), k * 0.5); col.rain.lerp(new THREE.Color(look.rain), k * 0.5);
      (skyMat.uniforms.top.value as THREE.Color).copy(col.sky); (skyMat.uniforms.bottom.value as THREE.Color).copy(col.fog); (scene.fog as THREE.Fog).color.copy(col.fog); sky.position.copy(camera.position); (terrain.material as THREE.MeshStandardMaterial).color.copy(col.ground); (water.material as THREE.MeshPhysicalMaterial).color.copy(col.water); (sun.material as THREE.SpriteMaterial).color.copy(col.sun); rainMat.color.copy(col.rain);
      hemi.intensity += ((st === "soil" ? 0.25 : st === "ice" ? 1.1 : 0.8) - hemi.intensity) * k; sunLight.intensity += ((st === "soil" ? 0.2 : 1.8) - sunLight.intensity) * k;
      // the drop moves: glide along the new segment, then hover
      if (move) {
        const u = Math.min(1, (t - move.t0) / move.dur); const e = ease(u);
        const a = move.from.clone().lerp(move.ctrl, e), b = move.ctrl.clone().lerp(move.to, e); dropPos.copy(a.lerp(b, e));
        if (u >= 1) move = null;
      } else dropPos.lerp(pts[pts.length - 1], k * 0.6);
      drop.position.copy(dropPos); drop.position.y += Math.sin(t * 2.2) * 0.04; drop.rotation.y += dt * 0.4;
      core.position.copy(drop.position); halo.position.copy(drop.position); crystal.position.copy(drop.position); crystal.rotation.z += dt * 0.6;
      // forms by stage
      const wantVapour = st === "air" ? 1 : st === "cloud" ? 0.5 : 0; vapourAlpha += (wantVapour - vapourAlpha) * k;
      const wantCrystal = st === "ice" ? 1 : 0; crystalK += (wantCrystal - crystalK) * k;
      const wantDrop = st === "air" ? 0.45 : st === "ice" ? 0.001 : st === "cloud" ? 0.8 : 1; dropK += (wantDrop - dropK) * k;
      const wantStretch = move && (st === "land" || st === "end" || st === "river" || st === "soil") ? 1.5 : 1; stretch += (wantStretch - stretch) * k * 1.5;
      drop.scale.set(dropK, dropK * stretch, dropK); core.scale.setScalar(dropK); crystal.scale.setScalar(Math.max(0.001, crystalK));
      (vapour.material as THREE.PointsMaterial).opacity = vapourAlpha * 0.9;
      const va = vg.attributes.position as THREE.BufferAttribute; const spreadV = 0.4 + vapourAlpha * 1.4;
      for (let i = 0; i < VN; i++) { const ph = i * 0.7 + t * (0.6 + (i % 5) * 0.15); const r = spreadV * (0.5 + hash(i, 1) * 0.8); va.setXYZ(i, drop.position.x + Math.cos(ph) * r, drop.position.y + Math.sin(ph * 0.7 + i) * r * 0.6, drop.position.z + Math.sin(ph) * r); }
      va.needsUpdate = true;
      // world layers
      terrainAlpha += ((st === "soil" ? 0.18 : 1) - terrainAlpha) * k; (terrain.material as THREE.MeshStandardMaterial).opacity = terrainAlpha;
      strataAlpha += ((st === "soil" ? 0.35 : 0) - strataAlpha) * k;
      strata.children.forEach((m, i) => { const mm = m as THREE.Mesh; (mm.material as THREE.MeshBasicMaterial).opacity = strataAlpha * (1 - i * 0.12); mm.position.set(0, groundAt(ground, drop.position.z) - 1.2 - i * 1.1, drop.position.z); });
      waterAlpha += ((st === "sea" || st === "river" || st === "end" ? 0.85 : 0) - waterAlpha) * k; (water.material as THREE.MeshPhysicalMaterial).opacity = waterAlpha; water.visible = waterAlpha > 0.02;
      water.position.set(0, groundAt(ground, drop.position.z) + 0.05, -50);
      const wa = wg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < wa.count; i++) { const x = waterBase[i * 3], z = waterBase[i * 3 + 2]; wa.setY(i, Math.sin(x * 0.8 + t * 1.6) * 0.08 + Math.sin(z * 0.6 - t * 1.1) * 0.08 + Math.sin((x + z) * 0.3 + t * 0.7) * 0.05); }
      wa.needsUpdate = true;
      cloudAlpha += ((st === "cloud" ? 0.95 : st === "air" ? 0.45 : st === "land" ? 0.3 : st === "soil" ? 0 : 0.15) - cloudAlpha) * k;
      clouds.forEach((c, i) => { (c.material as THREE.SpriteMaterial).opacity = cloudAlpha * (0.6 + hash(i, 9) * 0.4); c.position.x += c.userData.drift * dt; if (c.position.x > 32) c.position.x = -32; c.position.y = (st === "cloud" ? drop.position.y + (hash(i, 41) - 0.5) * 3 : groundAt(ground, c.position.z) + 4 + hash(i, 41) * 5) * 0.03 + c.position.y * 0.97; });
      treeAlpha += ((st === "land" || st === "river" ? 1 : st === "air" || st === "cloud" ? 0.6 : 0) - treeAlpha) * k;
      trees.visible = trunks.visible = treeAlpha > 0.02; (trees.material as THREE.MeshStandardMaterial).transparent = (trunks.material as THREE.MeshStandardMaterial).transparent = true; (trees.material as THREE.MeshStandardMaterial).opacity = (trunks.material as THREE.MeshStandardMaterial).opacity = treeAlpha;
      sun.position.set(camera.position.x + 22, camera.position.y + 16, camera.position.z - 55); (sun.material as THREE.SpriteMaterial).opacity = st === "soil" ? 0 : st === "cloud" ? 0.25 : 0.7;
      // particles: rain in cloud/land/river, snow in ice, motes underground, thin drizzle elsewhere
      const mode = st === "ice" ? "snow" : st === "soil" ? "motes" : st === "cloud" || st === "land" || st === "river" ? "rain" : "none";
      const arr = rg.attributes.position as THREE.BufferAttribute;
      const speed = mode === "snow" ? 0.25 : mode === "motes" ? 0.05 : mode === "rain" ? 1.7 : 0.5;
      for (let i = 0; i < N; i++) { let y = arr.getY(i) - vel[i] * speed; if (mode === "snow") arr.setX(i, arr.getX(i) + Math.sin(t + i) * 0.01); if (y < drop.position.y - 12) y = drop.position.y + 14; arr.setY(i, y); }
      arr.needsUpdate = true; rain.position.z = drop.position.z; rain.position.x = drop.position.x;
      rainMat.size = mode === "snow" ? 0.12 : mode === "motes" ? 0.07 : 0.05; rainMat.opacity += ((mode === "none" ? 0.12 : mode === "motes" ? 0.35 : 0.6) - rainMat.opacity) * k;
      // ripples on splashdown
      for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; const age = t - r.t0; if (age < 0) continue; if (!r.m.parent) { r.m.rotation.x = -Math.PI / 2; r.m.position.set(drop.position.x, groundAt(ground, drop.position.z) + 0.08, drop.position.z); scene.add(r.m); } r.m.scale.setScalar(1 + age * 6); (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - age * 0.5); if (age > 1.8) { scene.remove(r.m); ripples.splice(i, 1); } }
      // roulette across the branches while the dice roll; the chosen one stays lit
      ghostMats.forEach((m, i) => { const lit = rl ? (rl === m.userData.to ? 1 : Math.max(0, Math.sin(t * 9 + i * 2.1))) : 0; m.opacity = 0.35 + lit * 0.55; m.color.setHex(lit > 0.6 ? 0xffffff : 0xbfe3ff); });
      halo.scale.setScalar(rl ? 1.15 + Math.sin(t * 16) * 0.12 : 1); (halo.material as THREE.MeshBasicMaterial).opacity = rl ? 0.3 : 0.12;
      // camera: circles behind and above, pulls back while the drop glides, dips low underground, drag to look around
      const orbit = t * 0.08 + dragX; const back = move ? 9.5 : 7.8; const high = st === "soil" ? 1.0 : st === "air" ? 1.6 : 2.6;
      camPos.set(drop.position.x + Math.sin(orbit) * back, drop.position.y + high, drop.position.z + Math.cos(orbit) * back + 1.2);
      camera.position.lerp(camPos, k * 0.9); camera.lookAt(drop.position.x, drop.position.y + 0.1, drop.position.z - 1.5);
      camera.fov += ((move ? 46 : 40) - camera.fov) * k; camera.updateProjectionMatrix();
      glint.position.set(camera.position.x + 1.5, camera.position.y + 2.5, camera.position.z);
      bloom.strength = st === "soil" ? 0.22 : 0.32;
      composer.render();
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); renderer.dispose(); pmrem.dispose(); composer.dispose(); el.innerHTML = ""; api.current = null; };
  }, []);

  useEffect(() => { api.current?.route(trail, scenes); }, [trail, scenes]);

  return <div ref={host} className="jy-stage" data-stage={stage} aria-hidden="true" />;
}
