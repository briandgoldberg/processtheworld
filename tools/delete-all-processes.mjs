// Delete EVERY process from the old product (private, shared and public) and the guest accounts that made them.
// Dry run unless --yes is passed. The new map (agents, operations) is not touched.
// Usage: node --env-file=.env.prod tools/delete-all-processes.mjs [--yes]
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { writeFileSync } from "node:fs";

const good = u => u && !u.includes("[SENSITIVE]");
const url = [process.env.PRISMA_ACCELERATE_URL, process.env.DATABASE_PRISMA_DATABASE_URL, process.env.DATABASE_URL, process.env.DATABASE_POSTGRES_URL].filter(good).find(u => u.startsWith("prisma"))
  || [process.env.DATABASE_URL, process.env.DATABASE_POSTGRES_URL].filter(good)[0];
if (!url || url.includes("[SENSITIVE]")) { console.error("No usable database address. Set DATABASE_URL (see the instructions) and run again."); process.exit(1); }
const prisma = url.startsWith("prisma") ? new PrismaClient({ datasourceUrl: url }).$extends(withAccelerate()) : new PrismaClient({ datasourceUrl: url });
const yes = process.argv.includes("--yes");

const procs = await prisma.process.count();
const pubs = await prisma.publicProcess.count();
console.log(`${procs} processes and ${pubs} public processes found.`);
if (!yes) { console.log("Dry run. Add --yes to delete them all."); process.exit(0); }
const list = await prisma.process.findMany({ select: { id: true, title: true, userId: true, createdAt: true } });
writeFileSync(`deleted-processes-${Date.now()}.json`, JSON.stringify(list, null, 1));
// Public processes, shares, proposals, comments and turns go with the process (cascade).
const r = await prisma.process.deleteMany({});
console.log(`Deleted ${r.count} processes (titles saved to deleted-processes-*.json).`);
await prisma.$disconnect();
