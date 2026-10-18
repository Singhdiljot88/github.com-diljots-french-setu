import "server-only";
import { and, between, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, checkpointReports, dayProgress, mistakes, mockAttempts, reviewCards, savedWords, speakingSessions, studyLog, writingDrafts, type Skill } from "@/db/schema";
import { CHECKPOINT_DAYS, PHASES } from "@/content/outline";
import { learnerState, type Profile } from "./learner";
import { SKILLS, skillStats, mistakeCategoryCounts } from "./stats";
import { vocabularyStats } from "./words";
import { attemptSummary } from "./exam";
import { addDays, diffDays } from "@/lib/dates";
import { courseEndDate } from "@/lib/schedule";
import { getLesson } from "./content";
import { scheduleInput } from "./learner";
import { CATEGORY_LABEL } from "@/lib/labels";

const scoreOf = (r: { correct: boolean | null; score: number | null }) => r.score ?? (r.correct ? 1 : 0);

/** Whole-course progress. Counts and accuracies from the learner's own practice only; no readiness or score predictions. */
export async function progressOverview(userId: string, profile: Profile) {
  const db = await getDb();
  const st = await learnerState(userId, profile);
  const completedDays = [...st.completed].sort((a, b) => a - b);
  const phases = PHASES.map((p) => ({ ...p, done: completedDays.filter((d) => d >= p.from && d <= p.to).length, total: p.to - p.from + 1 }));

  const since = addDays(st.today, -13);
  const daily = await db.select({ date: studyLog.localDate, m: sql<number>`sum(${studyLog.minutes})` }).from(studyLog)
    .where(and(eq(studyLog.userId, userId), gte(studyLog.localDate, since))).groupBy(studyLog.localDate);
  const byDate = new Map(daily.map((d) => [d.date, Math.round(Number(d.m))]));
  const last14 = Array.from({ length: 14 }, (_, i) => { const date = addDays(since, i); return { date, minutes: byDate.get(date) ?? 0 }; });
  const [tot] = await db.select({ m: sql<number>`coalesce(sum(${studyLog.minutes}), 0)`, days: sql<number>`count(distinct ${studyLog.localDate})::int` }).from(studyLog).where(eq(studyLog.userId, userId));

  const [w] = await db.select({ n: sql<number>`count(*)::int` }).from(writingDrafts).where(and(eq(writingDrafts.userId, userId), eq(writingDrafts.status, "submitted")));
  const [s] = await db.select({ n: sql<number>`count(*)::int` }).from(speakingSessions).where(eq(speakingSessions.userId, userId));
  const mocks = (await db.select().from(mockAttempts).where(eq(mockAttempts.userId, userId)).orderBy(desc(mockAttempts.createdAt)).limit(20)).map(attemptSummary);

  return {
    today: st.today, scheduledDay: st.scheduledDay, nextIncomplete: st.nextIncomplete, beforeStart: st.slot.beforeStart,
    completedCount: completedDays.length, phases, last14,
    totalMinutes: Math.round(Number(tot.m)), studyDays: Number(tot.days),
    skills: await skillStats(userId), vocab: await vocabularyStats(userId), mistakeCounts: await mistakeCategoryCounts(userId),
    writingSubmitted: Number(w.n), speakingSessions: Number(s.n), mocks,
    checkpoints: CHECKPOINT_DAYS.map((d) => ({ day: d, reached: st.completed.has(d) })),
  };
}

export type CheckpointReport = Awaited<ReturnType<typeof buildCheckpointReport>>;

/** Report for the 20 days that end at a checkpoint day. */
export async function buildCheckpointReport(userId: string, checkpoint: number, scheduledDay = 120) {
  const db = await getDb();
  const from = checkpoint - 19, to = checkpoint;
  const phase = PHASES.find((p) => p.to === checkpoint);
  const prog = await db.select().from(dayProgress).where(and(eq(dayProgress.userId, userId), between(dayProgress.day, from, to)));
  const completed = prog.filter((p) => p.status === "completed").map((p) => p.day).sort((a, b) => a - b);
  /** Days the plan has already reached but that are not done; future days are not "missing". */
  const missing = Array.from({ length: 20 }, (_, i) => from + i).filter((d) => d < scheduledDay && !completed.includes(d));
  const assessments = prog.filter((p) => p.assessmentScore !== null).map((p) => ({ day: p.day, score: p.assessmentScore! })).sort((a, b) => a.day - b.day);
  const checkpointScore = prog.find((p) => p.day === checkpoint)?.assessmentScore ?? null;

  // "Can do" only where the day's own check backs it up; finished days with a weak check are listed separately.
  const canDo: { day: number; en: string; hi: string; score: number }[] = [];
  const toRevisit: { day: number; en: string; hi: string; score: number }[] = [];
  for (const a of assessments) {
    const l = await getLesson(a.day);
    if (!l) continue;
    (a.score >= 0.7 ? canDo : toRevisit).push({ day: a.day, en: l.day.objective.en, hi: l.day.objective.hi, score: a.score });
  }

  const rows = await db.select({ skill: attempts.skill, correct: attempts.correct, score: attempts.score }).from(attempts)
    .where(and(eq(attempts.userId, userId), between(attempts.day, from, to), sql`(${attempts.correct} is not null or ${attempts.score} is not null)`));
  const skills = SKILLS.map((skill) => {
    const xs = rows.filter((r) => r.skill === skill);
    return { skill, attempts: xs.length, accuracy: xs.length >= 3 ? xs.reduce((a, r) => a + scoreOf(r), 0) / xs.length : null };
  }).filter((x) => x.attempts > 0);

  const dayRef = or(...Array.from({ length: 20 }, (_, i) => like(savedWords.sourceRef, `day:${from + i}`)));
  const [vocab] = await db.select({
    words: sql<number>`count(distinct ${savedWords.id})::int`,
    retained: sql<number>`count(distinct case when ${reviewCards.state} = 'review' and ${reviewCards.intervalDays} >= 7 then ${savedWords.id} end)::int`,
  }).from(savedWords).leftJoin(reviewCards, eq(reviewCards.savedWordId, savedWords.id)).where(and(eq(savedWords.userId, userId), dayRef));

  const mistakeRef = or(...Array.from({ length: 20 }, (_, i) => or(eq(mistakes.sourceRef, `day:${from + i}`), like(mistakes.sourceRef, `day:${from + i}:%`))));
  const ms = await db.select().from(mistakes).where(and(eq(mistakes.userId, userId), mistakeRef)).orderBy(desc(mistakes.occurrences)).limit(200);
  const mistakeByCategory: Record<string, { open: number; resolved: number }> = {};
  for (const m of ms) { mistakeByCategory[m.category] ??= { open: 0, resolved: 0 }; mistakeByCategory[m.category][m.resolved ? "resolved" : "open"] += m.occurrences; }

  const draftRef = or(...Array.from({ length: 20 }, (_, i) => eq(writingDrafts.taskRef, `day:${from + i}`)));
  const [wr] = await db.select({ n: sql<number>`count(*)::int` }).from(writingDrafts).where(and(eq(writingDrafts.userId, userId), eq(writingDrafts.status, "submitted"), draftRef));
  const spRef = or(...Array.from({ length: 20 }, (_, i) => eq(speakingSessions.scenarioRef, `day:${from + i}`)));
  const [sp] = await db.select({ n: sql<number>`count(*)::int` }).from(speakingSessions).where(and(eq(speakingSessions.userId, userId), spRef));

  return {
    checkpoint, from, to, phase: phase ? { en: phase.en, hi: phase.hi, phase: phase.phase } : null,
    completed, missing, assessments, checkpointScore, skills, canDo, toRevisit,
    vocab: { words: Number(vocab?.words ?? 0), retained: Number(vocab?.retained ?? 0) },
    topMistakes: ms.filter((m) => !m.resolved).slice(0, 6).map((m) => ({ id: m.id, category: m.category, original: m.original, corrected: m.corrected, occurrences: m.occurrences })),
    mistakeByCategory, writingSubmitted: Number(wr?.n ?? 0), speakingSessions: Number(sp?.n ?? 0),
    next: recommendations(skills, missing, Object.entries(mistakeByCategory).map(([c, v]) => ({ category: c, open: v.open }))),
    generatedAt: new Date().toISOString(),
  };
}

type Rec = { text: string; href: string };
const SKILL_HREF: Partial<Record<Skill, Rec>> = {
  listening: { text: "Listening was your weakest area here. Redo a few recordings in exam mode in the listening library.", href: "/listening" },
  reading: { text: "Reading was your weakest area here. Try texts from this phase in timed mode.", href: "/reading" },
  vocabulary: { text: "Vocabulary checks were the weakest. Clear your review queue every day this week.", href: "/review" },
  grammar: { text: "Grammar was the weakest. Drill the grammar items in your mistake notebook.", href: "/mistakes" },
  writing: { text: "Writing tasks were the weakest. Redo one lesson writing task from this phase with feedback.", href: "/writing" },
  speaking: { text: "Practise a role-play from this phase in the speaking tutor.", href: "/speaking" },
  pronunciation: { text: "Spend ten minutes on minimal pairs in the pronunciation lab.", href: "/pronunciation" },
};

/** Concrete next steps from the learner's own numbers. Plain rules, stated as suggestions. */
export function recommendations(skills: { skill: Skill; attempts: number; accuracy: number | null }[], missing: number[], mistakeCats: { category: string; open: number }[]): Rec[] {
  const out: Rec[] = [];
  if (missing.length) out.push({ text: `Catch up on the ${missing.length} day${missing.length === 1 ? "" : "s"} in this block that the plan has passed (${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}).`, href: `/lesson/${missing[0]}` });
  const scored = skills.filter((s) => s.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!);
  const weak = scored.filter((s) => s.accuracy! < 0.7).slice(0, 2);
  for (const w of weak) { const r = SKILL_HREF[w.skill]; if (r) out.push(r); }
  const topCat = [...mistakeCats].sort((a, b) => b.open - a.open)[0];
  if (topCat && topCat.open >= 3) out.push({ text: `Your most frequent open errors are ${(CATEGORY_LABEL[topCat.category]?.en ?? topCat.category).toLowerCase()} errors. Drill them in the mistake notebook.`, href: "/mistakes" });
  if (!skills.some((s) => s.skill === "speaking")) out.push({ text: "There is no speaking practice recorded in this block. Do one role-play.", href: "/speaking" });
  if (!out.length) out.push({ text: "No weak spots stand out in this block. Keep to the plan and take a practice exam section when you reach the next phase.", href: "/exam" });
  return out.slice(0, 5);
}

/** Whether the exam date or daily workload should be looked at again, from the plan's own dates. Never a readiness estimate. */
export function pacingNote(profile: Profile, today: string, nextIncomplete: number, scheduledDay: number) {
  const s = scheduleInput(profile);
  const end = courseEndDate(s);
  const behind = Math.max(0, scheduledDay - nextIncomplete);
  const notes: string[] = [];
  if (profile.examDate && diffDays(profile.examDate, end) > 0) notes.push(`At the current plan the course ends on ${end}, after your exam date (${profile.examDate}). Consider moving the exam date or adding daily study time in Settings.`);
  else if (profile.examDate) notes.push(`The course is planned to end on ${end}, ${diffDays(end, profile.examDate)} days before your exam date (${profile.examDate}).`);
  else notes.push(`The course is planned to end on ${end}. You have not set an exam date.`);
  if (behind >= 3) notes.push(`You are ${behind} lessons behind the plan. The recovery plan on Today can shift the schedule without losing finished work, or a shorter daily plan may suit you better.`);
  else if (diffDays(today, end) > 0) notes.push("Your pace matches the plan. No change to the workload looks necessary.");
  return notes;
}

/** Returns the saved snapshot for a reached checkpoint, saving one the first time it is viewed. Before then, a live report. */
export async function checkpointReport(userId: string, checkpoint: number, reached: boolean, scheduledDay: number) {
  const db = await getDb();
  const [saved] = await db.select().from(checkpointReports).where(and(eq(checkpointReports.userId, userId), eq(checkpointReports.day, checkpoint))).orderBy(desc(checkpointReports.createdAt)).limit(1);
  const live = await buildCheckpointReport(userId, checkpoint, scheduledDay);
  if (!reached) return { report: live, snapshot: null as null | { createdAt: Date; report: CheckpointReport } };
  if (!saved) {
    const [row] = await db.insert(checkpointReports).values({ userId, day: checkpoint, report: live }).returning();
    return { report: live, snapshot: { createdAt: row.createdAt, report: live } };
  }
  return { report: live, snapshot: { createdAt: saved.createdAt, report: saved.report as CheckpointReport } };
}
