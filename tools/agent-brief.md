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
