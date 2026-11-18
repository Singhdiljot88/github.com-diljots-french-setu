export type MilestoneDef = { key: string; en: string; hi: string; badge: string };

export const MILESTONES: MilestoneDef[] = [
  { key: "first_lesson", en: "First lesson finished", hi: "पहला पाठ पूरा", badge: "🌱" },
  { key: "streak_3", en: "3-day streak", hi: "3 दिन लगातार", badge: "🔥" },
  { key: "streak_7", en: "7-day streak", hi: "7 दिन लगातार", badge: "🔥" },
  { key: "streak_30", en: "30-day streak", hi: "30 दिन लगातार", badge: "🔥" },
  { key: "day_10", en: "Day 10", hi: "दिन 10", badge: "🔟" },
  { key: "day_30", en: "Day 30", hi: "दिन 30", badge: "📘" },
  { key: "day_60", en: "Day 60", hi: "दिन 60", badge: "📗" },
  { key: "day_90", en: "Day 90", hi: "दिन 90", badge: "📙" },
  { key: "day_120", en: "Day 120", hi: "दिन 120", badge: "🎓" },
  { key: "first_perfect", en: "First perfect check", hi: "पहली पूरी सही जाँच", badge: "⭐" },
];

export function nclcMilestone(level: number): MilestoneDef {
  return { key: `nclc_${level}`, en: `Practice estimate reached NCLC ${level}`, hi: `अभ्यास-अनुमान NCLC ${level} तक पहुँचा`, badge: "📈" };
}

export type MilestoneInput = {
  completedDays: number[];
  streak: number;
  perfectScores: number;
  highestNclc: number;
};

/** Keys the learner has earned from the facts so far. Already-saved keys are not removed. */
export function earnedKeys(input: MilestoneInput): string[] {
  const days = input.completedDays;
  const keys: string[] = [];
  if (days.length > 0) keys.push("first_lesson");
  if (input.streak >= 3) keys.push("streak_3");
  if (input.streak >= 7) keys.push("streak_7");
  if (input.streak >= 30) keys.push("streak_30");
  for (const day of [10, 30, 60, 90, 120]) if (days.some((d) => d >= day)) keys.push(`day_${day}`);
  if (input.perfectScores > 0) keys.push("first_perfect");
  const top = Math.min(10, Math.max(0, Math.floor(input.highestNclc)));
  for (let level = 4; level <= top; level++) keys.push(`nclc_${level}`);
  return keys;
}

export function milestoneDef(key: string): MilestoneDef {
  return MILESTONES.find((m) => m.key === key) ?? (/^nclc_(\d+)$/.test(key) ? nclcMilestone(Number(key.slice(5))) : { key, en: key, hi: key, badge: "🏅" });
}

export function newlyEarned(input: MilestoneInput, already: string[]): MilestoneDef[] {
  const have = new Set(already);
  return earnedKeys(input).filter((k) => !have.has(k)).map(milestoneDef);
}
