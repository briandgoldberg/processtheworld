// Flows: travellers sampled as hundreds of routes over the globe. A flow is a small graph of places; where the map has a
// fork, the link carries the fork step and its target so the live share can be read from the map; where only geography
// splits (which forest, which ocean), the link carries a plain weight and is marked as geographic detail. Each sampled
// route rolls the real forks, so the density of threads on the globe is honest: most water falls back into the sea,
// most carbon stays in the air, most dust lands short of the Amazon.

export type Link = { to: string; forkStep?: string; target?: string; share?: number; w?: number };
export type FlowNode = { id: string; name: string; lat: number; lon: number; spread: number; step?: string; alt?: number; next?: Link[]; /** several next places but no meaningful choice: the globe picks one by weight */ auto?: boolean };
export type Flow = { id: string; title: string; traveller: string; plural: string; color: string; start: { to: string; w: number }[]; nodes: Record<string, FlowNode>; ride?: string };
export type RoutePoint = { lat: number; lon: number; alt: number; node: string };
export type Roll = { forkStep: string; target: string; share: number };
export type Route = { flow: string; pts: RoutePoint[]; odds: number; rolls: Roll[]; speed: number; phase: number };

const node = (id: string, name: string, lat: number, lon: number, spread: number, extra: Partial<FlowNode> = {}): FlowNode => ({ id, name, lat, lon, spread, ...extra });

// ---------- the raindrop: four ocean basins, each with its own coast, mountains, valley and river ----------
type Basin = { key: string; w: number; sea: [number, number, string]; air: [number, number, string]; winds: [number, number, string]; coast: [number, number, string]; mountains: [number, number, string]; oceanEnd: [number, number, string]; valley: [number, number, string]; river: [number, number, string]; estuary: [number, number, string]; back: [number, number, string] };
const BASINS: Basin[] = [
  { key: "pac", w: 40, sea: [21, -156, "Central Pacific"], air: [28, -143, "Eastern Pacific air"], winds: [36, -128, "The westerlies"], coast: [37.5, -122.8, "California coast"], mountains: [38.3, -120, "Sierra Nevada"], oceanEnd: [26, -140, "Back in the Pacific"], valley: [36.8, -120, "Central Valley"], river: [37.6, -121.2, "San Joaquin River"], estuary: [38, -121.8, "Sacramento–San Joaquin Delta"], back: [37.8, -122.6, "Golden Gate"] },
  { key: "atl", w: 25, sea: [28, -45, "Subtropical Atlantic"], air: [38, -30, "Mid-Atlantic air"], winds: [46, -15, "Atlantic westerlies"], coast: [48, -4, "Brittany coast"], mountains: [46.5, 8, "The Alps"], oceanEnd: [35, -35, "Back in the Atlantic"], valley: [48.5, 2.5, "Paris basin"], river: [49.5, 0.8, "The Seine"], estuary: [49.45, 0.3, "Seine estuary"], back: [49.5, -0.5, "English Channel"] },
  { key: "ind", w: 20, sea: [-10, 75, "Indian Ocean"], air: [0, 72, "Monsoon air"], winds: [10, 70, "Southwest monsoon"], coast: [15, 73.5, "Western Ghats"], mountains: [28, 84, "The Himalaya"], oceanEnd: [-5, 80, "Back in the Indian Ocean"], valley: [25.5, 82, "Ganges plain"], river: [25.3, 83, "The Ganges"], estuary: [22, 89, "Ganges delta"], back: [21, 89.5, "Bay of Bengal"] },
  { key: "spac", w: 15, sea: [-20, -110, "South Pacific"], air: [-25, -95, "South Pacific air"], winds: [-33, -80, "Roaring forties, southern edge"], coast: [-33.5, -72, "Chilean coast"], mountains: [-33.4, -70, "The Andes"], oceanEnd: [-28, -100, "Back in the South Pacific"], valley: [-34, -71, "Central Chile valley"], river: [-34.5, -71.5, "Maipo River"], estuary: [-34.8, -72.1, "Maipo mouth"], back: [-35, -72.5, "Back in the Pacific"] },
];
function raindrop(): Flow {
  const nodes: Record<string, FlowNode> = {};
  const start: { to: string; w: number }[] = [];
  for (const b of BASINS) {
    const k = b.key; start.push({ to: `${k}-sea`, w: b.w });
    const add = (suffix: string, p: [number, number, string], spread: number, extra: Partial<FlowNode>) => { nodes[`${k}-${suffix}`] = node(`${k}-${suffix}`, p[2], p[0], p[1], spread, extra); };
    add("sea", b.sea, 10, { step: "s373", alt: 0, next: [{ to: `${k}-air` }] });
    add("air", b.air, 7, { step: "s377", alt: 0.06, next: [{ to: `${k}-winds` }] });
    add("winds", b.winds, 5, { step: "s_y3m0ver5j", alt: 0.09, next: [{ to: `${k}-coast` }] });
    add("coast", b.coast, 2, { step: "s378", alt: 0.07, next: [{ to: `${k}-mountains` }] });
    add("mountains", b.mountains, 1.5, { step: "s380", alt: 0.05, next: [{ to: `${k}-oceanEnd`, forkStep: "s380", target: "s381", share: 78 }, { to: `${k}-land`, forkStep: "s380", target: "s382", share: 22 }] });
    add("oceanEnd", b.oceanEnd, 9, { step: "s381", alt: 0, next: [{ to: `${k}-sea` }] });
    add("land", b.mountains, 1.2, { step: "s383", alt: 0.01, next: [{ to: `${k}-airEnd`, forkStep: "s384", target: "s385", share: 64 }, { to: `${k}-soil`, forkStep: "s384", target: "s386", share: 36 }] });
    add("airEnd", b.valley, 2, { step: "s385", alt: 0.05, next: [{ to: `${k}-air` }] });
    add("soil", b.valley, 1.5, { step: "s386", alt: 0, next: [{ to: `${k}-river` }] });
    add("river", b.river, 0.8, { step: "s388", alt: 0, next: [{ to: `${k}-estuary` }] });
    add("estuary", b.estuary, 0.5, { step: "s_4pmhj59kg", alt: 0, next: [{ to: `${k}-back` }] });
    add("back", b.back, 0.6, { alt: 0, next: [{ to: `${k}-sea` }] });
  }
  return { id: "raindrop", title: "A raindrop", traveller: "one water molecule", plural: "raindrops", color: "#7fd0ff", start, nodes, ride: "/journey/raindrop" };
}

// ---------- a carbon atom: from a city's exhaust to the air, the sea or a forest ----------
const CITIES: [string, string, number, number, number][] = [["houston", "Houston", 29.8, -95.4, 22], ["shanghai", "Shanghai", 31.2, 121.5, 26], ["rotterdam", "Rotterdam", 51.9, 4.5, 14], ["delhi", "Delhi", 28.6, 77.2, 16], ["joburg", "Johannesburg", -26.2, 28.0, 10], ["saopaulo", "São Paulo", -23.5, -46.6, 12]];
const OCEANS: [string, string, number, number][] = [["natl", "North Atlantic sink", 45, -30], ["south", "Southern Ocean sink", -55, 40], ["npac", "North Pacific sink", 40, -165]];
const FORESTS: [string, string, number, number, number][] = [["amazon", "Amazon forest", -3, -60, 2], ["congo", "Congo forest", 0, 20, 1], ["boreal", "Boreal Canada", 55, -100, 1], ["siberia", "Siberian taiga", 60, 100, 1], ["seasia", "Southeast Asian forest", 2, 110, 1]];
function carbon(): Flow {
  const nodes: Record<string, FlowNode> = {};
  const start: { to: string; w: number }[] = [];
  for (const [k, name, lat, lon, w] of CITIES) {
    start.push({ to: `src-${k}`, w });
    nodes[`src-${k}`] = node(`src-${k}`, name, lat, lon, 0.8, { step: "s_dzyajn8fa", alt: 0, next: [{ to: `aloft-${k}` }] });
    nodes[`aloft-${k}`] = node(`aloft-${k}`, `Aloft over ${name}`, lat + 6, lon + 14, 6, { step: "s_259nwe8fj", alt: 0.1, next: [
      { to: `stays-${k}`, forkStep: "s_259nwe8fj", target: "s_cwebgs8fs", share: 41 },
      ...OCEANS.map(([o]) => ({ to: `ocean-${o}`, forkStep: "s_259nwe8fj", target: "s_vvn1ha8g0", share: 25, w: 1 })),
      ...FORESTS.map(([f, , , , fw]) => ({ to: `forest-${f}`, forkStep: "s_259nwe8fj", target: "s_cl8rw78g8", share: 34, w: fw })),
    ] });
    nodes[`stays-${k}`] = node(`stays-${k}`, "Stays in the atmosphere, drifting east", lat + 12, lon + 70, 9, { step: "s_cwebgs8fs", alt: 0.12, next: [{ to: "mixed" }] });
  }
  // the atmosphere mixes within about a year, so carbon that stays aloft or returns to the air meets the fork again anywhere
  nodes.mixed = node("mixed", "Mixed through the whole atmosphere", 10, 0, 40, { step: "s_cwebgs8fs", alt: 0.14, auto: true, next: CITIES.map(([k, , , , w]) => ({ to: `aloft-${k}`, w })) });
  for (const [o, name, lat, lon] of OCEANS) { nodes[`ocean-${o}`] = node(`ocean-${o}`, name, lat, lon, 8, { step: "s_vvn1ha8g0", alt: 0, next: [{ to: `outgas-${o}` }] }); nodes[`outgas-${o}`] = node(`outgas-${o}`, `Given back across the sea surface, ${name.replace(" sink", "")}`, lat + 4, lon + 10, 8, { step: "s242", alt: 0.05, next: [{ to: "mixed" }] }); }
  for (const [f, name, lat, lon] of FORESTS) {
    nodes[`forest-${f}`] = node(`forest-${f}`, name, lat, lon, 4, { step: "s_cl8rw78g8", alt: 0.01, next: [{ to: `fixed-${f}` }] });
    nodes[`fixed-${f}`] = node(`fixed-${f}`, `Fixed by leaves, ${name}`, lat, lon, 3, { step: "s_sxbirk6fh", alt: 0, next: [{ to: `respired-${f}`, forkStep: "s_2jquon6fr", target: "s_0sk8px6fz", share: 57 }, { to: `stored-${f}`, forkStep: "s_2jquon6fr", target: "s_2ctusx6g8", share: 43 }] });
    nodes[`respired-${f}`] = node(`respired-${f}`, `Breathed back out, ${name}`, lat + 3, lon + 4, 4, { step: "s_0sk8px6fz", alt: 0.06, next: [{ to: "mixed" }] });
    nodes[`stored-${f}`] = node(`stored-${f}`, `Stored as wood and soil, ${name}`, lat, lon, 3, { step: "s_2ctusx6g8", alt: 0, next: [{ to: `decay-${f}` }] }); nodes[`decay-${f}`] = node(`decay-${f}`, `Decades later, soil respiration returns it, ${name}`, lat + 2, lon + 3, 3, { step: "s1267", alt: 0.04, next: [{ to: "mixed" }] });
  }
  return { id: "carbon", title: "A carbon atom", traveller: "one carbon atom from a tailpipe", plural: "carbon atoms", color: "#ffd27f", start, nodes };
}

// ---------- a grain of dust: lifted from a desert, carried across an ocean ----------
function dust(): Flow {
  const n: Record<string, FlowNode> = {};
  n.lift = node("lift", "Which desert?", 20, 40, 0, { step: "s_xutoubv04", alt: 0.04, next: [
    { to: "bodele", forkStep: "s_xutoubv04", target: "s_6iwtt7v0g", share: 50 },
    { to: "taklamakan", forkStep: "s_xutoubv04", target: "s_yrh6yav0q", share: 40, w: 0.5 }, { to: "gobi", forkStep: "s_xutoubv04", target: "s_yrh6yav0q", share: 40, w: 0.5 },
    { to: "australia", forkStep: "s_xutoubv04", target: "s_z60olqv10", share: 10, w: 0.4 }, { to: "patagonia", forkStep: "s_xutoubv04", target: "s_z60olqv10", share: 10, w: 0.3 }, { to: "greatbasin", forkStep: "s_xutoubv04", target: "s_z60olqv10", share: 10, w: 0.3 },
  ] });
  n.bodele = node("bodele", "Bodélé Depression, Chad", 17, 18, 3, { step: "s_6iwtt7v0g", alt: 0.03, next: [{ to: "atl-transport", w: 0.72 }, { to: "med", w: 0.28 }] });
  n["atl-transport"] = node("atl-transport", "Saharan air layer over the Atlantic", 12, -30, 6, { step: "s1589", alt: 0.1, next: [{ to: "amazon", w: 0.4 }, { to: "caribbean", w: 0.35 }, { to: "atl-fall", w: 0.25 }] });
  n.amazon = node("amazon", "Amazon basin, dust settles on the forest", -3, -60, 3, { step: "s_06qv9rv1c", alt: 0 });
  n.caribbean = node("caribbean", "Caribbean and Florida", 18, -70, 4, { step: "s1589", alt: 0.02 });
  n["atl-fall"] = node("atl-fall", "Falls into the tropical Atlantic", 8, -40, 6, { alt: 0 });
  n.med = node("med", "Across the Mediterranean to Europe", 42, 12, 5, { step: "s1589", alt: 0.06 });
  n.taklamakan = node("taklamakan", "Taklamakan Desert", 39, 83, 3, { step: "s_yrh6yav0q", alt: 0.03, next: [{ to: "pac-transport" }] });
  n.gobi = node("gobi", "Gobi Desert", 43, 105, 3, { step: "s_yrh6yav0q", alt: 0.03, next: [{ to: "pac-transport" }] });
  n["pac-transport"] = node("pac-transport", "Across the North Pacific", 42, 165, 6, { step: "s1589", alt: 0.1, next: [{ to: "namerica", w: 0.55 }, { to: "pac-fall", w: 0.45 }] });
  n.namerica = node("namerica", "Pacific Northwest and the Rockies", 46, -118, 5, { step: "s1589", alt: 0.02 });
  n["pac-fall"] = node("pac-fall", "Falls into the North Pacific, feeding plankton", 38, -170, 8, { alt: 0 });
  n.australia = node("australia", "Lake Eyre basin, Australia", -27, 135, 3, { step: "s_z60olqv10", alt: 0.03, next: [{ to: "tasman" }] });
  n.tasman = node("tasman", "Across the Tasman Sea", -38, 162, 5, { alt: 0.06, next: [{ to: "southern" }] });
  n.southern = node("southern", "Southern Ocean, iron for plankton", -50, 175, 7, { alt: 0 });
  n.patagonia = node("patagonia", "Patagonian steppe", -45, -69, 3, { step: "s_z60olqv10", alt: 0.03, next: [{ to: "satl" }] });
  n.satl = node("satl", "South Atlantic", -48, -35, 7, { alt: 0.05, next: [{ to: "southern2" }] });
  n.southern2 = node("southern2", "Southern Ocean, iron for plankton", -52, -10, 7, { alt: 0 });
  n.greatbasin = node("greatbasin", "Great Basin, Nevada", 40, -116, 3, { step: "s_z60olqv10", alt: 0.03, next: [{ to: "plains" }] });
  n.plains = node("plains", "Settles on the Great Plains", 41, -100, 5, { alt: 0 });
  return { id: "dust", title: "A grain of dust", traveller: "one grain of desert dust", plural: "dust grains", color: "#f0b27a", start: [{ to: "lift", w: 1 }], nodes: n };
}

export const FLOWS: Flow[] = [raindrop(), carbon(), dust()];

// ---------- sampling ----------
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T>(items: T[], weight: (x: T) => number, r: number): T => { const tot = items.reduce((a, x) => a + weight(x), 0); let u = r * tot; for (const x of items) { u -= weight(x); if (u <= 0) return x; } return items[items.length - 1]; };

/** Sample `n` routes per flow. `share(forkStep, target)` returns the live share from the map, or undefined to fall back to the static one. */
export function sampleRoutes(flows: Flow[], n: number, share: (forkStep: string, target: string) => number | undefined, seed = 7, maxNodes = 9): Route[] {
  const out: Route[] = []; const R = rng(seed);
  const gauss = () => (R() + R() + R() - 1.5) * 1.2;
  for (const f of flows) {
    for (let i = 0; i < n; i++) {
      let id = pick(f.start, s => s.w, R()).to; const pts: RoutePoint[] = []; const rolls: Roll[] = []; let odds = 1, guard = 0;
      while (id && guard++ < maxNodes) {
        const nd = f.nodes[id]; if (!nd) break;
        pts.push({ lat: nd.lat + gauss() * nd.spread, lon: nd.lon + gauss() * nd.spread * (nd.spread > 4 ? 1.6 : 1), alt: nd.alt ?? 0.02, node: nd.id });
        if (!nd.next || nd.next.length === 0) break;
        const links = nd.next.map(l => ({ l, wt: (l.forkStep && l.target ? (share(l.forkStep, l.target) ?? l.share ?? 1) : l.share ?? 100) * (l.w ?? 1) }));
        const chosen = pick(links, x => x.wt, R());
        if (chosen.l.forkStep) { const forkTotal = links.filter(x => x.l.forkStep === chosen.l.forkStep).reduce((a, x) => a + x.wt, 0); const sameTarget = links.filter(x => x.l.forkStep === chosen.l.forkStep && x.l.target === chosen.l.target).reduce((a, x) => a + x.wt, 0); const sh = sameTarget / (forkTotal || 1); odds *= sh; rolls.push({ forkStep: chosen.l.forkStep, target: chosen.l.target!, share: Math.round(sh * 100) }); }
        id = chosen.l.to;
      }
      if (pts.length > 1) out.push({ flow: f.id, pts, odds, rolls, speed: 0.6 + R() * 0.9, phase: R() });
    }
  }
  return out;
}
