import { prisma } from "./db";

// A one-time re-dating: the most interesting, most complex public processes,
// one or two per topic and interleaved so the top of "Newest" mixes subjects,
// get fresh publish dates so they lead the Newest sort. Each gets a fixed
// date, and a row is only moved forward, so this is safe to run on every
// server start and never pushes anything published later back down.
const FEATURED = [
  "cmv0jtheg0007jt06z1u22lln", // OpenAI's Navier–Stokes claim
  "cmv0kpddq0007jn06ld0drndf", // From script to opening weekend
  "cmv0ie1q40018jw06ksu339x2", // From lab idea to vaccine in your arm
  "cmv0kpicg001ljn06oe9ai8ve", // How a bill becomes a law
  "cmv0idz7h000jjw06rb65zt7m", // The life and death of a star
  "cmv0kppjs003jjn06e9er1os6", // How a chatbot like ChatGPT or Claude is made
  "cmv221wzv0002i206vktbi8q3", // How the Titanic sank
  "cmv0idxok0004jw06cbo8wrkv", // Photosynthesis
  "cmv0kq0wj001njv06zo9y4l2b", // The project lifecycle
  "cmv0kpctr0002jn06fmoqc7zx", // How a meme goes viral
  "cmv0kphv8001gjn06igb11klu", // The GameStop short squeeze
  "cmv0idzq1000ojw06ogp8w0pn", // DNA replication
  "cmv0kpfuo000wjn066lu72ags", // How a news story gets verified
  "cmv0kped8000hjn06lk9xumba", // The Hero's Journey
  "cmv0h78cf0004l6060tc1op1h", // Your Immune System vs. a Cold Virus
  "cmv0ieik30063jw06g3kqv75s", // A day of work
  "cmv0ie6sn002mjw06hu8ksavl", // Create a quote customers actually say yes to
  "cmv0idy750009jw06828pjkbz", // The water cycle
  "cmv0idyqj000ejw069tnhayei", // How a lightning bolt is born
  "cmv221zlf000mi206mjr5jlqr", // How the 2008 financial crisis happened
];
const TOP = Date.UTC(2026, 9, 11, 17, 15); // Oct 11 2026, 10:15 a.m. Pacific
let once: Promise<void> | null = null;

export function featureNewestOnce() {
  once ??= (async () => {
    for (const [i, id] of FEATURED.entries()) {
      const at = new Date(TOP - i * 3 * 60e3); // three minutes apart, first listed is newest
      await prisma.publicProcess.updateMany({ where: { id, publishedAt: { lt: at } }, data: { publishedAt: at } });
    }
  })().catch(e => { console.error("featureNewest", e); once = null; });
  return once;
}
