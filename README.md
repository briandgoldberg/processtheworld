# forks.world

A system that learns how to understand processes.

People explain, demonstrate, record or upload everyday processes. AI turns that input into structured, drillable process maps. A community validates, corrects and improves those maps, and every interaction becomes training data for getting better at understanding processes.

**Vision:** once the learning loop is proven, apply it to the enterprise: AI interviews employees, observes how work is actually done, and keeps a living representation of how the organization operates. The processes change. The intelligence doesn't.

## The app

A Next.js app (same stack as WaitingForPower: Next.js, Prisma, Postgres, Resend, Vercel). The mapper UI lives in `src/studio/studio.js`; the server owns the engine prompts (`src/lib/engine/prompts.ts`) and calls Claude (`ANTHROPIC_MODEL`, default Haiku 5.5).

- **Login like WaitingForPower:** every browser gets a random key and an anonymous handle (e.g. "BoldPathfinder42"). Adding an email (magic link) keeps maps across devices; an emailed sign-in link restores them on a new device and moves anything made there anonymously into the account. Hashed IPs are used only for rate limits.
- **Private, shared, public.** Share a process by username or email ("Can edit" / "Can view"); email invites sign people up when accepted. Saves carry a revision, so two editors can't overwrite each other.
- **Public processes, decided by consensus.** Anyone can "Suggest changes" (a draft tied to the version it started from) and submit it with a note. Others compare before and after (differences listed and marked on the map) and vote "Before is better" / "After is better". A change goes live when "after" leads by 2 (the author counts as one); it's turned down when "before" leads by 2 (`src/lib/consensus.ts`). Every version is kept; every vote is stored as a preference pair for training.
- **Usernames:** explorer-themed handles by default, changeable in the account menu, unique ignoring case.
- **Feedback, kept quiet:** hover thumbs on replies, "Skip this question", one finish rating per map, one check-in per browser, and an always-available Feedback box in the bottom-right corner that captures what's on screen.
- **Admin dashboard (`/admin`):** only for the verified email briandgoldberg@gmail.com (fixed in code). Overview metrics, feedback inbox, every session with its transcript, AI changes and actions, product suggestions (seeded from review, plus "Suggest changes from recent data"), and a JSONL training export.
- **Training database** (`prisma/schema.prisma`): every turn with the map before and after, every AI change with before/after and the human verdict, every interview question and its information gain, every self-check, every AI call (prompt, output, tokens, cost), and all feedback, tagged with the engine version.

Setup: see `.env.example`.

## Prototype (prototype/)

`prototype/index.html` is a single-page prototype that runs as a Claude artifact (it uses the artifact runtime for AI calls, identity and storage, so it does not run standalone in a browser).

- **Sign in → Library.** *My processes* are private (with delete); *Examples* open read-only and become a private copy when changed. Public processes are parked for now.
- **Live mapping.** Describe a process in the conversation panel. The AI streams changes to the map one operation at a time and asks one follow-up question per turn.
- **Swim lanes.** Lanes are typed: **People** (roles / user types) and **Technology** (systems and tools). A person using a tool shows the tool as a chip on the step; a system acting on its own gets a step in its own lane.
- **Drill-down.** Any step can be a subprocess with its own map, lanes and steps, nested to any depth. Breadcrumbs move between layers.
- **Links between layers.** A step can jump to a step in any other layer (e.g. "new scope → back to Gather requirements in the main flow"). A subprocess's end step continues after its parent step automatically.
- **Self-checks.** After every AI turn the system checks the map (unconnected steps, dead ends, unlabeled decision outcomes, duplicate lanes, empty subprocesses) and runs one repair pass before you see it. Anything left shows as "to check".
- **Nothing you've seen is deleted silently.** AI removals of existing steps are proposed, marked on the map, and wait for Remove / Keep.
- **Done state.** "Finish map" (or saying you're done) stops the questions and shows a summary; "Resume interview" re-opens it.
- **Edit your last message.** Editing, or sending a near-copy (a retyped typo), rewinds the last turn instead of stacking a new instruction.
- **Learning signal.** Every AI change, every self-check, every human edit, every Remove/Keep decision, and a classification of each chat message (new info, answer, correction by category, confusion, done) is logged on the process as an event.

## Data model

```
Process   { id, title, visibility: private|public, status: interviewing|done, ownerId, updatedAt, maps{}, chat[], events[], undo }
Map       { id, title, parent: {map, step} | null, lanes[], steps[] }      // "m_root" is the top level
Lane      { id, name, type: person|system }
Step      { id, lane, label, kind: start|task|decision|subprocess|end, uses[laneId], next[{to, label, map?}], child?, proposedRemove? }   // next.map = link to another layer
Event     { t, who: ai|human|system, op, map, id, ...detail }                // the training signal
```

The AI edits the model through a small operation language (`add_lane`, `add_step`, `update_step`, `connect`, `add_map`, …), one JSON object per line, so changes render live as they stream. The operation log is the raw material for learning what the AI missed.

## Next

- Voice and video capture (the artifact sandbox blocks the microphone today; device dictation works).
- Validation queue and rewards for corrections that hold up with other validators.
- Variants: keep disagreements as alternative paths instead of forcing one answer.
- Move from the artifact runtime to a standalone app (auth, database, model API).
