import { z } from "zod";
import { authed, body } from "@/server/http";
import { situationReply } from "@/server/coach";

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, z.object({ id: z.string().min(1).max(40), text: z.string().min(1).max(500) }));
  return situationReply(user.id, input.id, input.text);
});