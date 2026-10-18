import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, dayProgress } from "@/db/schema";
import { skillStats, topMistakes } from "./stats";

export type Adaptation = { key: string; en: string; hi: string; href: string; reason: string };

/**
 * Extra assignments derived from demonstrated performance. They are added on top of
 * the original course; completed work and the course structure are never changed.
 */
export async function adaptations(userId: string, todayDay: number): Promise<Adaptation[]> {
  const db = await getDb();
  const out: Adaptation[] = [];
  const stats = await skillStats(userId);
  const by = Object.fromEntries(stats.map((s) => [s.skill, s]));

  const weakDays = await db.select().from(dayProgress).where(eq(dayProgress.userId, userId));
  const lowAssess = weakDays.filter((d) => d.assessmentScore !== null && d.assessmentScore < 0.6 && d.day < todayDay).sort((a, b) => b.day - a.day)[0];
  if (lowAssess) out.push({
    key: `redo-${lowAssess.day}`, href: `/lesson/${lowAssess.day}#assessment`,
    en: `Retry the Day ${lowAssess.day} check (you scored ${Math.round(lowAssess.assessmentScore! * 100)}%). Re-read its grammar box first.`,
    hi: `दिन ${lowAssess.day} का टेस्ट दोबारा कीजिए (आपका स्कोर ${Math.round(lowAssess.assessmentScore! * 100)}% था)। पहले उसका व्याकरण दोबारा पढ़िए।`,
    reason: "Assessment below 60%",
  });

  const listening = by.listening;
  if (listening?.recentAccuracy !== null && listening?.recentAccuracy !== undefined && listening.recentAccuracy < 0.6) {
    const [last] = await db.select({ day: attempts.day }).from(attempts).where(and(eq(attempts.userId, userId), eq(attempts.skill, "listening"), eq(attempts.correct, false))).orderBy(desc(attempts.createdAt)).limit(1);
    const d = last?.day ?? Math.max(1, todayDay - 1);
    out.push({ key: "listening", href: `/lesson/${d}#listening`, en: `Extra listening: replay the Day ${d} audio at slow speed, then do its dictation again.`, hi: `अतिरिक्त सुनना: दिन ${d} का ऑडियो धीमी गति से दोबारा सुनिए, फिर उसका डिक्टेशन फिर से कीजिए।`, reason: `Recent listening accuracy ${Math.round(listening.recentAccuracy * 100)}%` });
  }
  const reading = by.reading;
  if (reading?.recentAccuracy !== null && reading?.recentAccuracy !== undefined && reading.recentAccuracy < 0.6) {
    out.push({ key: "reading", href: "/reading", en: "Extra reading: one short text from the reading library with tap-to-translate.", hi: "अतिरिक्त पढ़ना: रीडिंग लाइब्रेरी से एक छोटा पाठ, शब्द पर टैप करके अर्थ देखिए।", reason: `Recent reading accuracy ${Math.round(reading.recentAccuracy * 100)}%` });
  }
  const top = await topMistakes(userId, 1);
  if (top[0] && top[0].occurrences >= 2) {
    out.push({ key: "mistake", href: "/mistakes", en: `Fix a recurring mistake (${top[0].category}): “${top[0].original.slice(0, 40)}” → “${top[0].corrected.slice(0, 40)}”.`, hi: `बार-बार होने वाली ग़लती सुधारिए (${top[0].category})।`, reason: `Seen ${top[0].occurrences} times` });
  }
  return out;
}
