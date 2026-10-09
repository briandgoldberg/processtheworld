import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Public processes are published as is: nothing is suggested or voted on.
export async function GET() {
  return json({ rule: "", proposals: [] });
}

export async function POST() {
  return fail("Public processes are published as is. Make your own copy to change it.", 403);
}
