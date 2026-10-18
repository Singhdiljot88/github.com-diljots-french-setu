import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { dayProgress, profiles, studyLog } from "@/db/schema";
import { localDate } from "@/lib/dates";
import { recoveryPlan, slotForDate, type DailyMinutes, type Pace, type ScheduleInput } from "@/lib/schedule";

export type Profile = typeof profiles.$inferSelect;

export function scheduleInput(p: Profile): ScheduleInput {
  return { startDate: p.startDate, dailyMinutes: p.dailyMinutes as DailyMinutes, pace: p.pace as Pace, scheduleShiftDays: p.scheduleShiftDays, placementDay: p.placementDay, examDate: p.examDate };
}

export async function learnerState(userId: string, profile: Profile, now = new Date()) {
  const db = await getDb();
  const today = localDate(profile.timezone, now);
  const s = scheduleInput(profile);
  const slot = slotForDate(s, today);
  const progress = await db.select().from(dayProgress).where(eq(dayProgress.userId, userId));
  const completed = new Set(progress.filter((p) => p.status === "completed").map((p) => p.day));
  let nextIncomplete = profile.placementDay;
  while (completed.has(nextIncomplete) && nextIncomplete <= 120) nextIncomplete++;
  const scheduledDay = slot.courseDay;
  const todayDay = slot.beforeStart ? profile.placementDay : nextIncomplete <= scheduledDay ? nextIncomplete : scheduledDay;
  const [mins] = await db.select({ m: sql<number>`coalesce(sum(${studyLog.minutes}), 0)` }).from(studyLog).where(and(eq(studyLog.userId, userId), eq(studyLog.localDate, today)));
  return {
    today,
    slot,
    scheduledDay,
    todayDay: Math.min(120, todayDay),
    nextIncomplete: Math.min(121, nextIncomplete),
    completed,
    progress,
    aheadOfSchedule: nextIncomplete > scheduledDay && !slot.beforeStart,
    recovery: recoveryPlan(s, today, nextIncomplete),
    minutesToday: Number(mins?.m ?? 0),
  };
}
