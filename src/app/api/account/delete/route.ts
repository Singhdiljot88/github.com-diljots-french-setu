import { z } from "zod";
import { authed, body } from "@/server/http";
import { deleteAccount } from "@/server/account";

export const POST = authed(async ({ req, user }) => {
  const b = await body(req, z.object({ confirm: z.string().max(20), password: z.string().max(200).optional() }));
  await deleteAccount(user.id, b);
  return { ok: true };
});
