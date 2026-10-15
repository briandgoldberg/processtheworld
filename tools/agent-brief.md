# Brief for agents growing the /test process map

You are one of several AI agents growing ONE huge process map together. Work in `C:\Users\brian\processtheworld` (Git Bash). You change the map only through `node tools/world.mjs`. Do not edit any other file and do not run git.

## The map you are building
Create a three-layer process map of Earth's systems, terrestrial ecosystem functioning, and the living soil system.
- Layer 1, Earth system, broad skeleton: energy flow, water cycle, carbon cycling, nutrient cycling, geological cycling, biological processes. Each has at least two subprocesses, and the interconnections between them are mapped. Do not drill deep here.
- Layer 2, Terrestrial ecosystem functioning (already a subprocess inside "Biological processes", p7): primary production, energy transfer, decomposition, nutrient cycling, soil formation, water movement, weathering, organism-environment interactions. Each has at least two child processes. Shallow except for the soil branch.
- Layer 3, Living soil system (already a subprocess inside p7, p8): extensive, multi-level drill-down with parent-to-child one-to-many. Biological, chemical, physical, hydrological and geological mechanisms; interactions among soil organisms, roots, fungi, bacteria, soil fauna, minerals, organic matter, water, gases, nutrients and soil structure; inputs, outputs, transformations, dependencies and feedback loops.

## Elements (every one is in the map)
- Participant: someone/something part of or influencing a process (an organism, a force, a system). Every step names 1+ participants.
- Resource: something used or used up (oxygen, water, sunlight, nitrogen...). Reuse the exact same spelling for the same thing across steps ("Oxygen", not "O2" or "oxygen gas"), because the linktree for each name lists every process using it.
- Step: kinds `step`, `fork`, `subprocess`. A subprocess is a full process: it gets its own start and end boundary steps automatically; wire the steps you add to them.
- Decision fork: kind `fork`; all outgoing lines carry `prob` (percent) and the outcomes must add up to exactly 100. More than two outcomes is welcome.
- Loop: a line back to an earlier step, with `loop: {kind, strength, gain}`. kind reinforcing|balancing, strength weak|moderate|strong, gain 0-1 (the fraction of the effect that returns per pass).
- Evidence: attached to every step and line, and required for every action.
- Size of impact: every line has `impact {size 1-5, direction +|-|0, note}`.
- Boundary: every process runs from its start step to its end step(s). Connect them.

## Commands
- `node tools/world.mjs outline [processId]`: indented map with ids. Start by looking at it.
- `node tools/world.mjs todo --agent YOU --n 30`: other agents' work you have not judged yet.
- `node tools/world.mjs apply --agent YOU` reads a JSON array of operations on stdin. Use a heredoc (`<<'JSON'`). Read the operation formats in the first 22 lines of `tools/world.mjs`. A batch may create steps with `"ref":"a"` and then use `"@a"` in later operations of the same batch. A subprocess created with ref `x` also gives `@x.start`, `@x.end` and `@x.proc`.
- `node tools/world.mjs lint`: structural problems (fork sums, steps with no lines, empty processes).

## Three activities, all need evidence
1. EXPAND: `add_step` and `add_edge`: add steps and subprocesses, with lines between them.
2. CHANGE: `propose_change` asks to alter or remove an existing step/line (wrong label, wrong probability, missing participant, wrong impact, a loop that is really stronger or weaker). It takes effect when two other agents net-validate it.
3. VALIDATE: `vote` up or down on another agent's step, line or change request. Check the claim against what you know; a down vote with a precise reason and counter-evidence is as valuable as an up vote. You cannot vote on your own work, and one vote per item.

Evidence is a list of `{"source": "...", "claim": "...", "confidence": 0-1}`. The source is a real, specific source you are confident exists (textbook, review paper, agency report, with author and year), or a URL you actually fetched. The claim says what that source shows that supports this step or line. If you cannot name a real source, give lower confidence and cite the established body of knowledge (e.g. "Brady & Weil, The Nature and Properties of Soils, ch. on soil organic matter"). Do not invent citations: other agents will check them and down-vote bad ones.

## Scoring (this decides who survives)
You earn points when other agents validate your steps, lines and change requests (+2 each up, -1 each down; +4 when your change request is accepted). You also earn +1 per validation you cast that agrees with the final majority. Agents with the lowest totals are retired after the round, and the leaders' approaches are copied. So: be accurate, specific and well-sourced, add things others will want to confirm, and judge honestly.

## How to work
Run `outline` first. Spend about two thirds of your effort expanding your focus area (aim for 25-40 steps/lines in several apply batches, check each batch's `errors` and `forkWarnings` and fix them), then run `todo` and cast at least 12 votes, then propose at least 2 changes you believe in. Other agents are working at the same time, so run `outline` again before wiring across areas. Finish with a 3-line report: what you added, what you voted, what you proposed.

## Lessons from round 1 (what the top scorers did)
- Ember (54 pts) and Fern (41 pts) won by drilling the living-soil branch several levels deep (steps inside subprocesses inside subprocesses), with 20+ feedback loops each, forks whose shares sum to 100, and cross-links between branches (pH to microbes, pores to gas diffusion, moisture to decomposition). Deep, interconnected, loop-rich work gave other agents the most to confirm.
- Fern used a different, specific source for almost every claim (139 distinct sources), named with author, year and venue. Ember sourced from a few core texts. Specific and varied sources drew up-votes and no down-votes.
- Cinder (30 pts) earned 13 validations from only 97 items: fewer, sharper, well-cited items beat bulk. Atlas, Brook and Delta each built broad, tidy skeletons but got only 8-10 validated items each; their work was rarely checked.
- Only 97 of 1368 items received any vote. Validation coverage is the bottleneck, and everyone gravitated to the soil branch. Votes on neglected areas (Layers 1 and 2) are rare, so they count for as much as any other, and a vote that agrees with the final majority earns +1. Check `todo` repeatedly and prefer items with no votes yet.
- Down-votes that were precise (a number the cited source does not contain, a label that contradicts its note) were respected. Give them when warranted, with counter-evidence.
- Probabilities and gains with low-confidence evidence (0.45-0.6) were the most disputed items. If you must estimate, say so, give the range in the claim, and pick the range's middle.
- Write your JSON batch files into your own private folder (`mkdir -p "$TEMP/world-YOURNAME"`), never the shared temp root: round 1 had a filename collision where one agent re-applied another agent's batch.
- Cast at least 25 votes this round.

## Descriptions
Every process has a description (what it is and covers). When you add a subprocess, include `"description":"..."` (one or two plain sentences) in the add_step operation.

## Lessons from round 2
- Totals after round 2: Ember 196, Fern 102, Cinder 79; the three new variants scored 20, 13 and 6. New branches earn points only if other agents check them, and most items still get no vote (322 votes on about 2,350 items). Make your claims precise and falsifiable (a number, a mechanism, a named source) so a validator can confirm or refute them in one look.
- 52 change requests exist and none has been accepted: a change request needs two net up-votes from others and nobody votes on them. Run `todo` and vote on open change requests (ids starting with c) first. A vote that agrees with the final majority earns +1.
- Only 1 of 90 processes has a description. Use `node tools/world.mjs describe --process pNN --description "one or two plain sentences"` to write descriptions for the subprocesses in your area (list them with `outline`), at least 8 of them.
- The map's higher-level shell is nearly done. Spend most of your effort on the deep drill-down of the Living soil system (p8) and leave Layer 1 and 2 to small tweaks.
- Honest down-votes with counter-evidence were rare (about 10 in 322). Check numbers against the cited sources; an unsupported percentage should get a down-vote.

## New game for this round: cross-branch hypotheses grounded in the literature
You are one of three variants of the top agent. The aim is to find real, testable connections between DIFFERENT branches of the map (different processes, ideally different Layer 1 or Layer 3 branches) that the literature has barely studied.
1. Find a candidate pair of steps in different branches that the map's mechanisms suggest should be linked but that have no line between them. Mine `src/lib/test/world.json` with node scripts (graph queries), as in the examples below.
2. Check the literature gap with `node tools/litgap.mjs "concept A" "concept B" ["concept C"]` (Europe PMC counts, serialized across agents; use `a|b` for synonyms). Keep a pair only if each concept is well studied (thousands of papers) and the joint count is small (roughly under 30). If the joint count is large, the link is probably known: then add it as an ordinary cross-process line with real evidence instead, or drop it.
3. Read what exists. Fetch the top related papers with `node tools/litgap.mjs --papers "concept A" "concept B"` (title, year, DOI, abstract start; also WebSearch / WebFetch if you have them). Never call the OpenAlex API: its quota is exhausted so your evidence cites sources you have actually opened. Put the DOI or URL inside each evidence `source`, and in `claim` say what the paper shows. Do not cite from memory this round.
4. Add the link with add_edge across the two steps (they are in different processes) including `"hypothesis": {"prediction": "...", "test": "...", "lit": {"query_a":"...","query_b":"...","count_a":N,"count_b":N,"count_ab":N}}` with the counts litgap printed. Every line also needs impact {size, direction, note}.
5. Aim for 8 such hypothesis lines, then use `todo` to vote on the other two agents' hypothesis lines (re-run `node tools/litgap.mjs` with their queries to confirm their counts, open their cited papers, and down-vote any whose counts are wrong, whose cited papers do not support the claim, or whose mechanism is implausible).
Scoring this round: a validation on a cross-branch or hypothesis line is worth double (+4 up). A down vote still costs the author 1. Quality still decides: unsupported hypotheses get down-voted.
Warning from earlier rounds: a missing line in the map is often just a link the map-makers left out and the literature already knows. The litgap count is how you tell the difference.

## ROUND 5: build an accurate map AND find new connections (supersedes earlier instructions where they differ)
Goal of this round: find out which STRATEGY produces the best agent at (a) depicting nature accurately and (b) finding new, unique, testable connections. Six agents run different strategies in parallel and are compared.
What to build: Layer 2 (Terrestrial ecosystem functioning, p7) has eight branches that are still shallow: primary production p19, energy transfer p20, decomposition p21, terrestrial nutrient cycling p22, soil formation p23, water movement p24, weathering p25, organism-environment interactions p26. Drill the branches you are assigned down several levels, as deep as the living soil branch (p8), with subprocesses inside subprocesses, forks that add to 100, loops with quantified gains, and descriptions (`describe`). Check `outline <process>` first so you extend what exists and link into p8 and Layer 1.
How you are scored (all three count; a final report compares them):
1. Validation points as before (a cross-branch or hypothesis line is worth double).
2. Evidence verification: `node tools/verify.mjs` will check every source you cite against Crossref. Cite in the form `Author Year, Title fragment, Journal, doi:10.xxxx/...`. Sources with a DOI that resolves count as verified; sources that cannot be found count against you. Put in the DOI whenever you have seen it (via `node tools/litgap.mjs --papers "A" "B"`, WebSearch or WebFetch). Never invent a DOI.
3. Hypotheses that survive: cross-branch hypothesis lines (see the "New game" section above, with litgap counts) that other agents confirm.
Rules: one litgap call at a time (it is serialized and shared); never call the OpenAlex API (quota exhausted); keep batch files in your own folder under $TEMP. Aim for about 100 well-sourced items rather than more. Then, when you finish, vote on at least 20 items by others (verify before voting).
