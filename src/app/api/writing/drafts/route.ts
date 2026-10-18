import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { writingDrafts } from "@/db/schema";
import { authed, body } from "@/server/http";
import { deadline, getOrCreateDraft } from "@/server/writing";

export const GET = authed(async ({ req, user }) => {
  const taskRef = new URL(req.url).searchParams.get("taskRef");
  const db = await getDb();
  const drafts = await db.select().from(writingDrafts).where(taskRef ? and(eq(writingDrafts.userId, user.id), eq(writingDrafts.taskRef, taskRef)) : eq(writingDrafts.userId, user.id)).orderBy(desc(writingDrafts.updatedAt)).limit(100);
  return { drafts };
});

export const POST = authed(async ({ req, user }) => {
  const o = await body(req, z.object({ taskType: z.string().max(40), taskRef: z.string().max(200), mode: z.enum(["learn", "practice", "exam"]), timeLimitSec: z.number().int().min(60).max(7200).nullable().optional() }));
  const d = await getOrCreateDraft(user.id, o);
  return { draft: d, deadline: deadline(d)?.toISOString() ?? null, serverNow: new Date().toISOString() };
});
