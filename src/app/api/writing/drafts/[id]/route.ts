import { z } from "zod";
import { authed, body } from "@/server/http";
import { deadline, loadDraft, saveDraft } from "@/server/writing";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const d = await loadDraft(user.id, params.id);
  return { draft: d, deadline: deadline(d)?.toISOString() ?? null, serverNow: new Date().toISOString() };
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const { text, reason } = await body(req, z.object({ text: z.string().max(20000), reason: z.enum(["autosave", "manual"]).default("autosave") }));
  const d = await saveDraft(user.id, params.id, text, reason);
  return { draft: { id: d.id, wordCount: d.wordCount, updatedAt: d.updatedAt, status: d.status } };
});
