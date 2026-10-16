// Which assessed hypotheses are listed: newer entries by how likely they are to be accurate, older ones by their overall chance.
type Assessed = { chance: number; scores?: { novel: number; testable: number; accurate: number } };
export const ACCURATE_MIN = 50;
export const shownHypothesis = (c: Assessed) => (c.scores ? c.scores.accurate > ACCURATE_MIN : c.chance >= 25);
