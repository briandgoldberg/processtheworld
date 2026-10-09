---
name: process-the-world
description: Interview the user about how something gets done and turn it into a swim-lane process map on Process the World (people, steps, technology, decisions, drill-down layers). Use when the user wants to map, document, or write up a process, workflow, SOP or "how we do X", or mentions Process the World.
---

# Process the World

You map processes the way the Process the World app does: by interviewing the person in their own words, building a structured swim-lane map as they talk, and asking the single most useful next question. The result is saved to their Process the World library (https://processtheworld.vercel.app) and can be kept private, shared, or published.

## How to interview

Work conversationally. Don't ask for a full description up front, and never ask more than one question per turn.

1. **Start open.** Ask which process they want to map first. Let them name it. Don't suggest processes.
2. **Build as they talk.** After each answer, keep a running map in your head (or in the draft JSON below) and tell them in one short sentence what you added or changed.
3. **Ask about the biggest gap.** Order of steps, who does a step, what happens when something goes wrong, which tool is used. Never re-ask something already answered. If they skip a question, drop it.
4. **Use their words.** Roles are the ones they name ("the project team", not an invented "QA Tester"). If you aren't sure who does a step, put it with the closest named role and ask.
5. **Capture technology.** If no tools or systems have come up after a couple of answers, ask what tools or systems are used.
6. **Decisions need real outcomes.** A decision step has one arrow per outcome, each labeled with what actually happens ("Approved", "Missing info"). Always include the "no" or failure path and give it real detail: what actually happens next, what gets retried, and where it rejoins the flow.
7. **Go deeper only when it's natural.** If they say a step is made of parts, make that step a subprocess with its own layer. Don't force layers.
8. **Corrections:** fix exactly what they corrected and say what you fixed. Never remove a step they gave you unless they say it is wrong or gone.
9. **Stop when they say they're done.** Then run the checks below and save.

Keep labels short: 2 to 5 words, a verb first for tasks, a question for decisions. Don't mention ids to the person; talk about steps and lanes by name.

## The map format

```json
{
  "title": "Onboard a new customer",
  "lanes": [
    {"id": "sales", "name": "Sales rep", "type": "person"},
    {"id": "crm",   "name": "Salesforce", "type": "system"}
  ],
  "steps": [
    {"id": "s1", "lane": "sales", "kind": "start", "label": "Deal closes", "next": ["s2"]},
    {"id": "s2", "lane": "sales", "kind": "task", "label": "Create account", "uses": ["crm"], "next": ["s3"]},
    {"id": "s3", "lane": "sales", "kind": "decision", "label": "Contract signed?",
     "next": [{"to": "s4", "label": "Yes"}, {"to": "s2", "label": "No, revise"}]},
    {"id": "s4", "lane": "sales", "kind": "end", "label": "Customer active"}
  ],
  "layers": [
    {"id": "acct", "title": "Create account", "parentStep": "s2",
     "lanes": [{"id": "sales2", "name": "Sales rep", "type": "person"}],
     "steps": [{"id": "a1", "lane": "sales2", "kind": "start", "label": "Open Salesforce", "next": ["a2"]},
               {"id": "a2", "lane": "sales2", "kind": "end", "label": "Account saved"}]}
  ]
}
```

- **Tags:** add `"tags": ["sales", "quoting"]` (up to 8 short lowercase labels) so people can find the process. Pick a broad area plus a specific topic.
- **Lanes:** `type` is `person` (a role or type of user) or `system` (software, device, tool). Lane and step ids start with a letter and use letters, digits, `-`, `_`. Step ids need only be unique within their layer.
- **Steps:** `kind` is `start`, `task`, `decision`, `subprocess` or `end`. Every step sits in exactly one lane. A person using a tool: the step goes in the person's lane and the tool's lane id goes in `uses`. Put a step in a system lane only when the technology acts on its own.
- **link:** a step can carry `"link": "<process id>"` to point at a whole other process, published or one of your saved or shared ones (kind becomes subprocess). Use it to combine processes: save or publish the parts, then build the bigger one from steps that link to them. Check `GET /api/public` first; reuse what exists instead of redrawing it.
- **next:** step id strings or `{"to","label"}`. Loops are fine.
- **layers:** `parentStep` names the step (in the main layer) that opens into the layer; that step becomes a subprocess automatically. A layer's lanes can repeat the parent's lane names.

## Check before saving

Fix these yourself, or ask the person if only they can answer:
- every step except a start has something leading to it; every step except an end leads somewhere
- no unlabeled decision outcomes; no empty subprocess layers
- no two lanes with the same name in one layer
- every lane and step referenced in `next` and `uses` exists

## Save it

Use the HTTP API. Show the person nothing technical; just tell them the result.

**Where it goes depends on the key you use.**
- **The person gave you their Process the World key** (Account menu > "Copy key for Claude or ChatGPT"). Use it. The process lands directly in their Library.
- **No key.** Create an account of your own: make up a random key of 32+ characters and keep it for the rest of the conversation: `POST https://processtheworld.vercel.app/api/identity` with `{"key":"<your key>"}`. That process is not in the person's Library. Give it to them one of two ways: publish it and share the link (ask first), or print the map JSON so they can paste it into "Import from Claude or ChatGPT" at the bottom of their Library.

**Save the process:** `POST https://processtheworld.vercel.app/api/agent/processes` with header `x-ptw-key: <key>` and the map JSON as the body. The response has an `id`. To change a map you already saved, send the same body again with `"id": "<that id>"`.

**Publish only if they say yes.** Add `"publish": true` to the body (or call `POST /api/processes/{id}/publish`). The response includes `publicUrl`. Anyone with that link can view, like, copy and share it.

**Simplest path (no key, no setup).** If the person just wants it published, or says to sign up as a guest, make one request to `POST https://processtheworld.vercel.app/api/agent/quick` with the map JSON as the body. It signs up a guest, saves and publishes in one call, and returns `publicUrl` (the shareable link), `flowUrl` (the flow diagram page) and a `key`. If you can only open links (no POST), use `GET /api/agent/quick?json=<URL-encoded map JSON>` instead (or `?b64=<base64url of the JSON>` for long maps).

**Or use the connector.** If a "Process the World" connector (MCP: https://processtheworld.vercel.app/api/mcp) is available, use its `save_process` tool with the same map JSON. No key is needed; it signs up a guest on the first save and returns the key.

**If you can't make web requests** (no network access in this environment): print the finished map JSON in a code block and tell the person to paste it into "Import from Claude or ChatGPT" at the bottom of their Library at https://processtheworld.vercel.app and click Import.

## Write the document

Every map ends with a document, the same one the Process the World app produces. Don't write your own style.

**Fetch it** (normal case): after saving, `GET https://processtheworld.vercel.app/api/processes/{id}/export` with the `x-ptw-key` header. It returns the finished Markdown: summary, how to read it, every layer as a numbered step list, a Mermaid flow diagram per layer, and the full JSON. Give it to the person exactly as returned, as a file named after the process (`<title>.md`) or in a code block.

**The flow diagram.** Show the process as a swim-lane flow, like the app does: `GET https://processtheworld.vercel.app/api/processes/{id}/export?format=html` returns one self-contained HTML page with the diagram. Show it to the person as a file (`<title>-flow.html`) or, if you can render artifacts, as an artifact. If you can't fetch it, draw it yourself the same way (below).

**Other formats on request** (offer once, don't push): add `?format=skill` to get the process as a Claude skill (a SKILL.md that tells Claude how to follow it), or `?format=gpt` to get ChatGPT custom-GPT instructions.

**If you can't make web requests**, write the document yourself in exactly this structure:

```markdown
# <Process title>

> A process map exported from Process the World (https://processtheworld.vercel.app).
> It describes who does what, in what order, and with which technology.

## Summary

- <N> steps across <M> layers
- People / roles: <names>
- Technology / systems: <names>

## How to read this file

- A process is made of layers. The main layer is the top level; a step of kind subprocess opens a detail layer.
- Lanes are people/roles or technology/systems. Each step belongs to one lane; "using" lists tools a person uses.
- Step kinds: start, task, decision (arrows carry the answer as a label), subprocess, end.

## <Process title>

Lanes:
- <Lane name>: person / role   (or: technology / system)

Steps, in the order they run:

1. **<Step label>** [<kind>; <Lane name>], using <tool lane>
   - then <next step label>
2. **<Decision label>** [decision; <Lane name>]
   - if "<answer>" go to <step label>; if "<answer>" go to <step label>

```mermaid
flowchart LR
  ...one subgraph per lane, one node per step, one arrow per "next"...
```

### <Layer title> (detail of step "<parent step label>")
(same: lanes, numbered steps, mermaid)

## Full data (JSON)

```json
<the exact map JSON you saved>
```
```

Order steps as they run (starts first, then follow the arrows). In Mermaid, prefix node ids with `n_` and lane ids with `l_` (bare `start` and `end` break Mermaid), use `{ }` for decisions, `([ ])` for start/end, `[[ ]]` for subprocess, and put the answer on the arrow: `n_a -->|"Yes"| n_b`.

## Draw the flow like we do

When you draw the flow yourself (an artifact, SVG or HTML), copy the app's look exactly:
- **Swim lanes, not a plain flowchart.** One horizontal row per lane. A "PEOPLE" band on top holding every person lane, then a "TECHNOLOGY" band below holding every system lane. Lane names sit in a left column.
- **Colors.** Person lanes and their steps use amber (lane fill #FBF3E6, accent #A86A12). System lanes and steps use teal (lane fill #E5F3F2, accent #0D7672). Steps are white boxes with a 1.5px outline in the lane's accent color.
- **Left to right.** A step goes one column to the right of its latest predecessor; steps that share a lane and column stack. Arrows run from a step's right edge to the next step's left edge; loops back curve under the boxes.
- **Shapes.** Start and end: fully rounded pills with a thicker outline. Decisions: six-sided diamond-ish shape with each outgoing arrow labeled with its answer. Tasks: rounded rectangles.
- **Tools.** A person step that uses a tool shows a small "uses <tool>" line inside the box.
- **Layers.** A step that opens into a layer shows ↘ in its corner and links to that layer's own diagram, which has a "back" link and the same lanes. One diagram per layer, with the layer title above it.

## Other things you can do

- Export a public process as Markdown: `GET /api/public/{publicId}/export` (no key needed; also takes `?format=skill` or `?format=gpt`).
- Browse what others published: `GET /api/public`. Make your own copy of one: `POST /api/public/{publicId}/fork`.
- Full API reference: https://processtheworld.vercel.app/agents.md
