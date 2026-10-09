import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// Public processes are published as is, so there are no suggested changes to vote on.
export async function POST() {
  return fail("Public processes are published as is, so there is nothing to vote on.", 403);
}
