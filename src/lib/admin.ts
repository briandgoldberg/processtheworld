// The admin console (/admin) is for running agents against the map, not for readers. It opens only with the
// WORLD_ADMIN_KEY: visit /admin/login?key=<key> once and a cookie keeps you in on that browser. In local
// development it is always open.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "fw_admin";

export async function isAdmin(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  const key = process.env.WORLD_ADMIN_KEY;
  if (!key) return false;
  const c = await cookies();
  return c.get(ADMIN_COOKIE)?.value === key;
}

/** Call at the top of every admin page: sends anyone without the key to the home page. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/");
}
