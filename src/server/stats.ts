import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, mistakes, type Skill } from "@/db/schema";

export const SKILLS: Skill[] = ["listening", "reading", "speaking", "writing", "vocabulary", "grammar", "pronunciation"];

export type SkillStat = { skill: Skill; attempts: number; recentAccuracy: number | null; previousAccuracy: number | null };

/** Demonstrated performance per skill from scored attempts (last 30 vs the 30 before). */
export async function skillStats(userId: string): Promise<SkillStat[]> {
  const db = await getDb();
  const out: SkillStat[] = [];
  for (const skill of SKILLS) {
    const rows = await db.select({ correct: attempts.correct, score: attempts.score }).from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.skill, skill), sql`(${attempts.correct} is not null or ${attempts.score} is not null)`))
      .orderBy(desc(attempts.createdAt)).limit(60);
    const val = (r: { correct: boolean | null; score: number | null }) => r.score ?? (r.correct ? 1 : 0);
    const recent = rows.slice(0, 30), prev = rows.slice(30);
    const avg = (xs: typeof rows) => (xs.length >= 3 ? xs.reduce((s, r) => s + val(r), 0) / xs.length : null);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(attempts).where(and(eq(attempts.userId, userId), eq(attempts.skill, skill)));
    out.push({ skill, attempts: Number(n), recentAccuracy: avg(recent), previousAccuracy: avg(prev) });
  }
  return out;
}

export async function topMistakes(userId: string, limit = 5) {
  const db = await getDb();
  return db.select().from(mistakes).where(and(eq(mistakes.userId, userId), eq(mistakes.resolved, false)))
    .orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt)).limit(limit);
}

export async function mistakeCategoryCounts(userId: string) {
  const db = await getDb();
  return db.select({ category: mistakes.category, n: sql<number>`sum(${mistakes.occurrences})::int` }).from(mistakes)
    .where(and(eq(mistakes.userId, userId), eq(mistakes.resolved, false))).groupBy(mistakes.category);
}
