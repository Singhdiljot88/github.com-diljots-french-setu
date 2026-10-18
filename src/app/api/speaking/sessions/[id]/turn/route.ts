import { z } from "zod";
import { authed, body } from "@/server/http";
import { takeTurn } from "@/server/speaking";

export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ text: z.string().trim().min(1).max(1500), via: z.enum(["typed", "speech_browser", "speech_server"]).default("typed") }));
  return takeTurn(user.id, params.id, b.text, b.via);
});
