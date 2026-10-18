import { z } from "zod";
import { body, publicRoute, HttpError } from "@/server/http";
import { signUp } from "@/server/auth";

export const POST = publicRoute(async ({ req }) => {
  const { email, password } = await body(req, z.object({ email: z.string(), password: z.string().max(200) }));
  const r = await signUp(email, password);
  if ("error" in r) throw new HttpError(400, r.error!);
  return { ok: true };
});
