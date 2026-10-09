import { randomBytes } from "crypto";
import { getOrCreateUser } from "./identity";
import { hashIp } from "./http";
import { limited } from "./rateLimit";

/** Make a brand-new guest account for an agent that has no key yet. Returns null when this network is making too many. */
export async function newGuest(req: Request) {
  const ip = hashIp(req);
  if (await limited("identity_create", ip, null, 30, 1000)) return null;
  const key = randomBytes(24).toString("hex");
  const user = await getOrCreateUser(key, ip);
  return { user, key };
}
