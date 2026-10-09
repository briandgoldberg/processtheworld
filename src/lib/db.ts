import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Like WaitingForPower: when PRISMA_ACCELERATE_URL is set (from the Prisma
// Console, "Open in Prisma" on Vercel's Storage tab), the app goes through
// Prisma Accelerate so serverless instances can't exhaust database
// connections. Until then it uses DATABASE_URL directly with a small pool.
function createClient(): PrismaClient {
  const accel = process.env.PRISMA_ACCELERATE_URL;
  if (accel) return new PrismaClient({ datasourceUrl: accel }).$extends(withAccelerate()) as unknown as PrismaClient;
  const url = process.env.DATABASE_URL;
  const capped = url && !/connection_limit=/.test(url) ? url + (url.includes("?") ? "&" : "?") + "connection_limit=3" : url;
  return new PrismaClient(capped ? { datasourceUrl: capped } : undefined);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
