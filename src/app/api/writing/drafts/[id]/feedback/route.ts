import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { writingFeedback, writingRevisions } from "@/db/schema";
import { authed, body, HttpError } from "@/server/http";
import { loadDraft } from "@/server/writing";
import { writingFeedbackFor } from "@/server/writing-feedback";

export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ prompt: z.string().max(2000).default(""), minWords: z.number().int().min(0).max(1000).optional(), useAi: z.boolean().default(true) }));
  const d = await loadDraft(user.id, params.id);
  if (d.status !== "submitted") throw new HttpError(409, "Submit the text first, then ask for feedback.");
  if (!d.text.trim()) throw new HttpError(400, "There is no text to check.");
  const env = await writingFeedbackFor(user.id, { text: d.text, prompt: b.prompt, minWords: b.minWords, taskType: d.taskType, taskRef: d.taskRef, useAi: b.useAi });
  const db = await getDb();
  const [rev] = await db.select({ id: writingRevisions.id }).from(writingRevisions).where(and(eq(writingRevisions.draftId, d.id), eq(writingRevisions.userId, user.id))).orderBy(desc(writingRevisions.createdAt)).limit(1);
  await db.insert(writingFeedback).values({ draftId: d.id, userId: user.id, revisionId: rev?.id ?? null, provider: env.provider, isDemo: env.isDemo, feedback: env });
  return env;
});
