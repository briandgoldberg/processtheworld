// A journey is a scripted route over real steps on the map. Each scene is bound to a step id; its label, evidence and
// fork odds are read live from the map when the page renders, so the story can never say something the map does not.
// Where the map has a fork with shares, the journey rolls dice with those shares. Where the map has lines but no shares,
// the traveller chooses, and the page says so.

export type Stage = "sea" | "air" | "cloud" | "land" | "soil" | "ice" | "river" | "end";
export type Scene = {
  id: string; step?: string; stage: Stage; title: string; say: string;
  next?: string;
  /** a real fork on the map: options carry the step the fork's line points to, so the live share can be looked up */
  fork?: { step: string; options: { to: string; target: string; label: string }[] };
  /** lines without shares: the traveller decides */
  choice?: { ask: string; options: { to: string; label: string }[] };
  end?: { title: string; say: string };
};

export const RAINDROP: { id: string; title: string; traveller: string; intro: string; start: string; scenes: Scene[] } = {
  id: "raindrop",
  title: "Follow a raindrop",
  traveller: "one water molecule",
  intro: "You are one water molecule. Every step below is a real step on the map, and every roll of the dice uses the map's own odds.",
  start: "sun",
  scenes: [
    { id: "sun", step: "s371", stage: "sea", title: "Warmed by the sun", say: "You are one water molecule in the top millimetre of the ocean. Morning sun warms the water around you, and you begin to shake loose from your neighbours.",
      fork: { step: "s372", options: [{ to: "evap-sea", target: "s373", label: "Lift off the sea surface" }, { to: "land-fork", target: "s374", label: "Lift off the land" }] } },
    { id: "evap-sea", step: "s373", stage: "air", title: "Into the air", say: "You break free of the surface and take a parcel of heat with you. The sea is a little cooler for your leaving.", next: "mix" },
    { id: "land-fork", step: "s374", stage: "land", title: "Damp ground", say: "You are in wet soil instead, and there are two ways back to the sky.",
      fork: { step: "s374", options: [{ to: "transpire", target: "s375", label: "Up through a plant" }, { to: "evap-soil", target: "s376", label: "Straight off the soil or a wet leaf" }] } },
    { id: "transpire", step: "s375", stage: "land", title: "Through a leaf", say: "A root hair pulls you in. You climb the stem in an unbroken thread of water and leave through a pore on the underside of a leaf.", next: "mix" },
    { id: "evap-soil", step: "s376", stage: "land", title: "Off the ground", say: "You lift off the wet ground into warm air.", next: "mix" },
    { id: "mix", step: "s377", stage: "air", title: "Vapour", say: "Turbulence folds you into the lower atmosphere. You are vapour now, invisible, one molecule among a vast crowd.", next: "nine-days" },
    { id: "nine-days", step: "s_4f1zwmw4j", stage: "air", title: "Nine days", say: "On average you will stay up here about nine days before you come down again.", next: "winds" },
    { id: "winds", step: "s_y3m0ver5j", stage: "air", title: "Carried by the wind", say: "Winds carry you. Each year about forty thousand cubic kilometres of vapour crosses from sea to land this way, matching what the rivers send back.", next: "rise" },
    { id: "rise", step: "s378", stage: "cloud", title: "Rising", say: "The air that holds you is lifted and cools.", next: "seed" },
    { id: "seed", step: "s_1ymru5w53", stage: "cloud", title: "A speck to land on", say: "You cannot condense on nothing. You need a speck a fraction of a micrometre across: sea salt, sulfate, dust.", next: "condense" },
    { id: "condense", step: "s379", stage: "cloud", title: "A droplet", say: "You join a droplet on a particle and give back the heat you took from the sea. The cloud warms a little.", next: "where" },
    { id: "where", step: "s380", stage: "cloud", title: "Falling", say: "The droplets merge and the cloud grows heavy. Where will you fall?",
      fork: { step: "s380", options: [{ to: "sea-end", target: "s381", label: "Into the ocean" }, { to: "land", target: "s382", label: "Onto land" }] } },
    { id: "sea-end", step: "s381", stage: "end", title: "Back to the sea", say: "", end: { title: "Back to the sea", say: "You fall into the ocean, the way most raindrops do. A short, closed loop: most water never touches land at all." } },
    { id: "land", step: "s382", stage: "land", title: "Landfall", say: "You fall on land.",
      choice: { ask: "The map has lines for both but gives no odds here. Rain or snow?", options: [{ to: "ground", label: "Rain" }, { to: "snow", label: "Snow" }] } },
    { id: "snow", step: "s389", stage: "ice", title: "Snow", say: "You land as a snowflake and are buried by more. Pressed for decades, you turn into glacier ice.", next: "icesheet" },
    { id: "icesheet", step: "s391", stage: "ice", title: "Locked in ice", say: "Ice sheets hold most of the planet's fresh water, and they hold it for centuries to millennia. You wait.", next: "melt" },
    { id: "melt", step: "s392", stage: "river", title: "Meltwater", say: "Spring. The ice at your edge thins and you run out as meltwater into soil and streams.", next: "soak" },
    { id: "ground", step: "s383", stage: "land", title: "On the ground", say: "You hit the ground.",
      fork: { step: "s384", options: [{ to: "evapo-end", target: "s385", label: "Back to the air" }, { to: "soak", target: "s386", label: "Into the soil" }] } },
    { id: "evapo-end", step: "s385", stage: "end", title: "Back to the sky", say: "", end: { title: "Back to the sky", say: "Before you can go anywhere, sun and plants pull you back into the air. Most rain that reaches land takes this short route. Your journey begins again." } },
    { id: "soak", step: "s386", stage: "soil", title: "Into the soil", say: "You sink between soil grains, filling the pores and topping up the water the plants will drink.", next: "percolate" },
    { id: "percolate", step: "s_f8z4qpw2q", stage: "soil", title: "Down to the aquifer", say: "You keep going down into an aquifer. Nearly all the planet's liquid fresh water is down here.",
      choice: { ask: "The map has lines for both but gives no odds here. Shallow or deep?", options: [{ to: "shallow", label: "Shallow groundwater" }, { to: "deep", label: "Deep, fossil groundwater" }] } },
    { id: "deep", step: "s_lx9d0xw3w", stage: "end", title: "Lost to time", say: "", end: { title: "Lost to time", say: "You are fossil water now. You may stay underground for thousands to hundreds of thousands of years, until a well finds you." } },
    { id: "shallow", step: "s_97mdnrw3a", stage: "soil", title: "Creeping", say: "You creep sideways through rock. At this pace a spring is a century or two away.", next: "creep" },
    { id: "creep", step: "s387", stage: "soil", title: "Toward the river", say: "Groundwater seeps toward the nearest river, and you go with it.", next: "river" },
    { id: "river", step: "s388", stage: "river", title: "The river", say: "You surface into a river and race seaward with sediment and dissolved nutrients for company.", next: "estuary" },
    { id: "estuary", step: "s_4pmhj59kg", stage: "river", title: "Where river meets tide", say: "The river meets the tide. Salt water slides in beneath you and the two mix.", next: "sea-return" },
    { id: "sea-return", stage: "end", title: "Home to the sea", say: "", end: { title: "Home to the sea", say: "You are back in the ocean, carrying a little of the land with you. Soon the sun will warm the water around you again." } },
  ],
};
