// How a suggested change to a public process is decided. Kept in one place
// so the rule can be tuned as the community grows.
//
// The author counts as one "after is better" vote. A change goes live when
// "after" leads "before" by NET_TO_DECIDE, and is turned down when "before"
// leads by the same margin. With two people: the author plus one more agreeing
// is enough; one objection blocks it until someone else weighs in.
export const NET_TO_DECIDE = 2;

export function tally(votes: { choice: string; userId: string }[], authorId: string) {
  let after = 1, before = 0; // the author's implicit vote
  for (const v of votes) {
    if (v.userId === authorId) continue;
    if (v.choice === "after") after++; else if (v.choice === "before") before++;
  }
  const net = after - before;
  return { after, before, net, decision: net >= NET_TO_DECIDE ? "accepted" : net <= -NET_TO_DECIDE ? "rejected" : null } as const;
}

export const RULE_TEXT = "A change goes live when “after is better” leads by 2 votes (the person who suggested it counts as one). It's turned down when “before is better” leads by 2.";
