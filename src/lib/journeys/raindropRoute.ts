// Where each scene of the raindrop journey typically happens, as one real route: the central Pacific, the westerlies to
// California, the Sierra Nevada, the Central Valley and its aquifer, the San Joaquin, the Delta and out the Golden Gate.
// These are typical places, not measurements: the map's steps happen everywhere; the route makes them somewhere.
export type Place = { lat: number; lon: number; place: string };
export const RAINDROP_ROUTE: Record<string, Place> = {
  sun: { lat: 21, lon: -156, place: "Central Pacific, off Hawaiʻi" },
  "evap-sea": { lat: 24, lon: -150, place: "Open Pacific, trade-wind belt" },
  "land-fork": { lat: 36.6, lon: -119.8, place: "San Joaquin Valley, California" },
  transpire: { lat: 36.9, lon: -119.4, place: "Sierra foothill oak woodland" },
  "evap-soil": { lat: 36.5, lon: -120.1, place: "Irrigated fields, Central Valley" },
  mix: { lat: 28, lon: -143, place: "Lower atmosphere, eastern Pacific" },
  "nine-days": { lat: 32, lon: -136, place: "Mid-ocean air, drifting east" },
  winds: { lat: 36, lon: -128, place: "The westerlies, approaching California" },
  rise: { lat: 37.5, lon: -122.8, place: "Coast Range, California" },
  seed: { lat: 38, lon: -121.5, place: "Over the Central Valley" },
  condense: { lat: 38.3, lon: -120.4, place: "Sierra Nevada western slope" },
  where: { lat: 38.5, lon: -119.9, place: "Sierra Nevada crest" },
  "sea-end": { lat: 26, lon: -140, place: "Back in the Pacific" },
  land: { lat: 38.2, lon: -119.9, place: "Sierra Nevada, California" },
  snow: { lat: 37.9, lon: -119.4, place: "Tuolumne high country, Yosemite" },
  icesheet: { lat: 37.1, lon: -118.5, place: "Palisade Glacier, Sierra Nevada" },
  melt: { lat: 37.8, lon: -119.6, place: "Tuolumne River headwaters" },
  ground: { lat: 37.3, lon: -120.6, place: "San Joaquin Valley floor" },
  "evapo-end": { lat: 36.8, lon: -119.9, place: "Central Valley, back into the air" },
  soak: { lat: 37.0, lon: -120.3, place: "Valley soils near Merced" },
  percolate: { lat: 36.7, lon: -120.4, place: "Central Valley aquifer" },
  deep: { lat: 36.3, lon: -120.6, place: "Deep aquifer, Tulare Basin" },
  shallow: { lat: 37.1, lon: -120.7, place: "Shallow groundwater, Merced" },
  creep: { lat: 37.3, lon: -120.9, place: "Toward the San Joaquin River" },
  river: { lat: 37.6, lon: -121.2, place: "San Joaquin River" },
  estuary: { lat: 38.05, lon: -121.8, place: "Sacramento–San Joaquin Delta" },
  "sea-return": { lat: 37.8, lon: -122.6, place: "Golden Gate, into the Pacific" },
};
