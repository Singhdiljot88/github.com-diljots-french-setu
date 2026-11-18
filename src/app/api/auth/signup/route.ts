import { z } from "zod";
import { body, publicRoute, HttpError } from "@/server/http";
import { signUp } from "@/server/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = publicRoute(async ({ req }) => {
  const gate = rateLimit(`signup:${clientIp(req)}`, 8, 10 * 60_000);
  if (!gate.ok) throw new HttpError(429, "Too many new accounts from this network. Wait a few minutes. · इस नेटवर्क से बहुत खाते बने। कुछ मिनट रुकिए।");
  const { email, password } = await body(req, z.object({ email: z.string(), password: z.string().max(200) }));
  const r = await signUp(email, password);
  if ("error" in r) throw new HttpError(400, r.error!);
  return { ok: true };
});
