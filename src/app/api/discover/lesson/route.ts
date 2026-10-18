import { z } from "zod";
import { authed, body, HttpError } from "@/server/http";
import { frenchScore } from "@/server/web/extract";
import { buildAndSave } from "@/server/web/service";

export const POST = authed(async ({ req, user }) => {
  const b = await body(req, z.object({
    origin: z.enum(["search", "url", "pasted"]), url: z.string().url().max(2000).nullable().optional(), title: z.string().min(1).max(200),
    publisher: z.string().max(100).nullable().optional(), publishedAt: z.string().max(40).nullable().optional(), text: z.string().min(80).max(12000), useAi: z.boolean().default(true),
  }));
  if (frenchScore(b.text) < 0.08) throw new HttpError(422, "This text doesn't look like French. Choose a French text.");
  return buildAndSave(user.id, b, b.useAi);
});
