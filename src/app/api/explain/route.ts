import { z } from "zod";
import { authed, body } from "@/server/http";
import { explainSentence } from "@/server/coach";

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, z.object({
    fr: z.string().min(1).max(500),
    en: z.string().max(400).optional(),
    hi: z.string().max(400).optional(),
    context: z.string().max(300).optional(),
  }));
  return explainSentence(user.id, input);
});
