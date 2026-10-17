# Assessing hypotheses (the rubric behind src/lib/world/curated.json)

Every hypothesis on the map gets one entry in `curated.json`. An assessor (a person or an agent) writes it after
reading the hypothesis, counting the literature and opening the closest papers. The three scores are what the
site ranks by, so they must mean the same thing for every hypothesis. This file defines them.

## The entry

```json
{
  "id": "e_xxxx",
  "title": "Eight-word plain-language title",
  "status": "nothing found | related only | partly tested | already published | contradicted",
  "untested": "One or two sentences: exactly what nobody has measured.",
  "papers": [{ "title": "what this paper did and did not test", "year": "2021", "doi": "https://doi.org/..." }],
  "web": { "verdict": "Nothing found | Plausible by analogy | Supports half | Partly tested | Already published | Contradicted", "text": "...", "links": [{ "label": "...", "url": "..." }] },
  "scores": { "novel": 0-100, "accurate": 0-100, "testable": 0-100, "impact": 0-100 },
  "cluster": "short-slug shared by hypotheses that make the same cause-and-effect claim",
  "rubric": 4,
  "assessed": "2026-10-17",
  "why": "Strength: ... ; risk: ..."
}
```

`chance` (the total shown on the site) is computed by the site as `novel x accurate / 100`, the chance the idea is new
AND holds up (a joint chance, not an average); do not hand-set it. A hypothesis is listed when `testable >= 75` and
both `novel` and `accurate` are `>= 50`. It is listed under "Long shots" when `testable >= 75`, `novel >= 75` and
`accurate` is 25-49. `impact` is shown beside the total and breaks ties; it is not part of the total.
`rubric` is the version of this file the scores follow and `assessed` is the date. Scores and displayed values are
shown rounded to the nearest 5 because the judgments are not that precise; sorting uses the exact numbers.
Hypotheses with the same `cluster` slug are one idea told several ways: the site ranks the highest total in each
cluster and shows the others as related variants.

## novel: chance that the connection is genuinely untested

Count papers on each topic and on both (Europe PMC, `node tools/litgap.mjs`), then read the titles of the joint
hits and run a web search for the specific combination. The count alone is not the score: a joint count of 0 with
an obvious wording miss scores low, and a joint count of 40 reviews that never measured the link scores high.
Never score above 85 on a zero joint count alone. Read the titles of the joint hits and the closest adjacent paper
(one half of the chain, or the same mechanism in another system) and say in `untested` what that paper did not
measure. "Zero prior papers" is a count, not a finding.

| score | anchor |
|---|---|
| 90-95 | No paper or review measures or even states the link; the joint hits are off-topic or wording accidents. |
| 75-85 | The link is mentioned in passing (a review sentence, a conference abstract, a model) but nobody has measured it. |
| 60-70 | An adjacent measurement exists (same mechanism in another system, or one half of the chain), but not this combination. |
| 40-55 | Partly measured: a published study covers a good part of the prediction, and the hypothesis adds a condition or a quantity. |
| 15-35 | Essentially published: the effect is known, even if under another name; the hypothesis restates it. |
| 0-10 | Textbook. |

## accurate: chance the predicted direction would hold up if the test were run

Score the DIRECTION of the main effect, not its size. The hypothesis states its own magnitude range, and a test
that finds the effect smaller than guessed but in the predicted direction counts as holding up. Magnitude
uncertainty belongs in `why`, not in this score. Importance does not belong here either.

| score | anchor |
|---|---|
| 90-95 | Follows from conservation of mass or energy, or from well-measured physics applied directly (dust darkens snow; less harvest leaves more nitrogen behind). Only measurement error could overturn it. |
| 75-85 | One established mechanism, no competing mechanism of comparable size, and a directly analogous measurement exists in another system. |
| 60-70 | Established mechanism, but a named competing mechanism could cancel or reverse it in some settings. |
| 45-55 | Plausible: two or more mechanisms of similar size pull in different directions, or the chain has two uncertain links. |
| 25-40 | Speculative: a chain of three or more links each only plausible, or the key rate is unmeasured. |
| 5-20 | Published data point the other way. |

Score the claim as stated. Judge the effect the title and prediction assert, under the conditions the prediction
itself states ("at fixed amine and temperature", "on light soils", "within 15 km downwind"). Do not add worlds the
hypothesis does not claim, and do not penalise a hypothesis because its test is a lab or calculation test when the
prediction is about that setting. Do add a step the headline needs but the prediction does not state (for example,
that the supply stays constant) only when the entry's own papers or web text give a reason to doubt it.

Links. List the steps between cause and outcome and give each a chance by what is known about it:
a link with a cited direct measurement or a conservation/physics identity counts about 90%; an established mechanism
without a direct measurement here counts about 75%; a plausible but unmeasured step counts about 55%; a speculative
step counts about 35%. Multiply only the links that are NOT already measured; a link that a cited paper shows holds
does not lower the score. Then round to the nearest anchor. Three plausible links (55% each) give about 17%, which
is below the table; use the 25-40 band as the floor for a chain whose every link has some support, and go below 25
only if a link is contradicted.

Competing mechanisms. If the entry's `papers` or `web` name a competing mechanism of comparable size, accurate is at
most 70. If a cited study in an analogous system found the opposite sign or no effect, accurate is at most 55; at
most 40 only if that study measured the same quantity in the same kind of setting. Competing mechanisms the scorer
merely imagines do not count; name them in `why` and leave the score alone.

Never move a score by less than 5 points on these rules alone; smaller moves are noise.

Do not compress toward 55. If you find yourself giving 50-58 to most hypotheses, you are scoring magnitude
or importance instead of direction. A hypothesis that says "near-certain by mass balance" and is right about that
scores 85-95 here even if the effect is small; a hypothesis with a clean idea but two balanced mechanisms scores 50.

## testable: chance the proposed test can be run and would settle the question

| score | anchor |
|---|---|
| 90-95 | Standard methods, one site, one season or less, and a stated falsification threshold. |
| 75-85 | Standard methods but needs several years, a special site, an archive or an existing long record. |
| 60-70 | Depends on a rare event or an instrument few groups have, or the falsification threshold is vague. |
| 40-55 | The test as written cannot distinguish the hypothesis from the obvious alternative. |
| 0-35 | Not falsifiable as stated. |

## impact: how much it would matter if it were true

Judge the consequence of a confirmed result, not the chance it is true. Do not let impact move novel, accurate or
testable.

| score | anchor |
|---|---|
| 85-95 | Would change a global budget or a major climate/food/water lever, or overturn a standard model assumption (a flux of several percent of a global total, or a practice applied at continental scale). |
| 65-80 | Changes understanding or practice for a whole biome, region or industry, or fixes a known bias in a widely used model. |
| 45-60 | Refines a mechanism within one field; useful to specialists. |
| 25-40 | Niche: a single system, a small flux, or a local practice. |
| 0-20 | A curiosity; no decision or model would change. |

## why

One sentence for the strength and one for the main risk, each concrete ("basalt is mid-grey, so on a dark Mollisol
the darkening may be under 0.02"). Say which mechanism could reverse the sign if you scored accuracy below 75.

## Process

1. Read the prediction and test. Open the hypothesis's own evidence links.
2. Count the literature with litgap or Europe PMC; read every joint title; web search the exact combination.
3. Fill status, untested, papers (3 closest, each with what it did and did not test) and web.
4. Score with the anchors above, then write why. Re-read the anchors before you type the numbers.
5. Keep ids and never invent a DOI; a paper without a DOI is listed with its title only.
