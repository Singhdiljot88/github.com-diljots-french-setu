import { z } from "zod";
import { body, publicRoute, HttpError } from "@/server/http";
import { signIn } from "@/server/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = publicRoute(async ({ req }) => {
  const { email, password } = await body(req, z.object({ email: z.string(), password: z.string().max(200) }));
  const gate = rateLimit(`signin:${clientIp(req)}:${email.trim().toLowerCase()}`, 10, 10 * 60_000);
  if (!gate.ok) throw new HttpError(429, "Too many sign-in tries. Wait a few minutes. · बहुत कोशिशें हो गईं। कुछ मिनट रुकिए।");
  const r = await signIn(email, password);
  if ("error" in r) throw new HttpError(401, r.error!);
  return { ok: true };
});
