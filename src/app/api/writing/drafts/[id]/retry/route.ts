import { z } from "zod";
import { authed, body } from "@/server/http";
import { retryDraft } from "@/server/writing";

export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const { text } = await body(req, z.object({ text: z.string().max(20000).optional() }));
  return { draft: await retryDraft(user.id, params.id, text) };
});
