import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { body, fail, hashIp, json, str } from "@/lib/http";
import { userFrom } from "@/lib/identity";
import { limited } from "@/lib/rateLimit";
import { thumbBytes, validThumb } from "@/lib/thumb";
import { artDataUrl } from "@/lib/art";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Set or remove the thumbnail of one of your processes. It becomes the picture on
// its preview card and in shared links.
//   { "image": "data:image/jpeg;base64,..." }   your own picture (PNG, JPEG or WebP, up to 300 KB)
//   { "art": { "emoji": "🧬", "hue": 280 } }    a generated gradient with an emoji
//   { "remove": true }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return fail("Reload the page to continue.", 401);
  if (await limited("thumbnail", hashIp(req), user.id, 300, 600)) return fail("Too many changes. Try again later.", 429);
  const p = await prisma.process.findUnique({ where: { id }, include: { public: { select: { id: true } } } });
  if (!p || p.userId !== user.id) return fail("Not found.", 404);
  const b = await body(req);
  let thumb: string | null = null;
  if (b?.remove === true) thumb = null;
  else if (typeof b?.image === "string") {
    thumb = validThumb(b.image);
    if (!thumb) return fail("Use a PNG, JPEG or WebP image under 300 KB.");
  } else if (b?.art && typeof b.art === "object") {
    const a = b.art as Record<string, unknown>;
    thumb = await artDataUrl(str(a.emoji, 16), Number(a.hue));
  } else return fail("Send image, art or remove.");
  const doc = { ...(p.doc as Record<string, unknown>) };
  if (thumb) doc.thumb = thumb; else delete doc.thumb;
  await prisma.process.update({ where: { id }, data: { doc: doc as any } });
  if (p.public) await prisma.publicProcess.update({ where: { id: p.public.id }, data: { thumb, hasThumb: !!thumb } });
  return json({ ok: true, hasThumb: !!thumb });
}

// The picture of one of your own (or a process shared with you) as an image. Needs your key, so the app fetches it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await userFrom(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const p = await prisma.process.findUnique({ where: { id }, select: { userId: true, doc: true, shares: { where: { userId: user.id, acceptedAt: { not: null } }, select: { id: true } } } });
  if (!p || (p.userId !== user.id && !p.shares.length)) return new Response("Not found", { status: 404 });
  const t = typeof (p.doc as any)?.thumb === "string" ? thumbBytes((p.doc as any).thumb) : null;
  if (!t) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(t.bytes), { headers: { "content-type": t.type, "cache-control": "private, max-age=300" } });
}
