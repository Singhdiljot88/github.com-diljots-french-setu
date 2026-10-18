import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, dayProgress, mistakes, studyLog, type MistakeCategory, type Skill } from "@/db/schema";
import { CURRICULUM_VERSION } from "@/content/load";
import type { AssessmentQ, Day, Mcq } from "@/content/schema";
import { localDate } from "@/lib/dates";
import { checkAnswer } from "@/lib/text";
import { BLOCK_ORDER, type BlockKey } from "@/lib/schedule";
import { getLesson } from "./content";
import { HttpError } from "./http";
import { saveWord } from "./words";
import type { Profile } from "./learner";

export async function ensureDayRow(userId: string, day: number) {
  const db = await getDb();
  await db.insert(dayProgress).values({ userId, day, curriculumVersion: CURRICULUM_VERSION }).onConflictDoNothing();
  const [row] = await db.select().from(dayProgress).where(and(eq(dayProgress.userId, userId), eq(dayProgress.day, day)));
  return row;
}

/** Blocks that count towards completing a lesson (writing has 0 minutes in the 45-minute compact plan but is still offered). */
export function requiredBlocks(): BlockKey[] { return BLOCK_ORDER; }

export async function completeBlock(userId: string, profile: Profile, day: number, block: BlockKey, minutes: number) {
  const lesson = await getLesson(day);
  if (!lesson) throw new HttpError(404, "Lesson not found");
  const db = await getDb();
  const row = await ensureDayRow(userId, day);
  const activities = { ...row.activities, [block]: true };
  const allDone = requiredBlocks().every((b) => activities[b]);
  await db.update(dayProgress).set({
    activities,
    status: allDone ? "completed" : row.status,
    completedAt: allDone && !row.completedAt ? new Date() : row.completedAt,
  }).where(and(eq(dayProgress.userId, userId), eq(dayProgress.day, day)));
  if (minutes > 0) await db.insert(studyLog).values({ userId, localDate: localDate(profile.timezone), activity: `day${day}:${block}`, minutes: Math.min(240, minutes) });
  if (block === "learn") await addLessonVocabulary(userId, lesson.day);
  return { activities, completed: allDone };
}

/** Puts a lesson's vocabulary and phrases into spaced review (idempotent). */
export async function addLessonVocabulary(userId: string, d: Day) {
  for (const v of d.vocabulary) {
    await saveWord(userId, { fr: v.fr, en: v.en, hi: v.hi, gender: v.gender, isPhrase: v.pos === "phrase", source: "lesson", sourceRef: `day:${d.day}` });
  }
  for (const p of d.phrases) {
    await saveWord(userId, { fr: p.fr, en: p.en, hi: p.hi, isPhrase: true, source: "lesson", sourceRef: `day:${d.day}` });
  }
}

export async function logMinutes(userId: string, profile: Profile, activity: string, minutes: number) {
  const db = await getDb();
  if (minutes <= 0) return;
  await db.insert(studyLog).values({ userId, localDate: localDate(profile.timezone), activity, minutes: Math.min(240, minutes) });
}

export async function recordAttempt(userId: string, a: { day?: number | null; kind: string; itemRef: string; skill: Skill; correct?: boolean | null; score?: number | null; response?: unknown }) {
  const db = await getDb();
  await db.insert(attempts).values({ userId, day: a.day ?? null, kind: a.kind, itemRef: a.itemRef, skill: a.skill, correct: a.correct ?? null, score: a.score ?? null, response: a.response ?? null, contentVersion: CURRICULUM_VERSION });
}

export async function addMistake(userId: string, m: { category: MistakeCategory; source: string; sourceRef?: string; original: string; corrected: string; explanation: { en: string; hi?: string }; drill?: { prompt: string; answer: string; accept?: string[] } | null }) {
  const db = await getDb();
  const [existing] = await db.select().from(mistakes).where(and(eq(mistakes.userId, userId), eq(mistakes.category, m.category), eq(mistakes.original, m.original), eq(mistakes.corrected, m.corrected)));
  if (existing) {
    await db.update(mistakes).set({ occurrences: sql`${mistakes.occurrences} + 1`, lastSeenAt: new Date(), resolved: false }).where(eq(mistakes.id, existing.id));
    return existing.id;
  }
  const [r] = await db.insert(mistakes).values({ userId, ...m, drill: m.drill ?? null }).returning({ id: mistakes.id });
  return r.id;
}

/** Comprehension question answered → attempt + (if wrong) a review exercise in the mistake notebook. */
export async function answerQuestion(userId: string, d: Day, section: "listening" | "reading", index: number, choice: number) {
  const q: Mcq | undefined = d[section].questions[index];
  if (!q) throw new HttpError(404, "Question not found");
  const correct = q.answer === choice;
  const ref = `day:${d.day}:${section}:${index}`;
  await recordAttempt(userId, { day: d.day, kind: section, itemRef: ref, skill: section, correct, response: { choice } });
  if (!correct) {
    await addMistake(userId, {
      category: "comprehension", source: section, sourceRef: ref,
      original: `${q.q.fr ?? q.q.en} → ${q.options[choice] ?? "?"}`,
      corrected: q.options[q.answer],
      explanation: q.explanation,
      drill: { prompt: `${q.q.fr ?? q.q.en}\n${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}${q.evidence ? `\n(Hint: “${q.evidence}”)` : ""}`, answer: String.fromCharCode(65 + q.answer), accept: [q.options[q.answer]] },
    });
  }
  return { correct, answer: q.answer, explanation: q.explanation, evidence: q.evidence };
}

export function gradeQuestion(q: AssessmentQ, response: unknown): { result: "correct" | "accent" | "wrong"; expected: string } {
  switch (q.type) {
    case "mcq": return { result: Number(response) === q.answer ? "correct" : "wrong", expected: q.options[q.answer] };
    case "fill": return checkAnswer(String(response ?? ""), q.answer, q.accept);
    case "translate": return checkAnswer(String(response ?? ""), q.answer, q.accept);
    case "reorder": return checkAnswer(String(response ?? ""), q.answer, []);
  }
}

const categoryFor = (q: AssessmentQ): MistakeCategory => (q.type === "translate" ? "vocabulary" : q.type === "reorder" ? "grammar" : q.type === "fill" ? "grammar" : "grammar");

export async function gradeAssessment(userId: string, day: number, responses: unknown[]) {
  const lesson = await getLesson(day);
  if (!lesson) throw new HttpError(404, "Lesson not found");
  const qs = lesson.day.assessment;
  const results = qs.map((q, i) => ({ ...gradeQuestion(q, responses[i]), explanation: q.explanation }));
  const points = results.reduce((s, r) => s + (r.result === "correct" ? 1 : r.result === "accent" ? 0.5 : 0), 0);
  const score = qs.length ? points / qs.length : 0;
  for (const [i, r] of results.entries()) {
    const q = qs[i];
    await recordAttempt(userId, { day, kind: "assessment", itemRef: `day:${day}:assessment:${i}`, skill: q.type === "translate" ? "vocabulary" : "grammar", correct: r.result === "correct", score: r.result === "correct" ? 1 : r.result === "accent" ? 0.5 : 0, response: responses[i] ?? null });
    if (r.result !== "correct") {
      const given = q.type === "mcq" ? q.options[Number(responses[i])] ?? "(no answer)" : String(responses[i] ?? "") || "(no answer)";
      await addMistake(userId, {
        category: r.result === "accent" ? "spelling" : categoryFor(q), source: "assessment", sourceRef: `day:${day}:assessment:${i}`,
        original: given, corrected: r.expected, explanation: q.explanation,
        drill: q.type === "mcq" ? null : { prompt: q.type === "fill" ? q.sentence : q.type === "translate" ? q.source.en : q.words.join(" / "), answer: r.expected, accept: "accept" in q ? q.accept : [] },
      });
    }
  }
  const db = await getDb();
  await ensureDayRow(userId, day);
  await db.update(dayProgress).set({ assessmentScore: score }).where(and(eq(dayProgress.userId, userId), eq(dayProgress.day, day)));
  return { score, results };
}
