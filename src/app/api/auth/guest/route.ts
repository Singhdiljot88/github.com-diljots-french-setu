import crypto from "node:crypto";
import { HttpError, publicRoute } from "@/server/http";
import { signUp } from "@/server/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Creates a throw-away guest account so the app can be explored without registering. Progress persists in that account. */
export const POST = publicRoute(async ({ req }) => {
  const gate = rateLimit(`guest:${clientIp(req)}`, 8, 10 * 60_000);
  if (!gate.ok) throw new HttpError(429, "Too many guest sessions from this network. Wait a few minutes, or create an account. · इस नेटवर्क से बहुत मेहमान सत्र। कुछ मिनट रुकिए, या खाता बनाएँ।");
  const id = crypto.randomBytes(6).toString("hex");
  const r = await signUp(`guest-${id}@guest.french-setu.local`, crypto.randomBytes(24).toString("base64url"), true);
  if ("error" in r) throw new HttpError(503, "Could not start a guest session. Please try again. · मेहमान सत्र शुरू नहीं हो सका। फिर कोशिश करें।");
  return { ok: true };
});
