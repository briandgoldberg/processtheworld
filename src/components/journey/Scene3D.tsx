"use client";
// The stage: a drop of water travelling a glowing path through sea, air, cloud, land, soil, ice and river. The path is
// laid out as the trail grows (air stages climb, ground stages descend), the camera follows the drop, the sky tints with
// each stage, and rain falls in the background. Built on three.js, no framework in between.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Stage } from "@/lib/journeys/raindrop";
import type { SceneLive, Visit } from "./Journey";

const SKY: Record<Stage, [number, number]> = {
  sea: [0x0a2f52, 0x072038], air: [0x1d4f8f, 0x0f2f5e], cloud: [0x5e6f8c, 0x3a4660], land: [0x25473a, 0x14281f],
  soil: [0x3e2a1b, 0x24170d], ice: [0x9fbdd6, 0x6f93b3], river: [0x12566b, 0x0a3340], end: [0x0a2f52, 0x072038],
};
const RISE: Record<Stage, number> = { sea: 0.2, air: 1.1, cloud: 0.5, land: -0.9, soil: -0.9, ice: -0.4, river: -0.6, end: -0.3 };

function layout(trail: Visit[]): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []; let y = 0;
  trail.forEach((v, i) => { if (i > 0) y += RISE[v.stage]; pts.push(new THREE.Vector3(Math.sin(i * 0.9) * 2.2, y, -i * 3.2)); });
  return pts;
}

export default function Scene3D({ trail, scenes, rolling }: { trail: Visit[]; scenes: Map<string, SceneLive>; rolling: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; drop: THREE.Mesh; halo: THREE.Mesh; trailGroup: THREE.Group; ghosts: THREE.Group; rain: THREE.Points; target: THREE.Vector3; camTarget: THREE.Vector3; sky: THREE.Color; fog: THREE.Color; raf: number; t: number } | null>(null);
  const state = useRef({ trail, scenes, rolling }); state.current = { trail, scenes, rolling };

  useEffect(() => {
    const el = host.current; if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY.sea[0]); scene.fog = new THREE.Fog(SKY.sea[1], 6, 26);
    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.1, 100);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x0a1a2a, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 4); scene.add(key);
    const rim = new THREE.PointLight(0x9fd0ff, 30, 12); rim.position.set(-2, 1.5, 2); scene.add(rim);
    const glint = new THREE.PointLight(0xffffff, 40, 14); scene.add(glint);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(core);
    // the drop
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.42, 64, 64), new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, roughness: 0.06, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.6, emissive: new THREE.Color(0x1d4f8f), emissiveIntensity: 0.45, specularIntensity: 1 }));
    scene.add(drop);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 32), new THREE.MeshBasicMaterial({ color: 0x8ec8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(halo);
    const trailGroup = new THREE.Group(); scene.add(trailGroup);
    const ghosts = new THREE.Group(); scene.add(ghosts);
    // rain
    const N = 1600; const pos = new Float32Array(N * 3); const vel = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 30 - 10; pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10; vel[i] = 0.08 + Math.random() * 0.12; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xbfdcff, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(rain);
    // soft ground plane far below for depth
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x0b1b2b, roughness: 1, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -14; scene.add(floor);

    const w = { scene, camera, renderer, drop, halo, trailGroup, ghosts, rain, target: new THREE.Vector3(), camTarget: new THREE.Vector3(0, 1.6, 6), sky: new THREE.Color(SKY.sea[0]), fog: new THREE.Color(SKY.sea[1]), raf: 0, t: 0 };
    world.current = w;
    camera.position.copy(w.camTarget);
    const onResize = () => { if (!host.current) return; const W = host.current.clientWidth, H = host.current.clientHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    let dragX = 0, dragging = false, lastX = 0;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; }; const move = (e: PointerEvent) => { if (dragging) { dragX += (e.clientX - lastX) * 0.004; lastX = e.clientX; } }; const up = () => { dragging = false; };
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    const tick = () => {
      w.raf = requestAnimationFrame(tick); w.t += 0.016;
      const { trail: tr, rolling: rl } = state.current;
      const pts = layout(tr); const last = pts[pts.length - 1];
      w.target.copy(last);
      drop.position.lerp(w.target, 0.06); halo.position.copy(drop.position); core.position.copy(drop.position);
      glint.position.set(camera.position.x + 1.5, camera.position.y + 2.5, camera.position.z);
      drop.position.y += Math.sin(w.t * 2.2) * 0.004; drop.rotation.y += 0.004;
      const stage = tr[tr.length - 1].stage;
      w.sky.lerp(new THREE.Color(SKY[stage][0]), 0.03); w.fog.lerp(new THREE.Color(SKY[stage][1]), 0.03);
      (scene.background as THREE.Color).copy(w.sky); (scene.fog as THREE.Fog).color.copy(w.fog);
      // camera: behind and above the drop, slowly circling, drag to look around
      const orbit = w.t * 0.12 + dragX;
      w.camTarget.set(drop.position.x + Math.sin(orbit) * 5.2, drop.position.y + 1.7, drop.position.z + Math.cos(orbit) * 5.2 + 1.5);
      camera.position.lerp(w.camTarget, 0.05); camera.lookAt(drop.position.x, drop.position.y + 0.2, drop.position.z);
      // rain falls, denser in cloud and land stages
      const arr = rain.geometry.attributes.position as THREE.BufferAttribute; const rainy = stage === "cloud" || stage === "land" || stage === "river";
      for (let i = 0; i < N; i++) { let y = arr.getY(i) - vel[i] * (rainy ? 1.6 : 0.5); if (y < drop.position.y - 12) y = drop.position.y + 14; arr.setY(i, y); }
      arr.needsUpdate = true; (rain.material as THREE.PointsMaterial).opacity = rainy ? 0.6 : 0.2;
      rain.position.z = drop.position.z;
      // glow pulse while the dice roll
      (halo.material as THREE.MeshBasicMaterial).opacity = rl ? 0.25 + Math.sin(w.t * 18) * 0.15 : 0.12;
      renderer.render(scene, camera);
    };
    tick();
    return () => { cancelAnimationFrame(w.raf); window.removeEventListener("resize", onResize); el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); renderer.dispose(); pmrem.dispose(); el.innerHTML = ""; world.current = null; };
  }, []);

  // rebuild the trail tube and the ghost branches whenever the route changes
  useEffect(() => {
    const w = world.current; if (!w) return;
    w.trailGroup.clear(); w.ghosts.clear();
    const pts = layout(trail);
    if (pts.length > 1) {
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.6);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 14), 0.07, 10, false), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x3d8fe0, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.1 }));
      w.trailGroup.add(tube);
    }
    pts.forEach((p, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(i === pts.length - 1 ? 0.0001 : 0.13, 16, 16), new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0x6fb6ff, emissiveIntensity: 0.8 })); m.position.copy(p); w.trailGroup.add(m); });
    const cur = scenes.get(trail[trail.length - 1].scene); const last = pts[pts.length - 1]; const i = pts.length;
    const nexts: { stage: Stage; share?: number; label: string }[] = cur?.fork ? cur.fork.options.map(o => ({ stage: scenes.get(o.to)?.stage || "air", share: o.share, label: o.label })) : cur?.choice ? cur.choice.options.map(o => ({ stage: scenes.get(o.to)?.stage || "air", label: o.label })) : cur?.next ? [{ stage: scenes.get(cur.next)?.stage || "air", label: "" }] : [];
    nexts.forEach((n, k) => {
      const spread = (k - (nexts.length - 1) / 2) * 1.6;
      const q = new THREE.Vector3(Math.sin(i * 0.9) * 2.2 + spread, last.y + RISE[n.stage], -i * 3.2);
      const curve = new THREE.QuadraticBezierCurve3(last, new THREE.Vector3((last.x + q.x) / 2, Math.max(last.y, q.y) + 0.4, (last.z + q.z) / 2), q);
      const thick = n.share != null ? 0.03 + (n.share / 100) * 0.09 : 0.05;
      const g = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, thick, 8, false), new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, depthWrite: false }));
      w.ghosts.add(g);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.6 })); dot.position.copy(q); w.ghosts.add(dot);
    });
  }, [trail, scenes]);

  return <div ref={host} className="jy-stage" aria-hidden="true" />;
}
