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
  "scores": { "novel": 0-100, "accurate": 0-100, "testable": 0-100 },
  "why": "Strength: ... ; risk: ..."
}
```

`chance` (the total shown on the site) is computed by the site as the average of `novel` and `accurate`; do not
hand-set it. A hypothesis is listed when `testable >= 75` and both `novel` and `accurate` are `>= 50`.

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

Which claim is scored. Score the headline effect the title and prediction assert in the world (the field flux, the
soil, the ecosystem), not a physical identity that the proposed test merely restates. A lab calculation that must come
out as predicted (for example an acid-base ratio at fixed total amine) earns 85-95 only if the world effect follows
from it without another uncertain step; if the world claim needs the supply, the flux or the setting to cooperate,
score that step too and say so in `why`.

Chains. Count the links between cause and the predicted outcome and give each link a chance of holding. A chain is
about as likely as the product: three links each about 70% likely is about 35%, which is the 25-40 band, not 60-70.
A mechanism that is well measured but whose size is unmeasured still counts as holding for DIRECTION.

Competing mechanisms. If a named competing mechanism of comparable size exists, accurate is at most 70. If studies
in analogous systems (named in `papers` or `web`) found the opposite sign or no effect, accurate is at most 40.

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

## why

One sentence for the strength and one for the main risk, each concrete ("basalt is mid-grey, so on a dark Mollisol
the darkening may be under 0.02"). Say which mechanism could reverse the sign if you scored accuracy below 75.

## Text cut at 700 characters

Older hypotheses had their prediction or test cut mid-sentence by the site. If the text you are scoring ends
mid-sentence, say so in `why`, score only what is visible, and do not reward or penalise the missing failure
criterion beyond keeping `testable` at 60-70.

## Process

1. Read the prediction and test. Open the hypothesis's own evidence links.
2. Count the literature with litgap or Europe PMC; read every joint title; web search the exact combination.
3. Fill status, untested, papers (3 closest, each with what it did and did not test) and web.
4. Score with the anchors above, then write why. Re-read the anchors before you type the numbers.
5. Keep ids and never invent a DOI; a paper without a DOI is listed with its title only.
