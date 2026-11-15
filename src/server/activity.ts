import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, studyLog } from "@/db/schema";
import { addDays, localDate } from "@/lib/dates";

export type ActivityDay = { date: string; minutes: number; answers: number };
export type ActivitySummary = {
  days: ActivityDay[];
  /** Consecutive study days ending today, or ending yesterday if nothing is logged yet today. */
  streak: number;
  bestStreak: number;
  studiedToday: boolean;
  activeDays: number;
};

/** Pure: builds the streak and heatmap from per-day totals. Exported for tests. */
export function summarise(today: string, totals: Map<string, { minutes: number; answers: number }>, span = 84): ActivitySummary {
  const days: ActivityDay[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const t = totals.get(date);
    days.push({ date, minutes: Math.round(t?.minutes ?? 0), answers: t?.answers ?? 0 });
  }
  const active = (d: string) => { const t = totals.get(d); return !!t && (t.minutes > 0 || t.answers > 0); };
  const studiedToday = active(today);
  let streak = 0;
  for (let d = studiedToday ? today : addDays(today, -1); active(d); d = addDays(d, -1)) streak++;
  let best = 0, run = 0;
  const sorted = [...totals.keys()].filter(active).sort();
  let prev: string | null = null;
  for (const d of sorted) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return { days, streak, bestStreak: Math.max(best, streak), studiedToday, activeDays: days.filter((d) => d.minutes > 0 || d.answers > 0).length };
}

export async function activitySummary(userId: string, timezone: string, now = new Date()): Promise<ActivitySummary> {
  const db = await getDb();
  const today = localDate(timezone, now);
  const since = addDays(today, -400);
  const totals = new Map<string, { minutes: number; answers: number }>();
  const bump = (d: string, m: number, a: number) => { const t = totals.get(d) ?? { minutes: 0, answers: 0 }; t.minutes += m; t.answers += a; totals.set(d, t); };
  const logs = await db.select({ d: studyLog.localDate, m: studyLog.minutes }).from(studyLog).where(and(eq(studyLog.userId, userId), gte(studyLog.localDate, since)));
  for (const l of logs) bump(l.d, Number(l.m), 0);
  const sinceTs = new Date(Date.parse(`${since}T00:00:00Z`));
  const ans = await db.select({ at: attempts.createdAt }).from(attempts).where(and(eq(attempts.userId, userId), gte(attempts.createdAt, sinceTs)));
  for (const a of ans) bump(localDate(timezone, a.at), 0, 1);
  return summarise(today, totals);
}
