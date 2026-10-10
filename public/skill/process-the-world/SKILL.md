---
name: process-the-world
description: Interview the user about how something gets done, then build and publish a swim-lane process map on forks.world. Use when the user wants to map, document or write up a process, workflow or SOP, or mentions forks.world.
---

# forks.world process mapping

Interview the person, build a swim-lane map as they talk, then save it to forks.world. This costs the person no credits.

## Interview
- One question per turn. Start open: which process do you want to map first?
- Use their words and their roles. Do not invent roles. After each answer say in one short sentence what you added.
- Ask about the biggest gap: the order, who does it, what goes wrong, which tools. Never repeat a question.
- Every decision needs an arrow for every answer, including the no, with real detail on what happens next.
- Ask where it hurts: which steps are slow, error prone, manual or costly. Mark those as pain points.
- If a step has parts, make it a layer. Keep labels to 2 to 5 words. Never show ids to the person.
- Stop when they say they are done, then check the map.

## Reuse first
Search before drawing: `GET https://processtheworld.vercel.app/api/public?q=<words>` (connector: `list_public`). If something fits:
- Link it: give a step `"link": "<publicId>"`.
- Combine several in order: `POST /api/agent/combine` with `{"title":"...","parts":["<id>","<id>"],"publish":true}` (connector: `combine_processes`).
- Copy one to change: `POST /api/public/{id}/fork`.
Tell the person what you reused.

## Format
```json
{"title":"Onboard a customer","tags":["sales"],"thumbnailArt":{"emoji":"👋","hue":200},
 "lanes":[{"id":"rep","name":"Sales rep","type":"person"},{"id":"crm","name":"Salesforce","type":"system"}],
 "steps":[
  {"id":"s1","lane":"rep","kind":"start","label":"Deal closes","next":["s2"]},
  {"id":"s2","lane":"rep","label":"Create account","uses":["crm"],"pain":{"level":2,"note":"typed in twice"},"next":["s3"]},
  {"id":"s3","lane":"rep","kind":"decision","label":"Contract signed?","next":[{"to":"s4","label":"Yes"},{"to":"s2","label":"No, revise"}]},
  {"id":"s4","lane":"rep","kind":"end","label":"Customer active"}],
 "layers":[{"id":"acct","title":"Create account","parentStep":"s2","lanes":[{"id":"r2","name":"Sales rep","type":"person"}],
   "steps":[{"id":"a1","lane":"r2","kind":"start","label":"Open Salesforce","next":["a2"]},{"id":"a2","lane":"r2","kind":"end","label":"Saved"}]}]}
```
- Lane type is `person` (a role) or `system` (software, device). A person using a tool: the step is in the person lane and `uses` lists the tool lane.
- `kind`: start, task, decision, subprocess, end. `next`: ids, or `{to,label}`. Ids start with a letter. Step ids are unique per layer.
- `pain` level 1 annoying, 2 painful, 3 critical. `tags`: up to 8 short lowercase words.

## Check before saving
Every step except a start has a way in. Every step except an end leads somewhere. Every decision outcome is labeled. No empty layers.

## Save
1. Simplest: `POST https://processtheworld.vercel.app/api/agent/quick` with the map JSON. It signs up a guest, saves, publishes and returns `publicUrl`, `flowUrl` and a `key`. If you can only open links, use `GET /api/agent/quick?json=<url-encoded map>`. Connector: `save_process`.
2. To save to the person's own account, ask for their key (Connect my AI page, Copy my key) and send it as the `x-ptw-key` header to `POST /api/agent/processes`.
3. Publish only if they say yes (`"publish": true`). Leave it out to keep it private.
4. To change a saved map, send the same body with its `id`.
5. Export: `GET /api/public/{publicId}/export?format=md|html|skill|gpt`, or `/api/processes/{id}/export` with the key.

Full API: https://processtheworld.vercel.app/agents.md
