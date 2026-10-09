import { prisma } from "./db";

// The starting list, from reviewing the first real test session (the
// Salesforce implementation map, 2026-10-08) and the feedback-loop plan.
export const SEED_SUGGESTIONS = [
  { title: "Turn finished sessions into replay tests", body: "Replay each finished conversation against a new engine version and score how close it gets to the map the person kept. Start with the Salesforce session. Ship prompt or model changes only when they score better." },
  { title: "Track how far the AI draft is from the final map", body: "For each finished process, measure the difference between the map after the AI's turns and the map the person finished with (steps added, removed, renamed, moved, links changed). It is the clearest single measure of mapping quality." },
  { title: "Ask what starts the process early", body: "The first session ended with no starting step in either layer. Make the interviewer ask what triggers the process in its first or second question." },
  { title: "Confirm the technology question lands", body: "The first session captured no technology even though it was a software migration. The engine now asks about tools when none are captured; check the share of finished maps with at least one technology lane." },
  { title: "Pull in similar validated maps", body: "When a new process resembles a finished one (e.g. omelette vs. fried egg), put that map and its best-performing questions into the prompt. Improves with every session and needs no model training." },
  { title: "Reward corrections that hold up", body: "When community review returns, score contributors on corrections other people agree with, not on edit volume, so the training data stays clean." },
  { title: "Check the terms on training with model output", body: "Human corrections and confirmed maps are yours. Before training an in-house model, have someone confirm what the AI provider's terms allow for model-generated text." },
  { title: "Add voice capture", body: "Outside the Claude artifact the browser microphone works. Record, transcribe, and send the transcript as the message; keep the audio only with consent." },
];

export async function ensureSeeded() {
  if ((await prisma.suggestion.count()) > 0) return;
  await prisma.suggestion.createMany({ data: SEED_SUGGESTIONS.map(s => ({ ...s, source: "analysis" })) });
}
