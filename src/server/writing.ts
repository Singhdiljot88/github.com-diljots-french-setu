import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { writingDrafts, writingFeedback, writingRevisions } from "@/db/schema";
import { wordCount } from "@/lib/text";
import { HttpError } from "./http";

const REVISION_EVERY_MS = 2 * 60_000;
const GRACE_MS = 5_000;

export type Draft = typeof writingDrafts.$inferSelect;

export async function getOrCreateDraft(userId: string, o: { taskType: string; taskRef: string; mode: "learn" | "practice" | "exam"; timeLimitSec?: number | null }) {
  const db = await getDb();
  const [existing] = await db.select().from(writingDrafts)
    .where(and(eq(writingDrafts.userId, userId), eq(writingDrafts.taskRef, o.taskRef), eq(writingDrafts.mode, o.mode)))
    .orderBy(desc(writingDrafts.updatedAt)).limit(1);
  if (existing) return finalizeIfExpired(existing);
  const [d] = await db.insert(writingDrafts).values({
    userId, taskType: o.taskType, taskRef: o.taskRef, mode: o.mode,
    timeLimitSec: o.timeLimitSec ?? null, timerStartedAt: o.timeLimitSec ? new Date() : null,
  }).returning();
  return d;
}

export function deadline(d: Draft): Date | null {
  return d.timerStartedAt && d.timeLimitSec ? new Date(d.timerStartedAt.getTime() + d.timeLimitSec * 1000) : null;
}

/** A timed draft past its deadline is submitted automatically with whatever was last saved. */
export async function finalizeIfExpired(d: Draft): Promise<Draft> {
  const dl = deadline(d);
  if (d.status === "draft" && dl && Date.now() > dl.getTime() + GRACE_MS) {
    const db = await getDb();
    const [u] = await db.update(writingDrafts).set({ status: "submitted", updatedAt: new Date() }).where(eq(writingDrafts.id, d.id)).returning();
    await db.insert(writingRevisions).values({ draftId: d.id, userId: d.userId, text: d.text, reason: "submit" });
    return u;
  }
  return d;
}

export async function loadDraft(userId: string, id: string) {
  const db = await getDb();
  const [d] = await db.select().from(writingDrafts).where(and(eq(writingDrafts.id, id), eq(writingDrafts.userId, userId)));
  if (!d) throw new HttpError(404, "Draft not found");
  return finalizeIfExpired(d);
}

export async function saveDraft(userId: string, id: string, text: string, reason: "autosave" | "manual") {
  const d = await loadDraft(userId, id);
  if (d.status === "submitted") throw new HttpError(409, "This text has been submitted. Start a new attempt to keep editing.");
  const dl = deadline(d);
  if (dl && Date.now() > dl.getTime() + GRACE_MS) throw new HttpError(409, "Time is up — the text was submitted.");
  const db = await getDb();
  const now = new Date();
  const [u] = await db.update(writingDrafts).set({ text, wordCount: wordCount(text), updatedAt: now }).where(eq(writingDrafts.id, d.id)).returning();
  const [lastRev] = await db.select().from(writingRevisions).where(eq(writingRevisions.draftId, d.id)).orderBy(desc(writingRevisions.createdAt)).limit(1);
  if (reason === "manual" || !lastRev || now.getTime() - lastRev.createdAt.getTime() > REVISION_EVERY_MS) {
    if (!lastRev || lastRev.text !== text) await db.insert(writingRevisions).values({ draftId: d.id, userId, text, reason });
  }
  return u;
}

export async function submitDraft(userId: string, id: string, text?: string) {
  let d = await loadDraft(userId, id);
  if (d.status === "draft" && text !== undefined) {
    const dl = deadline(d);
    if (!dl || Date.now() <= dl.getTime() + GRACE_MS) d = await saveDraft(userId, id, text, "manual");
  }
  const db = await getDb();
  if (d.status === "draft") {
    [d] = await db.update(writingDrafts).set({ status: "submitted", updatedAt: new Date() }).where(eq(writingDrafts.id, d.id)).returning();
  }
  const [rev] = await db.insert(writingRevisions).values({ draftId: d.id, userId, text: d.text, reason: "submit" }).returning();
  return { draft: d, revisionId: rev.id };
}

/** Start a fresh attempt from a submitted text (for "study corrections, then retry"). */
export async function retryDraft(userId: string, id: string, startText?: string) {
  const d = await loadDraft(userId, id);
  const db = await getDb();
  const [n] = await db.insert(writingDrafts).values({ userId, taskType: d.taskType, taskRef: d.taskRef, mode: d.mode === "exam" ? "practice" : d.mode, text: startText ?? d.text, wordCount: wordCount(startText ?? d.text) }).returning();
  await db.insert(writingRevisions).values({ draftId: n.id, userId, text: n.text, reason: "retry" });
  return n;
}

export async function draftHistory(userId: string, id: string) {
  const db = await getDb();
  await loadDraft(userId, id);
  const revisions = await db.select().from(writingRevisions).where(and(eq(writingRevisions.draftId, id), eq(writingRevisions.userId, userId))).orderBy(desc(writingRevisions.createdAt)).limit(50);
  const feedback = await db.select().from(writingFeedback).where(and(eq(writingFeedback.draftId, id), eq(writingFeedback.userId, userId))).orderBy(desc(writingFeedback.createdAt));
  return { revisions, feedback };
}
