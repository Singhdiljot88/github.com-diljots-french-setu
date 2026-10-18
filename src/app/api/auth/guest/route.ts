import crypto from "node:crypto";
import { publicRoute } from "@/server/http";
import { signUp } from "@/server/auth";

/** Creates a throw-away guest account so the app can be explored without registering. Progress persists in that account. */
export const POST = publicRoute(async () => {
  const id = crypto.randomBytes(6).toString("hex");
  await signUp(`guest-${id}@guest.french-setu.local`, crypto.randomBytes(24).toString("base64url"), true);
  return { ok: true };
});
