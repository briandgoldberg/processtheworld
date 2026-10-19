"use client";
// A small globe showing where the journey is: the route so far as a glowing arc over the Earth, the current place as a
// pulsing marker, and the possible next places as faint dots. The camera swings to keep the current place in view.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Place } from "@/lib/journeys/raindropRoute";

const R = 1;
const toVec = (p: Place, r = R) => { const phi = (90 - p.lat) * Math.PI / 180, th = (p.lon + 180) * Math.PI / 180; return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); };
function arc(a: Place, b: Place, n = 40, lift = 0.06): THREE.Vector3[] {
  const va = toVec(a).normalize(), vb = toVec(b).normalize(); const w = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1)) || 1e-6;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const v = va.clone().multiplyScalar(Math.sin((1 - t) * w) / Math.sin(w)).add(vb.clone().multiplyScalar(Math.sin(t * w) / Math.sin(w))).normalize(); out.push(v.multiplyScalar(R + lift * Math.sin(Math.PI * t) * Math.min(1, w * 2))); }
  return out;
}

export default function GlobeInset({ visited, nexts }: { visited: Place[]; nexts: Place[] }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (v: Place[], n: Place[]) => void } | null>(null);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const size = el.clientWidth;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(size, size); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const key = new THREE.DirectionalLight(0xffffff, 1.6); scene.add(key);
    const tex = new THREE.TextureLoader().load("/journey/earth.jpg"); tex.colorSpace = THREE.SRGBColorSpace;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 })); scene.add(globe);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 48, 36), new THREE.MeshBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(atmo);
    const route = new THREE.Group(); scene.add(route);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); scene.add(marker);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 32), new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); scene.add(ring);
    let camTarget = new THREE.Vector3(0, 0, 3.2); camera.position.copy(camTarget);
    let dragging = false, lastX = 0, lastY = 0, spinX = 0, spinY = 0;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; e.stopPropagation(); }; const mv = (e: PointerEvent) => { if (!dragging) return; spinY += (e.clientX - lastX) * 0.01; spinX += (e.clientY - lastY) * 0.01; lastX = e.clientX; lastY = e.clientY; }; const up = () => { dragging = false; };
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
    let cur = new THREE.Vector3(0, 0, 1);
    const update = (v: Place[], n: Place[]) => {
      route.clear();
      for (let i = 1; i < v.length; i++) { const pts = arc(v[i - 1], v[i]); route.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.006, 6, false), new THREE.MeshBasicMaterial({ color: 0x9fd4ff }))); }
      v.forEach((p, i) => { if (i === v.length - 1) return; const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), new THREE.MeshBasicMaterial({ color: 0xdff1ff })); d.position.copy(toVec(p, R + 0.004)); route.add(d); });
      const last = v[v.length - 1];
      n.forEach(p => { const pts = arc(last, p, 24, 0.05); route.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.004, 6, false), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }))); const d = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); d.position.copy(toVec(p, R + 0.004)); route.add(d); });
      cur = toVec(last, R + 0.004); marker.position.copy(cur); ring.position.copy(cur); ring.lookAt(cur.clone().multiplyScalar(2));
      camTarget = cur.clone().normalize().multiplyScalar(3.2);
    };
    api.current = { update };
    let raf = 0, t = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick); t += 0.016;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(spinX, spinY, 0)); const target = camTarget.clone().applyQuaternion(q);
      camera.position.lerp(target, 0.06); camera.lookAt(0, 0, 0); key.position.copy(camera.position).add(new THREE.Vector3(1, 1.5, 0.5));
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.18); (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(t * 3) * 0.3;
      renderer.render(scene, camera);
    };
    tick();
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); renderer.dispose(); el.innerHTML = ""; api.current = null; };
  }, []);
  useEffect(() => { api.current?.update(visited, nexts); }, [visited, nexts]);
  return <div ref={host} className="jy-globe-canvas" aria-hidden="true" />;
}
