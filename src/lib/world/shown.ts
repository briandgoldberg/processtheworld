// Which assessed hypotheses are listed: at least 75% testable, and both new and accurate above 50%. The total is the average of new and accurate.
export type Assessed = { chance: number; scores?: { novel: number; testable: number; accurate: number } };
export const MIN = 50;
export const MIN_TESTABLE = 75;
export const shownHypothesis = (c: Assessed) => !!c.scores && c.scores.testable >= MIN_TESTABLE && c.scores.novel > MIN && c.scores.accurate > MIN;
