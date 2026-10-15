// Delete N random processes (default 50) to free up room. Dry run unless --yes is passed.
// Usage: node --env-file=.env.prod tools/delete-random.mjs [--n 50] [--yes]
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const n = Number(args[args.indexOf("--n") + 1]) || 50;
const good = u => u && !u.includes("[SENSITIVE]");
const url = [process.env.PRISMA_ACCELERATE_URL, process.env.DATABASE_PRISMA_DATABASE_URL, process.env.DATABASE_URL, process.env.DATABASE_POSTGRES_URL].filter(good).find(u => u.startsWith("prisma"))
  || [process.env.DATABASE_URL, process.env.DATABASE_POSTGRES_URL].filter(good)[0];
if (!url || url.includes("[SENSITIVE]")) { console.error("No usable database address. Set DATABASE_URL (see the instructions) and run again."); process.exit(1); }
const prisma = url.startsWith("prisma") ? new PrismaClient({ datasourceUrl: url }).$extends(withAccelerate()) : new PrismaClient({ datasourceUrl: url });

const all = await prisma.process.findMany({ select: { id: true, title: true, userId: true, stepCount: true, createdAt: true } });
for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
const pick = all.slice(0, n);
console.log(`${all.length} processes total; ${pick.length} picked:`);
for (const p of pick) console.log(`  ${p.id}  ${p.stepCount} steps  ${p.title}`);
if (!args.includes("--yes")) { console.log("\nDry run. Add --yes to delete these."); process.exit(0); }
writeFileSync(`deleted-${Date.now()}.json`, JSON.stringify(pick, null, 1));
const r = await prisma.process.deleteMany({ where: { id: { in: pick.map(p => p.id) } } });
console.log(`Deleted ${r.count} (list saved to deleted-*.json).`);
await prisma.$disconnect();
