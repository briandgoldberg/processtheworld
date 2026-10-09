import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400, code?: string) => NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });

export async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const str = (v: unknown, max = 2000) => String(v ?? "").slice(0, max);
export const token = () => randomBytes(32).toString("hex");
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 320;

// Salted, so addresses can't be recovered by hashing the IPv4 space.
export function hashIp(req: Request): string | null {
  const secret = process.env.IP_HASH_SALT || process.env.PRISMA_ACCELERATE_URL;
  if (!secret) return null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`ptw-ip:${secret}:${ip}`).digest("hex").slice(0, 24);
}
