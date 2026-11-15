import "server-only";
import { z } from "zod";
import type { MistakeCategory, Skill } from "@/db/schema";
import { addMistake, logMinutes, recordAttempt } from "./progress";
import type { Profile } from "./learner";

export const GAMES = {
  gender_sprint: { skill: "grammar", category: "gender" },
  nombres: { skill: "listening", category: "comprehension" },
  faux_amis: { skill: "vocabulary", category: "vocabulary" },
  listen_pick: { skill: "listening", category: "vocabulary" },
} as const satisfies Record<string, { skill: Skill; category: MistakeCategory }>;
export type GameKey = keyof typeof GAMES;

export const PracticeResult = z.object({
  game: z.enum(Object.keys(GAMES) as [GameKey, ...GameKey[]]),
  correct: z.number().int().min(0).max(500),
  total: z.number().int().min(0).max(500),
  seconds: z.number().min(0).max(3600),
  misses: z.array(z.object({
    original: z.string().max(200), corrected: z.string().max(200),
    en: z.string().max(400), hi: z.string().max(400).optional(),
  })).max(20).default([]),
});
export type PracticeResult = z.infer<typeof PracticeResult>;

/** At most this many misses per session go to the mistake notebook, so a quick game can't flood it. */
export const MAX_MISTAKES_PER_SESSION = 5;

/** Records one practice-game session: one scored attempt, the minutes, and the first few misses. */
export async function savePracticeSession(userId: string, profile: Profile, r: PracticeResult) {
  if (r.total === 0) return { ok: true, saved: 0 };
  const g = GAMES[r.game];
  const correct = Math.min(r.correct, r.total);
  await recordAttempt(userId, { kind: `game_${r.game}`, itemRef: r.game, skill: g.skill, score: correct / r.total, response: { correct, total: r.total, seconds: Math.round(r.seconds) } });
  await logMinutes(userId, profile, `game_${r.game}`, Math.round((r.seconds / 60) * 10) / 10);
  const misses = r.misses.slice(0, MAX_MISTAKES_PER_SESSION);
  for (const m of misses) {
    await addMistake(userId, { category: g.category, source: `game_${r.game}`, sourceRef: r.game, original: m.original, corrected: m.corrected, explanation: { en: m.en, hi: m.hi }, drill: { prompt: m.original, answer: m.corrected } });
  }
  return { ok: true, saved: misses.length };
}
