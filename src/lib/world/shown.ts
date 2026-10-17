// How an assessed hypothesis is scored and whether it is listed.
//
// Three scores, each 0-100, set by an assessor following tools/assess.md:
//   novel     chance the connection is genuinely untested: nobody has measured these two things together
//   accurate  chance the predicted DIRECTION of the effect would hold up if the test were run
//   testable  chance the proposed test can be run and would settle the question
// The total ("chance it is new and holds up") is novel x accurate / 100: the joint chance that the idea is new AND
// holds up, computed here so it can never drift from the two scores it summarises. A hypothesis is listed when it is
// at least 75% testable and both novel and accurate are at least 50%. It is a "long shot" when it is at least 75%
// testable and 75% novel but only 25-49% accurate. `impact` (how much it matters if true) is shown beside the total
// and breaks ties. Ideas that share a `cluster` are ranked once, by their best total; the rest are related variants.
export type Scores = { novel: number; testable: number; accurate: number; impact?: number };
export type Assessed = { chance?: number; scores?: Scores; cluster?: string };
export const MIN = 50;
export const MIN_TESTABLE = 75;
export const MIN_LONG_NOVEL = 75;
export const MIN_LONG_ACCURATE = 25;
export const chanceOf = (s?: Scores) => (s ? Math.round((s.novel * s.accurate) / 100) : 0);
/** Scores are judgments, not measurements: show them to the nearest 5 and sort on the exact numbers. */
export const near5 = (n: number) => Math.round(n / 5) * 5;
export const shownHypothesis = (c: Assessed) => !!c.scores && c.scores.testable >= MIN_TESTABLE && c.scores.novel >= MIN && c.scores.accurate >= MIN;
export const longShot = (c: Assessed) => !!c.scores && c.scores.testable >= MIN_TESTABLE && c.scores.novel >= MIN_LONG_NOVEL && c.scores.accurate >= MIN_LONG_ACCURATE && c.scores.accurate < MIN;

/** Order by total, then by impact; keep one idea per cluster and put the others in `variants` with their leader. */
export function ranking<T extends Assessed & { id: string }>(items: T[]) {
  const cmp = (a: T, b: T) => chanceOf(b.scores) - chanceOf(a.scores) || (b.scores?.impact ?? 0) - (a.scores?.impact ?? 0);
  const candidates = items.filter(c => shownHypothesis(c) || longShot(c)).sort(cmp);
  const seen = new Map<string, T>();
  const leaders: T[] = [];
  const variants: { item: T; leader: T }[] = [];
  for (const c of candidates) {
    const lead = c.cluster ? seen.get(c.cluster) : undefined;
    if (lead) { variants.push({ item: c, leader: lead }); continue; }
    if (c.cluster) seen.set(c.cluster, c);
    leaders.push(c);
  }
  return { main: leaders.filter(shownHypothesis), longShots: leaders.filter(c => !shownHypothesis(c)), variants };
}
