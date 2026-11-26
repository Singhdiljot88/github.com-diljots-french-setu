import "server-only";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { dayProgress, milestones } from "@/db/schema";
import { milestoneDef, newlyEarned, type MilestoneDef } from "@/lib/milestones";
import { AiUnavailable, generateJson } from "./ai";
import { activitySummary } from "./activity";
import { aiProvider } from "./providers/config";
import { highestNclc } from "./evaluation";

const Note = z.object({ en: z.string().min(1).max(280), hi: z.string().max(280) });

export type Unlocked = MilestoneDef & { note: { en: string; hi: string }; unlockedAt: string; fresh?: boolean };

function canned(def: MilestoneDef): { en: string; hi: string } {
  return {
    en: `${def.en}. You showed up and did the work. Keep the next session short and finish it.`,
    hi: `${def.hi}। आप आए और काम किया। अगला अभ्यास छोटा रखिए और उसे पूरा कीजिए।`,
  };
}

async function noteFor(userId: string, def: MilestoneDef) {
  if (aiProvider() === "demo") return canned(def);
  try {
    const r = await generateJson("milestone_note", userId, {
      system: "Write one warm, short congratulations for an adult learning French, in English and simple Hindi (Devanagari). No scores, no official exam claims, two sentences at most.",
      prompt: `Milestone: ${def.en}`,
      schema: Note,
      maxTokens: 400,
      effort: "low",
    });
    return r.data;
  } catch (e) {
    if (!(e instanceof AiUnavailable)) throw e;
    return canned(def);
  }
}

export async function syncMilestones(userId: string, timezone: string): Promise<{ all: Unlocked[]; fresh: Unlocked[] }> {
  const db = await getDb();
  const progress = await db.select({ day: dayProgress.day, status: dayProgress.status, score: dayProgress.assessmentScore }).from(dayProgress).where(eq(dayProgress.userId, userId));
  const saved = await db.select().from(milestones).where(eq(milestones.userId, userId));
  const activity = await activitySummary(userId, timezone);
  const input = {
    completedDays: progress.filter((p) => p.status === "completed").map((p) => p.day),
    streak: activity.streak,
    perfectScores: progress.filter((p) => p.score != null && p.score >= 1).length,
    highestNclc: await highestNclc(userId),
  };
  const freshDefs = newlyEarned(input, saved.map((s) => s.key));
  const fresh: Unlocked[] = [];
  for (const [i, def] of freshDefs.entries()) {
    const note = i === 0 ? await noteFor(userId, def) : canned(def);
    await db.insert(milestones).values({ userId, key: def.key, note }).onConflictDoNothing();
    fresh.push({ ...def, note, unlockedAt: new Date().toISOString(), fresh: true });
  }
  const allRows = freshDefs.length ? await db.select().from(milestones).where(eq(milestones.userId, userId)) : saved;
  const freshKeys = new Set(fresh.map((f) => f.key));
  const all = allRows
    .map((row) => ({ ...milestoneDef(row.key), note: row.note, unlockedAt: row.unlockedAt.toISOString(), fresh: freshKeys.has(row.key) }))
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));
  return { all, fresh };
}

export async function milestoneCount(userId: string) {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(milestones).where(eq(milestones.userId, userId));
  return row?.n ?? 0;
}

export async function hasMilestone(userId: string, key: string) {
  const db = await getDb();
  const [row] = await db.select().from(milestones).where(and(eq(milestones.userId, userId), eq(milestones.key, key)));
  return !!row;
}
