// Which assessed hypotheses are listed: newer entries need both new and accurate above 50%, older ones by their overall chance.
type Assessed = { chance: number; scores?: { novel: number; testable: number; accurate: number } };
export const MIN = 50;
export const shownHypothesis = (c: Assessed) => (c.scores ? c.scores.novel > MIN && c.scores.accurate > MIN : c.chance >= 25);
