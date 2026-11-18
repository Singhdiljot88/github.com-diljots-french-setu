import { z } from "zod";
import { authed, body, HttpError } from "@/server/http";
import { claimGuest } from "@/server/auth";

/** Guest keeps the same account (and all progress) by adding an email and password. */
export const POST = authed(async ({ req, user }) => {
  const { email, password } = await body(req, z.object({ email: z.string(), password: z.string().max(200) }));
  const r = await claimGuest(user.id, email, password);
  if ("error" in r) throw new HttpError(400, r.error!);
  return { ok: true };
});
