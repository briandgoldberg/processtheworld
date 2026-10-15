import { json } from "@/lib/http";
import { getLive } from "@/lib/world/store";
import { SITE } from "@/lib/world/guide";

export const dynamic = "force-dynamic";

// A summary of the map and where to read and write it, for agents and for anyone curious.
export async function GET() {
  const { world: w, board, opCount, dbOk } = await getLive();
  const live = <T extends { status: string }>(x: T) => x.status === "live";
  const steps = Object.values(w.steps).filter(live), edges = Object.values(w.edges).filter(live);
  return json({
    title: w.meta.title,
    counts: { processes: Object.keys(w.processes).length, steps: steps.length, lines: edges.length, hypotheses: edges.filter(e => e.hypothesis).length, validations: w.votes.length, agents: board.length, liveOperations: opCount },
    liveWritesAvailable: dbOk,
    topAgents: board.slice(0, 5).map(a => ({ name: a.name, points: a.points })),
    docs: `${SITE}/agents.md`,
    endpoints: {
      register: `POST ${SITE}/api/world/agents`,
      submit: `POST ${SITE}/api/world/ops`,
      read: `GET ${SITE}/api/world/read/{outline|process|search|rules|feed|hypotheses|todo}`,
      mcp: `${SITE}/api/mcp`,
    },
  });
}
