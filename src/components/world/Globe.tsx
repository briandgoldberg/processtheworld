"use client";
// The living Earth, guided: pick a traveller, tap the globe to choose where it starts, and follow it leg by leg. Each leg
// is a real step on the map; at a fork the branches draw on the globe with the map's shares and you choose or roll.
// Hundreds of sampled threads of the chosen traveller move faintly in the background so the picture of where most of
// them go stays honest.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Flow, FlowNode, Link as FlowLink, Route } from "@/lib/journeys/flows";

export type WorldData = { flows: Flow[]; routes: Route[]; stepLabel: Record<string, string>; stepProcess: Record<string, string>; hotspots: { id: string; name: string; lat: number; lon: number; radius: number; text: string; questions: { id: string; title: string }[] }[] };
type Choice = { fork: string; chosen: string; share?: number };
type Visit = { node: string; choice?: Choice };
type Option = { key: string; label: string; share?: number; links: FlowLink[]; forkStep?: string };

const R = 1;
const toVec = (lat: number, lon: number, alt = 0) => { const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180, r = R + alt; return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); };
const toLatLon = (v: THREE.Vector3) => { const n = v.clone().normalize(); const lat = 90 - Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) * 180 / Math.PI; const lon = Math.atan2(n.z, -n.x) * 180 / Math.PI - 180; return { lat, lon: ((lon + 540) % 360) - 180 }; };
function arcPts(a: { lat: number; lon: number; alt?: number }, b: { lat: number; lon: number; alt?: number }, lift = 1): THREE.Vector3[] {
  const va = toVec(a.lat, a.lon).normalize(), vb = toVec(b.lat, b.lon).normalize(); const w = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1)) || 1e-6;
  const n = Math.max(8, Math.round(w * 48)); const out: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) { const t = k / n; const v = va.clone().multiplyScalar(Math.sin((1 - t) * w) / Math.sin(w)).add(vb.clone().multiplyScalar(Math.sin(t * w) / Math.sin(w))).normalize(); const alt = (a.alt ?? 0.02) + ((b.alt ?? 0.02) - (a.alt ?? 0.02)) * t + Math.sin(Math.PI * t) * Math.min(0.09, w * 0.28) * lift + 0.012; out.push(v.multiplyScalar(R + alt)); }
  return out;
}
const TAIL = 14;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const short = (t: string, n = 80) => (t.length > n ? t.slice(0, n - 3).trimEnd() + "…" : t);

type Api = { focus: (flowId: string | null) => void; setRoute: (nodes: FlowNode[]) => void; setBranches: (from: FlowNode | null, to: { node: FlowNode; share?: number }[]) => void; flyTo: (from: FlowNode | null, to: FlowNode, onDone: () => void) => void; marker: (node: FlowNode | null) => void };

export default function Globe({ data }: { data: WorldData }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [trail, setTrail] = useState<Visit[]>([]);
  const [flying, setFlying] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  const [startName, setStartName] = useState<string | null>(null);
  const flow = useMemo(() => data.flows.find(f => f.id === flowId) || null, [data, flowId]);
  const cur = flow && trail.length ? flow.nodes[trail[trail.length - 1].node] : null;
  const starts = useMemo(() => { if (!flow) return []; const ids = flow.id === "dust" ? (flow.nodes.lift.next || []).map(l => l.to) : flow.start.map(s => s.to); return ids.map(id => flow.nodes[id]).filter(Boolean); }, [flow]);
  const seedRef = useRef(1);
  const rand = () => { seedRef.current = (seedRef.current * 1664525 + 1013904223) % 4294967296; return seedRef.current / 4294967296; };
  const tapRef = useRef<(lat: number, lon: number) => void>(() => undefined);

  // options at the current node: map forks grouped by target, plain geographic choices otherwise
  const options: Option[] = useMemo(() => {
    if (!cur || !flow || !cur.next?.length) return [];
    const forkLinks = cur.next.filter(l => l.forkStep && l.target);
    if (forkLinks.length) { const byTarget = new Map<string, FlowLink[]>(); forkLinks.forEach(l => { (byTarget.get(l.target!) || byTarget.set(l.target!, []).get(l.target!)!).push(l); }); return [...byTarget.entries()].map(([target, links]) => ({ key: target, label: data.stepLabel[target] || target, share: links[0].share, links, forkStep: links[0].forkStep })); }
    return cur.next.map(l => ({ key: l.to, label: flow.nodes[l.to]?.name || l.to, links: [l] }));
  }, [cur, flow, data]);
  const single = useMemo(() => {
    if (!cur?.next?.length) return null;
    if (cur.next.length === 1 && !cur.next[0].forkStep) return cur.next[0];
    if (cur.auto) { const tot = cur.next.reduce((a, l) => a + (l.w ?? 1), 0); let u = rand() * tot; for (const l of cur.next) { u -= l.w ?? 1; if (u <= 0) return l; } return cur.next[cur.next.length - 1]; }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);
  const atEnd = !!cur && (!cur.next || cur.next.length === 0);

  const go = useCallback((toId: string, choice?: Choice) => {
    if (!flow || !cur) return; const nd = flow.nodes[toId]; if (!nd) return;
    setFlying(true); api.current?.setBranches(null, []);
    api.current?.flyTo(cur, nd, () => { setTrail(t => [...t, { node: toId, choice }]); setFlying(false); });
  }, [flow, cur]);
  const choose = (o: Option) => {
    if (!cur) return;
    const link = o.links.length === 1 ? o.links[0] : (() => { const tot = o.links.reduce((a, l) => a + (l.w ?? 1), 0); let u = rand() * tot; for (const l of o.links) { u -= l.w ?? 1; if (u <= 0) return l; } return o.links[o.links.length - 1]; })();
    go(link.to, o.forkStep ? { fork: data.stepLabel[o.forkStep] || "A fork on the map", chosen: o.label, share: o.share } : { fork: "Where next", chosen: o.label });
  };
  const begin = (nd: FlowNode) => { setTrail([{ node: nd.id }]); setStartName(nd.name); api.current?.marker(nd); api.current?.setRoute([nd]); };
  const reset = () => { setTrail([]); setStartName(null); api.current?.setRoute([]); api.current?.setBranches(null, []); api.current?.marker(null); };

  // a tap on the globe while choosing a start snaps to the nearest start for the traveller
  tapRef.current = (lat, lon) => {
    if (!flow || trail.length) return;
    const v = toVec(lat, lon).normalize(); let best: FlowNode | null = null, bd = -2;
    for (const s of starts) { const d = toVec(s.lat, s.lon).normalize().dot(v); if (d > bd) { bd = d; best = s; } }
    if (best) begin(best);
  };
  useEffect(() => { api.current?.focus(flowId); reset(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);
  useEffect(() => { if (!flow || !cur) return; api.current?.setRoute(trail.map(v => flow.nodes[v.node])); api.current?.marker(cur); const br = options.map(o => { const l = o.links[0]; return { node: flow.nodes[l.to], share: o.share }; }).filter(x => x.node); api.current?.setBranches(cur, flying ? [] : br); }, [trail, options, flow, cur, flying]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const phone = el.clientWidth < 700;
    const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(phone ? 1.5 : 2, window.devicePixelRatio)); renderer.setSize(el.clientWidth, el.clientHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04070f);
    const camera = new THREE.PerspectiveCamera(38, el.clientWidth / el.clientHeight, 0.05, 50); camera.position.set(0, 0.9, phone ? 3.9 : 3.1);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.07; controls.minDistance = 1.35; controls.maxDistance = 6; controls.autoRotate = true; controls.autoRotateSpeed = 0.3; controls.enablePan = false;
    const SN = 1500; const sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30); sp[i * 3] = v.x; sp[i * 3 + 1] = v.y; sp[i * 3 + 2] = v.z; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaab8d0, size: 0.06, transparent: true, opacity: 0.7 })));
    scene.add(new THREE.AmbientLight(0xffffff, 0.75)); const sun = new THREE.DirectionalLight(0xfff4e0, 1.5); scene.add(sun);
    const tex = new THREE.TextureLoader().load("/journey/earth.jpg"); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 })); scene.add(earth);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 64, 48), new THREE.MeshBasicMaterial({ color: 0x5fa8ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 64, 48), new THREE.MeshBasicMaterial({ color: 0x3a7fff, transparent: true, opacity: 0.06, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    // background threads
    const flowBy = new Map(data.flows.map(f => [f.id, f]));
    const dense = data.routes.map(r => { const out: THREE.Vector3[] = []; for (let i = 1; i < r.pts.length; i++) { const seg = arcPts(r.pts[i - 1], r.pts[i]); out.push(...(i === 1 ? seg : seg.slice(1))); } return out; });
    const colors = data.routes.map(r => new THREE.Color(flowBy.get(r.flow)?.color || "#ffffff"));
    const NR = data.routes.length; const cPos = new Float32Array(NR * TAIL * 6), cCol = new Float32Array(NR * TAIL * 6);
    const cGeo = new THREE.BufferGeometry(); cGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute("color", new THREE.BufferAttribute(cCol, 3));
    const comets = new THREE.LineSegments(cGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(comets);
    const phase = data.routes.map(r => r.phase); let focusId: string | null = null; let dim = 1;
    // guided route
    const routeGroup = new THREE.Group(); scene.add(routeGroup); const branchGroup = new THREE.Group(); scene.add(branchGroup);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); marker.visible = false; scene.add(marker);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.visible = false; scene.add(glow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.045, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.visible = false; scene.add(ring);
    // hotspots
    const hotMeshes: THREE.Mesh[] = [];
    for (const h of data.hotspots) { const p = toVec(h.lat, h.lon, 0.01); const n = p.clone().normalize(); const hr = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); hr.position.copy(p); hr.lookAt(p.clone().add(n)); scene.add(hr); hotMeshes.push(hr); const pin = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); pin.position.copy(p); scene.add(pin); }
    // flight state
    let flight: { pts: THREE.Vector3[]; t0: number; dur: number; done: () => void } | null = null; let camDist = camera.position.length(); const targetLook = new THREE.Vector3(0, 0, 0); let follow = false;
    const colorOf = () => new THREE.Color(focusId ? flowBy.get(focusId)?.color || "#ffffff" : "#ffffff");
    api.current = {
      focus: id => { focusId = id; controls.autoRotate = !id; },
      setRoute: nodes => { routeGroup.clear(); if (!nodes.length) return; const c = colorOf(); for (let i = 1; i < nodes.length; i++) { const pts = arcPts(nodes[i - 1], nodes[i]); routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.0032, 6, false), new THREE.MeshBasicMaterial({ color: 0xffffff }))); routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.009, 6, false), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }))); } nodes.forEach((n, i) => { if (i === nodes.length - 1) return; const m = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); m.position.copy(toVec(n.lat, n.lon, (n.alt ?? 0.02) + 0.012)); routeGroup.add(m); }); },
      setBranches: (from, to) => { branchGroup.clear(); if (!from || !to.length) return; const c = colorOf(); to.forEach(b => { const pts = arcPts(from, b.node); const th = b.share != null ? 0.003 + (b.share / 100) * 0.012 : 0.005; branchGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, th, 6, false), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }))); const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); d.position.copy(toVec(b.node.lat, b.node.lon, (b.node.alt ?? 0.02) + 0.012)); branchGroup.add(d); }); },
      flyTo: (from, to, onDone) => { const pts = from ? arcPts(from, to) : [toVec(to.lat, to.lon, (to.alt ?? 0.02) + 0.012)]; flight = { pts, t0: performance.now(), dur: 900 + Math.min(1800, pts.length * 28), done: onDone }; follow = true; camDist = Math.min(camDist, 2.2); },
      marker: node => { const on = !!node; marker.visible = glow.visible = ring.visible = on; if (!node) { follow = false; return; } const p = toVec(node.lat, node.lon, (node.alt ?? 0.02) + 0.012); marker.position.copy(p); glow.position.copy(p); ring.position.copy(p); ring.lookAt(p.clone().multiplyScalar(2)); targetLook.copy(p); follow = true; camDist = Math.min(camDist, 2.3); },
    };
    // taps: pick a start on the globe, or open a hotspot
    const ray = new THREE.Raycaster(); let downAt = 0, downX = 0, downY = 0;
    const onDown = (e: PointerEvent) => { downAt = performance.now(); downX = e.clientX; downY = e.clientY; };
    const onUp = (e: PointerEvent) => {
      if (performance.now() - downAt > 350 || Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = el.getBoundingClientRect(); const nd = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(nd, camera);
      for (const h of data.hotspots) { const p = toVec(h.lat, h.lon, 0.02); const v = p.clone().project(camera); const d = Math.hypot((v.x - nd.x) / 2 * rect.width, (v.y - nd.y) / 2 * rect.height); if (d < 22 && p.dot(camera.position.clone().normalize()) > 0.1) { setHot(h.id); return; } }
      const hit = ray.intersectObject(earth, false)[0]; if (!hit) return;
      const { lat, lon } = toLatLon(hit.point); tapRef.current(lat, lon);
    };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp);
    const onResize = () => { if (!host.current) return; const W = host.current.clientWidth, H = host.current.clientHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    let raf = 0, last = performance.now(), t = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick); const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      sun.position.copy(camera.position).normalize().multiplyScalar(5).add(new THREE.Vector3(2, 2.5, 0));
      dim += ((focusId ? 0.35 : 1) - dim) * (1 - Math.pow(0.001, dt));
      const cp = cGeo.attributes.position as THREE.BufferAttribute, cc = cGeo.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < NR; i++) {
        const d = dense[i]; const on = !focusId || data.routes[i].flow === focusId; const c = colors[i];
        phase[i] = (phase[i] + dt * data.routes[i].speed * 0.045) % 1; const head = Math.floor(phase[i] * (d.length - 1));
        for (let k = 0; k < TAIL; k++) { const a = Math.max(0, head - k - 1), b = Math.max(0, head - k); const fade = on ? (1 - k / TAIL) * (1 - k / TAIL) * dim : 0; cp.setXYZ((i * TAIL + k) * 2, d[a].x, d[a].y, d[a].z); cp.setXYZ((i * TAIL + k) * 2 + 1, d[b].x, d[b].y, d[b].z); cc.setXYZ((i * TAIL + k) * 2, c.r * fade, c.g * fade, c.b * fade); cc.setXYZ((i * TAIL + k) * 2 + 1, c.r * fade, c.g * fade, c.b * fade); }
      }
      cp.needsUpdate = true; cc.needsUpdate = true;
      if (flight) { const u = Math.min(1, (now - flight.t0) / flight.dur); const e = ease(u); const idx = e * (flight.pts.length - 1); const i0 = Math.floor(idx), i1 = Math.min(flight.pts.length - 1, i0 + 1); const p = flight.pts[i0].clone().lerp(flight.pts[i1], idx - i0); marker.position.copy(p); glow.position.copy(p); ring.position.copy(p); ring.lookAt(p.clone().multiplyScalar(2)); targetLook.copy(p); if (u >= 1) { const done = flight.done; flight = null; done(); } }
      if (follow) { const look = targetLook.clone().normalize(); controls.target.lerp(targetLook.clone().multiplyScalar(0.25), 0.08); const want = look.multiplyScalar(camDist).add(new THREE.Vector3(0, camDist * 0.18, 0)); camera.position.lerp(want, 0.045); }
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.2); hotMeshes.forEach(h => { h.scale.setScalar(1 + Math.sin(t * 2.5) * 0.25); });
      controls.update(); renderer.render(scene, camera);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); controls.dispose(); renderer.dispose(); el.innerHTML = ""; api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choices = trail.map(v => v.choice).filter((c): c is Choice => !!c);
  const laps = flow ? trail.filter((v, i) => i > 0 && starts.some(s => s.id === v.node)).length + 1 : 1;
  const hotspot = hot ? data.hotspots.find(h => h.id === hot) : null;
  const stepOf = (nd: FlowNode) => (nd.step && data.stepLabel[nd.step] ? { label: data.stepLabel[nd.step], href: `/map/${data.stepProcess[nd.step]}#${nd.step}` } : null);
  const last = trail.length ? trail[trail.length - 1].choice : undefined;
  return (
    <div className="wd">
      <div ref={host} className="wd-canvas" />
      <div className="wd-legend">
        {flow ? <button className="wd-flow on" onClick={() => setFlowId(null)}>← Travellers</button> : data.flows.map(f => <button key={f.id} className="wd-flow on" onClick={() => setFlowId(f.id)}><i style={{ background: f.color }} />{f.title}</button>)}
        {flow && <span className="wd-flow on" style={{ cursor: "default" }}><i style={{ background: flow.color }} />{flow.title}</span>}
      </div>
      {!flow && !hotspot && <div className="wd-intro"><h1>The living Earth</h1><p>Pick a traveller, tap the globe where it should start, and follow it leg by leg, choosing the way at every fork. Every leg is a real step on the map, and every fork shows the map&apos;s own shares. Water and carbon never end: they cycle. The faint threads are hundreds of other travellers.</p><div className="wd-pick">{data.flows.map(f => <button key={f.id} className="btn primary" onClick={() => setFlowId(f.id)}>{f.title}</button>)}</div></div>}
      {flow && !cur && !hotspot && <div className="wd-intro"><h1>Where does your {flow.title.replace(/^a /i, "")} start?</h1><p>Tap anywhere on the globe. It will begin at the nearest place this traveller can start.</p><div className="wd-pick">{starts.slice(0, 6).map(s => <button key={s.id} className="btn" onClick={() => begin(s)}>{s.name}</button>)}</div></div>}
      {flow && cur && !hotspot && (
        <aside className="wd-panel">
          <button className="x" onClick={reset} aria-label="Start over">×</button>
          <div className="wd-kicker" style={{ color: flow.color }}>{flow.title} · leg {trail.length}{laps > 1 ? ` · lap ${laps}` : ""}{startName ? ` · from ${startName}` : ""}</div>
          <h2>{cur.name}</h2>
          {stepOf(cur) ? <p className="small muted">On the map: <Link href={stepOf(cur)!.href}>{short(stepOf(cur)!.label, 140)}</Link></p> : <p className="small muted">Geographic detail: the map&apos;s steps happen everywhere, the route makes them somewhere.</p>}
          {last && <p className="wd-odds">You chose {short(last.chosen, 60)}{last.share != null ? `: ${last.share}% of ${flow.plural} go this way` : ""}.</p>}
          {!atEnd && single && <div className="wd-actions"><button className="btn primary big" disabled={flying} onClick={() => go(single.to)}>{flying ? "Travelling…" : "Continue →"}</button></div>}
          {!atEnd && !single && options.length > 0 && (
            <div className="wd-fork">
              <div className="wd-ask">{options[0].forkStep ? <>A fork on the map: <b>{short(data.stepLabel[options[0].forkStep] || "", 90)}</b>. The shares are the map&apos;s own. Pick a branch.</> : "The map has lines for each of these but gives no shares. Pick one."}</div>
              <div className="wd-options">{options.map(o => <button key={o.key} className="wd-opt" disabled={flying} onClick={() => choose(o)}>{o.share != null && <b>{o.share}%</b>}<span>{short(o.label, 90)}</span></button>)}</div>
            </div>
          )}
          {atEnd && (
            <div className="wd-end">
              <h3>Journey&apos;s end</h3>
              <p>A grain of dust lands and stays. {trail.length - 1} legs, {choices.length} fork{choices.length === 1 ? "" : "s"} chosen.</p>
              <div className="wd-actions"><button className="btn primary" onClick={reset}>Start again</button></div>
            </div>
          )}
          <h3>Your path</h3>
          <ol className="wd-legs">{trail.map((v, i) => <li key={i} className={i === trail.length - 1 ? "now" : ""}>{flow.nodes[v.node]?.name}{v.choice?.share != null && <span className="muted"> · {v.choice.share}%</span>}</li>)}</ol>
        </aside>
      )}
      {hotspot && (
        <aside className="wd-panel">
          <button className="x" onClick={() => setHot(null)} aria-label="Close">×</button>
          <div className="wd-kicker">Chapter</div>
          <h2>{hotspot.name}</h2>
          <p>{hotspot.text}</p>
          {hotspot.questions.length > 0 ? <><h3>Open questions nobody has tested</h3><ul className="wd-q">{hotspot.questions.map(q => <li key={q.id}><Link href={`/hypotheses#${q.id}`}>{q.title}</Link></li>)}</ul></> : <p className="small muted">No ranked open question touches these steps yet.</p>}
        </aside>
      )}
    </div>
  );
}
