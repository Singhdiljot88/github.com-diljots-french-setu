import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { savedWords, webResources } from "@/db/schema";
import { getProfile } from "../auth";
import { learnerState } from "../learner";
import { HttpError } from "../http";
import { aiProvider } from "../providers/config";
import { AiUnavailable, aiLesson, ruleLesson, type WebLesson } from "./lesson";

export async function learnerLevel(userId: string) {
  const p = await getProfile(userId);
  if (!p) return "A1";
  const d = (await learnerState(userId, p)).todayDay;
  return d <= 30 ? "A1" : d <= 60 ? "A2" : d <= 90 ? "B1" : "B2";
}

export type SourceIn = { origin: "search" | "url" | "pasted"; url?: string | null; title: string; publisher?: string | null; publishedAt?: string | null; text: string };

export async function buildAndSave(userId: string, src: SourceIn, useAi: boolean) {
  const level = await learnerLevel(userId);
  const db = await getDb();
  const saved = new Set((await db.select({ fr: savedWords.fr }).from(savedWords).where(eq(savedWords.userId, userId))).map((w) => w.fr.toLowerCase()));
  let lesson: WebLesson = await ruleLesson(src.text, level, saved);
  let note: string | undefined;
  if (useAi && aiProvider() !== "demo") {
    try { lesson = await aiLesson(userId, src.text, level, lesson); } catch (e) { if (!(e instanceof AiUnavailable)) throw e; note = `${e.message} Showing the rule-based study kit instead.`; }
  }
  // Only a short excerpt is stored; the full text stays with the publisher (the link is kept).
  const [row] = await db.insert(webResources).values({
    userId, url: src.url ?? null, title: src.title.slice(0, 200), publisher: src.publisher ?? null, publishedAt: src.publishedAt ?? null,
    excerpt: src.text.slice(0, src.origin === "pasted" ? 4000 : 600), origin: src.origin, difficultyEstimate: lesson.estimate.level, lesson, lessonProvider: lesson.provider,
  }).returning();
  return { id: row.id, lesson, note, level };
}

export async function savedResources(userId: string) {
  const db = await getDb();
  return db.select({ id: webResources.id, title: webResources.title, url: webResources.url, publisher: webResources.publisher, origin: webResources.origin, difficultyEstimate: webResources.difficultyEstimate, retrievedAt: webResources.retrievedAt })
    .from(webResources).where(eq(webResources.userId, userId)).orderBy(desc(webResources.retrievedAt)).limit(50);
}

export async function savedResource(userId: string, id: string) {
  const db = await getDb();
  const [r] = await db.select().from(webResources).where(and(eq(webResources.id, id), eq(webResources.userId, userId)));
  if (!r) throw new HttpError(404, "Not found");
  return r;
}
