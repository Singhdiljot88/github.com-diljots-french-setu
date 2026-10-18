import "server-only";
import { eq, like } from "drizzle-orm";
import { getDb } from "@/db";
import * as t from "@/db/schema";
import { destroySession, verifyPassword } from "./auth";
import { HttpError } from "./http";

/** Every table that holds a learner's own data, keyed by its user_id column. */
const USER_TABLES = {
  profile: t.profiles, dayProgress: t.dayProgress, studyLog: t.studyLog, attempts: t.attempts,
  savedWords: t.savedWords, reviewCards: t.reviewCards, reviewLogs: t.reviewLogs,
  writingDrafts: t.writingDrafts, writingRevisions: t.writingRevisions, writingFeedback: t.writingFeedback,
  speakingSessions: t.speakingSessions, mistakes: t.mistakes, mockAttempts: t.mockAttempts,
  checkpointReports: t.checkpointReports, webResources: t.webResources, contentReports: t.contentReports, aiUsage: t.aiUsage,
} as const;

/** Everything stored about the learner, as JSON. Audio recordings are listed without their audio bytes. */
export async function exportUserData(userId: string) {
  const db = await getDb();
  const [u] = await db.select({ id: t.users.id, email: t.users.email, isGuest: t.users.isGuest, createdAt: t.users.createdAt }).from(t.users).where(eq(t.users.id, userId));
  const data: Record<string, unknown> = {};
  for (const [name, table] of Object.entries(USER_TABLES)) {
    data[name] = await db.select().from(table).where(eq(table.userId, userId));
  }
  data.recordings = await db.select({ id: t.recordings.id, kind: t.recordings.kind, ref: t.recordings.ref, mime: t.recordings.mime, createdAt: t.recordings.createdAt }).from(t.recordings).where(eq(t.recordings.userId, userId));
  return {
    format: "french-setu-export", version: 1, exportedAt: new Date().toISOString(),
    notes: [
      "Your password is not included (only a one-way hash is stored, and it is left out).",
      "Recordings are listed without audio. Download them individually from Settings before deleting your account if you want them.",
    ],
    account: u, ...data,
  };
}

/** Deletes the account and, through cascading foreign keys, every row that belongs to it. */
export async function deleteAccount(userId: string, o: { confirm: string; password?: string }) {
  const db = await getDb();
  const [u] = await db.select().from(t.users).where(eq(t.users.id, userId));
  if (!u) throw new HttpError(404, "Account not found");
  if (o.confirm.trim().toLowerCase() !== "delete") throw new HttpError(400, "Type DELETE to confirm.");
  if (!u.isGuest && !(o.password && (await verifyPassword(o.password, u.passwordHash)))) throw new HttpError(403, "The password is not correct.");
  await db.delete(t.aiCache).where(like(t.aiCache.key, `u:${userId}:%`));
  await db.delete(t.users).where(eq(t.users.id, userId));
  await destroySession();
}
