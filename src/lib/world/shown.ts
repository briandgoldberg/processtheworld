// How an assessed hypothesis is scored and whether it is listed.
//
// Three scores, each 0-100, set by an assessor following tools/assess.md:
//   novel     chance the connection is genuinely untested: nobody has measured these two things together
//   accurate  chance the predicted DIRECTION of the effect would hold up if the test were run
//   testable  chance the proposed test can be run and would settle the question
// The total ("chance it is new and holds up") is the average of novel and accurate, computed here so it can
// never drift from the two scores it summarises. A hypothesis is listed when it is at least 75% testable and
// both novel and accurate are at least 50%.
export type Scores = { novel: number; testable: number; accurate: number };
export type Assessed = { chance?: number; scores?: Scores };
export const MIN = 50;
export const MIN_TESTABLE = 75;
export const chanceOf = (s?: Scores) => (s ? Math.round((s.novel + s.accurate) / 2) : 0);
export const shownHypothesis = (c: Assessed) => !!c.scores && c.scores.testable >= MIN_TESTABLE && c.scores.novel >= MIN && c.scores.accurate >= MIN;
