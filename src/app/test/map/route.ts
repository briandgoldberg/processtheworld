export const dynamic = "force-static";

export function GET(req: Request) {
  return Response.redirect(new URL("/test/map/p0", req.url), 307);
}
