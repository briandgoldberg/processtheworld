# Handoff: hypothesis scoring fix and rescore (started 2026-10-16, evening PT)

Anyone (person or agent) can pick this up. Work in `C:\Users\brian\processtheworld` (Git Bash), branch `main`.
Pushing to `main` deploys forks.world through Vercel (project `processtheworld`). There is no Python on this
machine; use node. Type-check with `npx tsc --noEmit` before committing.

## What was wrong

1. **Hypotheses vanished from the live map.** Commit `c9114b1` added a hard reject for hypotheses whose
   prediction or test is over 700 characters (limit since removed: text now keeps up to 5000). The live map is rebuilt by replaying every stored operation
   (`src/lib/world/store.ts` → `applyOp`), so about 70 hypotheses that had been accepted earlier (all of
   Briangold-Claude's 37, Lodestar's 4, and others) failed on replay and disappeared, with their authors'
   items and points and every vote on them. **Fixed and pushed** in `7920ac7`: ops replayed from the log carry
   `replay: true` and are clipped instead of refused. Verify on the site: `/api/world/read/hypotheses` should
   list ~100 hypotheses again and `/agents/Lodestar` should show 4 hypotheses.
2. **Scoring compressed "accurate".** Scores live in `src/lib/world/curated.json` (one entry per hypothesis,
   hand-written by an assessor agent in batches; see the git log "Add assessments for..."). 42 of 90 assessed
   entries sit in the 50s on `accurate`, because the assessor was scoring effect size and importance rather than
   whether the predicted direction would hold. The rubric that fixes this is `tools/assess.md` (anchored scales
   for novel, accurate, testable). **Written, committed with this note, not yet applied to the data.**
3. **Total and threshold.** `src/lib/world/shown.ts` now computes the total (`chanceOf`) as the average of
   novel and accurate instead of trusting a stored `chance`, and lists a hypothesis when testable >= 75 and
   novel >= 50 and accurate >= 50 (was strictly greater, which dropped two scored exactly 50). The pages still
   read the stored `c.chance` in places; switch them to `chanceOf(c.scores)` (see step 2 below).

## What is left, in order

1. ~~Confirm the deploy of `7920ac7`~~ Done: after the deploy the API lists 101 live hypotheses again and
   Lodestar shows 4 hypotheses / 14 points, Briangold-Claude 37 / 135.
2. **Finish the scoring code change.** Replace every `c.chance` read and sort with `chanceOf(c.scores)` in
   `src/app/hypotheses/page.tsx`, `src/app/page.tsx` (top-3 cards and the pill), `src/app/contribute/page.tsx`.
   Type-check, commit, push.
3. **Clickable hypothesis pages** (requested by Brian). Add `src/app/hypotheses/[id]/page.tsx` that renders one
   hypothesis in full (title, the two linked steps, prediction, test, prior work, web verdict, scores, why,
   evidence, validate button) and 404s when neither `curated.json` nor the live map knows the id. Move the
   `body()` function from `src/app/hypotheses/page.tsx` into a shared component (e.g.
   `src/components/HypothesisBody.tsx`) so the list rows and the page render the same thing. In the list, make
   the title a `Link` to `/hypotheses/<id>` (keep the row's expand behaviour). Update the links that point to
   `/hypotheses#<id>` in `src/app/feed/page.tsx` and `src/lib/world/highlights.ts` to `/hypotheses/<id>`, and the
   home page top-3 cards. Note `body()` returns null when the live edge is missing, which is why clicking a
   row showed nothing while the replay bug was live; the shared component should show the stored assessment
   and a one-line note instead of nothing.
4. **Rescore every hypothesis against `tools/assess.md`.** Get the full list from
   `https://forks.world/api/world/read/hypotheses` (id, from, to, by, prediction, test, lit) once the deploy is
   confirmed; `curated.json` has 105 entries (90 scored) and there may be new ones since. For each entry keep
   id, and keep status/untested/papers/web when they exist and are still right, but re-derive `scores` with the
   anchors (read the anchors before typing numbers; do not compress `accurate` toward 55), rewrite `why`
   (strength; risk; the mechanism that could flip the sign), add a `title` where missing, and drop `chance`
   (the site computes it). Entries with no `scores` yet need the full process (litgap counts, closest papers,
   web search). This is 100+ items of literature work: split into batches of ~20 and run them in parallel
   agents, each writing its batch to its own JSON file, then merge into `curated.json` with a node script that
   validates every entry (id exists, scores are integers 0-100, papers have no invented DOIs). Commit as
   "Rescore all hypotheses against tools/assess.md", push, then check `/hypotheses` on the site.
5. **Report** the new top 10 with old vs new scores.

## Context that is easy to lose

- Brian's own agents on forks.world: Briangold-Claude (older, run from another session), plus Lodestar,
  Bellwether, Cairn, Driftwood and Fathom (registered 2026-10-16 by Claude; keys in
  `C:\Users\brian\forks-world-agent-keys.txt`, outside the repo on purpose). They must not vote on each
  other's items (rule r_selfvote). `tools/sibling-agent-brief.md` is the brief those five agents ran with.
- Another Claude session has been committing to this repo (commits signed Claude Sonnet 5.5, e.g. the
  assessment batches and `c9114b1`). Pull before you start and keep commits small.
- Site conventions: plain-text content, evidence as `{source, claim, confidence}`, links inside `source`.


## Added 2026-10-17: the gap-finding instrument (commits 5ce9052, d15d968)

- **Quantified lines.** impact may carry elasticity (% change in the next step per 1% change in this one), low/high, value+unit, source (types.ts Impact; validated by cleanImpact in engine.ts; shown in the map panel).
- **src/lib/world/analysis.ts**: edgeConfidence, downstream (8 hops, no loops, no climbing out of a subprocess), weakEdges, missingLinks (a step makes a resource another process uses, no line between), contradictions (same steps, opposite sign / size gap >= 3 / non-overlapping elasticity ranges; fork outcomes excluded), paths (simple forward paths, weakest line, composed elasticity). Memoised per World.
- **Pages** /gaps and /paths; **API** /api/world/read/gaps, /contradictions, /paths?from&to. Nav links added.
- **Server-run novelty check** (src/lib/world/novelty.ts): after an add_hypothesis is accepted, the ops route schedules a Europe PMC re-run with next/server after(); the result is stored in table WCheck (prisma) and attached as hypothesis.check on load; shown on /hypotheses and in the API. POST /api/world/check with Authorization: Bearer <WORLD_ADMIN_KEY> and {"limit": 8} backfills unchecked hypotheses; {"ids": [...]} re-checks. The key is in C:Usersrianorks-world-agent-keys.txt and in Vercel env (production + preview).
- Not done: curated.json entries still carry a stored chance; the per-hypothesis /hypotheses/[id] page; the rescore (see above).


## Added 2026-10-17 (later): site restructure and the explorer (commits a7f9b58, 9288e81)

- **Public site** = home, /map/<id> (the explorer), /hypotheses (labelled Open questions), /gaps, /paths, /search, entity pages. No agent calls to action anywhere public.
- **Admin console** /admin (src/lib/admin.ts gate: cookie fw_admin = WORLD_ADMIN_KEY, set by /admin/login?key=...; always open in local dev). Holds /admin/contribute (prompt builder), /admin/agents (leaderboard + agent pages), /admin/feed, /admin/rules, counts of unchecked hypotheses and disagreeing counts, backfill commands.
- **Explorer** (src/components/Explorer.tsx + src/app/explorer.css; data built in src/app/map/[id]/page.tsx): one app: map stage, single contextual inspector (process -> its open questions, weakest lines, contradictions, missing links; step -> what follows, questions, weak lines, path tracer; line -> confidence, quantified rate, evidence), command-bar search (steps, open questions, processes, entities; / to focus; Enter picks the first step), layers Confidence and Open questions drawn on the map, collapsible outline dock, full screen (Esc backs out). The home page embeds it with embed=true. ProcessMap.tsx is gone.
- **Still open**: the rescore of curated.json against tools/assess.md; the backfill of site literature checks (POST /api/world/check needs the WORLD_ADMIN_KEY env, which was added after the first deploy, so run it after a7f9b58 or later is live); a per-hypothesis page /hypotheses/[id] if wanted; a wide-screen visual pass on the explorer (it was only checked at phone width).


## 2026-10-17, later again

- /gaps and /paths moved under /admin (gated). Public explorer no longer shows confidence, weak lines, contradictions, missing links or the path tracer; those stay in /admin/gaps, /admin/paths and the read API (gaps, contradictions, paths). Public nav: Explore, Open questions.
- Explorer is full page under the header (src/app/explorer.css: .xp height calc(100vh - 62px); footer hidden on map pages). Phone styles at the end of explorer.css.
- Wording: open questions = links between two Earth processes that no paper has tested; score columns New / Likely true / Both (new x likely true).
