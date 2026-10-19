"use client";
// The living Earth: hundreds of threads of water, carbon and dust moving over a globe, each a route rolled on the map's
// real forks. Drag to turn, scroll to zoom, tap a thread to see its route and odds, tap a hotspot for a chapter.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Route } from "@/lib/journeys/flows";

export type WorldData = {
  flows: { id: string; title: string; traveller: string; color: string; ride?: string; nodes: Record<string, { name: string; step?: string }> }[];
  routes: Route[]; stepLabel: Record<string, string>; stepProcess: Record<string, string>;
  hotspots: { id: string; name: string; lat: number; lon: number; radius: number; text: string; questions: { id: string; title: string }[] }[];
};

const R = 1;
const toVec = (lat: number, lon: number, alt = 0) => { const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180, r = R + alt; return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); };
const TAIL = 16;

function densify(route: Route): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 1; i < route.pts.length; i++) {
    const a = route.pts[i - 1], b = route.pts[i];
    const va = toVec(a.lat, a.lon).normalize(), vb = toVec(b.lat, b.lon).normalize(); const w = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1)) || 1e-6;
    const n = Math.max(6, Math.round(w * 40));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) { const t = k / n; const v = va.clone().multiplyScalar(Math.sin((1 - t) * w) / Math.sin(w)).add(vb.clone().multiplyScalar(Math.sin(t * w) / Math.sin(w))).normalize(); const alt = a.alt + (b.alt - a.alt) * t + Math.sin(Math.PI * t) * Math.min(0.08, w * 0.25) + 0.012; out.push(v.multiplyScalar(R + alt)); }
  }
  return out;
}

export default function Globe({ data }: { data: WorldData }) {
  const host = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>(() => Object.fromEntries(data.flows.map(f => [f.id, true])));
  const [intro, setIntro] = useState(true);
  const api = useRef<{ setShown: (s: Record<string, boolean>) => void; setSel: (i: number | null) => void } | null>(null);
  const flowBy = useMemo(() => new Map(data.flows.map(f => [f.id, f])), [data]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; data.routes.forEach(r => { c[r.flow] = (c[r.flow] || 0) + 1; }); return c; }, [data]);
  const hotspotRoutes = useMemo(() => data.hotspots.map(h => ({ id: h.id, per: data.flows.map(f => ({ flow: f, n: data.routes.filter(r => r.flow === f.id && r.pts.some(p => Math.abs(p.lat - h.lat) < h.radius && Math.abs(p.lon - h.lon) < h.radius)).length })) })), [data]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const phone = el.clientWidth < 700;
    const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(phone ? 1.5 : 2, window.devicePixelRatio)); renderer.setSize(el.clientWidth, el.clientHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04070f);
    const camera = new THREE.PerspectiveCamera(38, el.clientWidth / el.clientHeight, 0.05, 50); camera.position.set(0, 0.9, phone ? 3.9 : 3.1);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = 1.45; controls.maxDistance = 6; controls.autoRotate = true; controls.autoRotateSpeed = 0.35; controls.enablePan = false;
    // stars
    const SN = 1500; const sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30); sp[i * 3] = v.x; sp[i * 3 + 1] = v.y; sp[i * 3 + 2] = v.z; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaab8d0, size: 0.06, transparent: true, opacity: 0.7 })));
    // earth
    scene.add(new THREE.AmbientLight(0xffffff, 0.35)); const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.set(5, 2, 3); scene.add(sun);
    const tex = new THREE.TextureLoader().load("/journey/earth.jpg"); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 })); scene.add(earth);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 64, 48), new THREE.MeshBasicMaterial({ color: 0x5fa8ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 64, 48), new THREE.MeshBasicMaterial({ color: 0x3a7fff, transparent: true, opacity: 0.06, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    // routes: dense points per route, a faint static network, and moving comets
    const dense = data.routes.map(densify);
    const colors = data.routes.map(r => new THREE.Color(flowBy.get(r.flow)?.color || "#ffffff"));
    let segCount = 0; dense.forEach(d => { segCount += d.length - 1; });
    const netPos = new Float32Array(segCount * 6), netCol = new Float32Array(segCount * 6); let o = 0;
    dense.forEach((d, ri) => { const c = colors[ri]; for (let i = 1; i < d.length; i++) { netPos.set([d[i - 1].x, d[i - 1].y, d[i - 1].z, d[i].x, d[i].y, d[i].z], o); netCol.set([c.r, c.g, c.b, c.r, c.g, c.b], o); o += 6; } });
    const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute("position", new THREE.BufferAttribute(netPos, 3)); netGeo.setAttribute("color", new THREE.BufferAttribute(netCol, 3));
    const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(net);
    const NR = data.routes.length; const cPos = new Float32Array(NR * TAIL * 6), cCol = new Float32Array(NR * TAIL * 6);
    const cGeo = new THREE.BufferGeometry(); cGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute("color", new THREE.BufferAttribute(cCol, 3));
    const comets = new THREE.LineSegments(cGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(comets);
    const heads = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(NR * 3), 3)).setAttribute("color", new THREE.BufferAttribute(new Float32Array(NR * 3), 3)), new THREE.PointsMaterial({ vertexColors: true, size: 0.016, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); scene.add(heads);
    // selected route
    const selGroup = new THREE.Group(); scene.add(selGroup);
    // hotspots
    const hotMeshes: { id: string; ring: THREE.Mesh; pin: THREE.Mesh }[] = [];
    for (const h of data.hotspots) {
      const p = toVec(h.lat, h.lon, 0.01); const n = p.clone().normalize();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.position.copy(p); ring.lookAt(p.clone().add(n)); scene.add(ring);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); pin.position.copy(p); scene.add(pin);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.22, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.copy(toVec(h.lat, h.lon, 0.11)); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); scene.add(beam);
      hotMeshes.push({ id: h.id, ring, pin });
    }
    let shownMap: Record<string, boolean> = Object.fromEntries(data.flows.map(f => [f.id, true]));
    const phase = data.routes.map(r => r.phase);
    const setSelection = (i: number | null) => {
      selGroup.clear(); if (i == null) return;
      const d = dense[i]; const c = colors[i];
      selGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(d), Math.min(400, d.length * 2), 0.006, 6, false), new THREE.MeshBasicMaterial({ color: 0xffffff })));
      selGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(d), Math.min(400, d.length * 2), 0.012, 6, false), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
      data.routes[i].pts.forEach(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); m.position.copy(toVec(p.lat, p.lon, p.alt + 0.012)); selGroup.add(m); });
      controls.autoRotate = false;
    };
    api.current = { setShown: s => { shownMap = s; }, setSel: setSelection };
    // picking: nearest route head or point in screen space
    const ndc = new THREE.Vector3(); let downAt = 0, downX = 0, downY = 0;
    const onDown = (e: PointerEvent) => { downAt = performance.now(); downX = e.clientX; downY = e.clientY; };
    const onUp = (e: PointerEvent) => {
      if (performance.now() - downAt > 350 || Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = el.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; const W = rect.width, H = rect.height;
      const camDir = camera.position.clone().normalize();
      let best = -1, bestD = 14; let bestHot: string | null = null;
      for (const h of data.hotspots) { const p = toVec(h.lat, h.lon, 0.02); if (p.dot(camDir) < 0.1) continue; ndc.copy(p).project(camera); const d = Math.hypot((ndc.x + 1) / 2 * W - px, (1 - ndc.y) / 2 * H - py); if (d < 22) bestHot = h.id; }
      if (bestHot) { setHot(bestHot); setSel(null); setSelection(null); return; }
      for (let i = 0; i < NR; i++) {
        if (!shownMap[data.routes[i].flow]) continue; const d = dense[i];
        for (let k = 0; k < d.length; k += 2) { if (d[k].dot(camDir) < 0.15) continue; ndc.copy(d[k]).project(camera); const dist = Math.hypot((ndc.x + 1) / 2 * W - px, (1 - ndc.y) / 2 * H - py); if (dist < bestD) { bestD = dist; best = i; } }
      }
      setHot(null); setSel(best >= 0 ? best : null); setSelection(best >= 0 ? best : null); setIntro(false);
    };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp);
    const onResize = () => { if (!host.current) return; const W = host.current.clientWidth, H = host.current.clientHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    let raf = 0, last = performance.now(), t = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick); const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      sun.position.set(Math.cos(t * 0.05) * 5, 2, Math.sin(t * 0.05) * 5);
      const cp = cGeo.attributes.position as THREE.BufferAttribute, cc = cGeo.attributes.color as THREE.BufferAttribute; const hp = heads.geometry.attributes.position as THREE.BufferAttribute, hc = heads.geometry.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < NR; i++) {
        const d = dense[i]; const on = shownMap[data.routes[i].flow]; const c = colors[i];
        phase[i] = (phase[i] + dt * data.routes[i].speed * 0.045) % 1;
        const head = Math.floor(phase[i] * (d.length - 1));
        for (let k = 0; k < TAIL; k++) {
          const a = Math.max(0, head - k - 1), b = Math.max(0, head - k); const fade = on ? (1 - k / TAIL) * (1 - k / TAIL) : 0;
          cp.setXYZ((i * TAIL + k) * 2, d[a].x, d[a].y, d[a].z); cp.setXYZ((i * TAIL + k) * 2 + 1, d[b].x, d[b].y, d[b].z);
          cc.setXYZ((i * TAIL + k) * 2, c.r * fade, c.g * fade, c.b * fade); cc.setXYZ((i * TAIL + k) * 2 + 1, c.r * fade, c.g * fade, c.b * fade);
        }
        hp.setXYZ(i, d[head].x, d[head].y, d[head].z); hc.setXYZ(i, on ? 1 : 0, on ? 1 : 0, on ? 1 : 0);
      }
      cp.needsUpdate = true; cc.needsUpdate = true; hp.needsUpdate = true; hc.needsUpdate = true;
      hotMeshes.forEach(h => { h.ring.scale.setScalar(1 + Math.sin(t * 2.5) * 0.25); (h.ring.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 2.5) * 0.3; });
      controls.update(); renderer.render(scene, camera);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); controls.dispose(); renderer.dispose(); el.innerHTML = ""; api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { api.current?.setShown(shown); }, [shown]);

  const route = sel != null ? data.routes[sel] : null; const flow = route ? flowBy.get(route.flow) : null;
  const hotspot = hot ? data.hotspots.find(h => h.id === hot) : null; const hotPer = hot ? hotspotRoutes.find(h => h.id === hot)?.per : null;
  const oddsText = (r: Route) => (r.rolls === 0 ? "no dice on this route" : r.odds >= 0.1 ? `${Math.round(r.odds * 100)} in 100` : `1 in ${Math.max(1, Math.round(1 / r.odds))}`);
  return (
    <div className="wd">
      <div ref={host} className="wd-canvas" />
      <div className="wd-legend">
        {data.flows.map(f => <button key={f.id} className={"wd-flow" + (shown[f.id] ? " on" : "")} onClick={() => setShown(s => ({ ...s, [f.id]: !s[f.id] }))}><i style={{ background: f.color }} />{f.title}<span className="muted"> · {counts[f.id] || 0}</span></button>)}
      </div>
      {intro && !route && !hotspot && <div className="wd-intro"><h1>The living Earth</h1><p>Every thread is one traveller taking a real route through the map, rolled on the map&apos;s own odds. Most water falls back into the sea. Most carbon stays in the air. Little dust reaches the Amazon. Drag to turn, tap a thread to follow it, tap the beacon for a chapter.</p><button className="btn primary" onClick={() => setIntro(false)}>Start</button></div>}
      {route && flow && (
        <aside className="wd-panel">
          <button className="x" onClick={() => { setSel(null); api.current?.setSel(null); }} aria-label="Close">×</button>
          <div className="wd-kicker" style={{ color: flow.color }}>{flow.title}</div>
          <h2>{route.pts.length - 1} legs · {route.rolls} roll{route.rolls === 1 ? "" : "s"} of the dice</h2>
          <p className="wd-odds">{oddsText(route)} of {flow.traveller.replace(/^one /, "")}s take this route.</p>
          <ol className="wd-legs">{route.pts.map((p, i) => { const nd = flow.nodes[p.node]; const st = nd?.step; return <li key={i}><b>{nd?.name || p.node}</b>{st && data.stepLabel[st] ? <div className="small muted">On the map: <Link href={`/map/${data.stepProcess[st]}#${st}`}>{data.stepLabel[st]}</Link></div> : <div className="small muted">Geographic detail, not a step on the map.</div>}</li>; })}</ol>
          {flow.ride && <Link className="btn primary" href={flow.ride}>Ride this journey →</Link>}
        </aside>
      )}
      {hotspot && (
        <aside className="wd-panel">
          <button className="x" onClick={() => setHot(null)} aria-label="Close">×</button>
          <div className="wd-kicker">Chapter</div>
          <h2>{hotspot.name}</h2>
          <p>{hotspot.text}</p>
          {hotPer && <ul className="wd-per">{hotPer.map(x => <li key={x.flow.id}><i style={{ background: x.flow.color }} />{x.n} of {counts[x.flow.id]} {x.flow.title.toLowerCase().replace(/^a /, "")} threads pass here</li>)}</ul>}
          {hotspot.questions.length > 0 ? <><h3>Open questions nobody has tested</h3><ul className="wd-q">{hotspot.questions.map(q => <li key={q.id}><Link href={`/hypotheses#${q.id}`}>{q.title}</Link></li>)}</ul></> : <p className="small muted">No ranked open question touches these steps yet.</p>}
        </aside>
      )}
    </div>
  );
}
