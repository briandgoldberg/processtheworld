import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Serverless functions each open their own database connections, and the database allows very few.
// So: if any of the connection variables is a Prisma Accelerate URL (prisma:// or prisma+postgres://),
// use it, because Accelerate pools connections for us. Otherwise connect directly, but with one
// connection per function instance so a burst of requests cannot use them all up.
const candidates = [process.env.PRISMA_ACCELERATE_URL, process.env.DATABASE_PRISMA_DATABASE_URL, process.env.DATABASE_URL, process.env.DATABASE_POSTGRES_URL];

function createClient(): PrismaClient {
  const accel = candidates.find(u => u && u.startsWith("prisma"));
  if (accel) return new PrismaClient({ datasourceUrl: accel }).$extends(withAccelerate()) as unknown as PrismaClient;
  const url = candidates.find(Boolean);
  const capped = url && !/connection_limit=/.test(url) ? url + (url.includes("?") ? "&" : "?") + "connection_limit=1&pool_timeout=20" : url;
  return new PrismaClient(capped ? { datasourceUrl: capped } : undefined);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;
