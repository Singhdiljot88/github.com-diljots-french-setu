import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mistakes, type MistakeCategory, type Skill } from "@/db/schema";
import { checkAnswer } from "@/lib/text";
import { HttpError } from "./http";
import { recordAttempt } from "./progress";

export type Mistake = typeof mistakes.$inferSelect;

export const CATEGORY_SKILL: Record<MistakeCategory, Skill> = {
  grammar: "grammar", spelling: "writing", gender: "grammar", agreement: "grammar", tense: "grammar",
  vocabulary: "vocabulary", organization: "writing", comprehension: "reading", pronunciation: "pronunciation",
};

export async function listMistakes(userId: string) {
  const db = await getDb();
  return db.select().from(mistakes).where(eq(mistakes.userId, userId)).orderBy(desc(mistakes.lastSeenAt)).limit(1000);
}

async function load(userId: string, id: string) {
  const db = await getDb();
  const [m] = await db.select().from(mistakes).where(and(eq(mistakes.id, id), eq(mistakes.userId, userId)));
  if (!m) throw new HttpError(404, "Mistake not found");
  return m;
}

export async function setResolved(userId: string, id: string, resolved: boolean) {
  await load(userId, id);
  const db = await getDb();
  const [m] = await db.update(mistakes).set({ resolved }).where(and(eq(mistakes.id, id), eq(mistakes.userId, userId))).returning();
  return m;
}

export async function deleteMistake(userId: string, id: string) {
  await load(userId, id);
  const db = await getDb();
  await db.delete(mistakes).where(and(eq(mistakes.id, id), eq(mistakes.userId, userId)));
}

/** Checks a drill answer. A correct answer marks the mistake resolved; it comes back if the same error is made again. */
export async function answerDrill(userId: string, id: string, answer: string) {
  const m = await load(userId, id);
  const r = m.drill ? checkAnswer(answer, m.drill.answer, m.drill.accept ?? []) : checkAnswer(answer, m.corrected);
  const correct = r.result === "correct";
  await recordAttempt(userId, { kind: "mistake_drill", itemRef: `mistake:${m.id}`, skill: CATEGORY_SKILL[m.category], correct, score: correct ? 1 : r.result === "accent" ? 0.7 : 0, response: answer.slice(0, 500) });
  if (correct && !m.resolved) await setResolved(userId, id, true);
  return { ...r, resolved: correct || m.resolved };
}
