import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts } from "@/db/schema";
import { allLessons } from "./content";
import { phaseOf } from "@/content/outline";

export type LibraryItem = { day: number; phase: number; title: string; titleEn: string; type: string; mode?: string; questions: number; answered: number; correct: number };

/** Listening or reading items from every available lesson, with the learner's latest result per question. */
export async function libraryItems(userId: string, kind: "listening" | "reading"): Promise<LibraryItem[]> {
  const ls = await allLessons();
  const db = await getDb();
  const rows = await db.select({ itemRef: attempts.itemRef, correct: attempts.correct, createdAt: attempts.createdAt }).from(attempts)
    .where(and(eq(attempts.userId, userId), inArray(attempts.kind, [kind])));
  const latest = new Map<string, { correct: boolean | null; at: number }>();
  for (const r of rows) {
    const prev = latest.get(r.itemRef);
    if (!prev || prev.at < r.createdAt.getTime()) latest.set(r.itemRef, { correct: r.correct, at: r.createdAt.getTime() });
  }
  return [...ls.values()].map(({ day: d }) => {
    const n = d[kind].questions.length;
    let answered = 0, correct = 0;
    for (let i = 0; i < n; i++) {
      const l = latest.get(`day:${d.day}:${kind}:${i}`);
      if (l) { answered++; if (l.correct) correct++; }
    }
    return kind === "listening"
      ? { day: d.day, phase: phaseOf(d.day), title: d.listening.title.fr, titleEn: d.listening.title.en, type: d.listening.type, mode: d.listening.mode, questions: n, answered, correct }
      : { day: d.day, phase: phaseOf(d.day), title: d.reading.title, titleEn: d.title.en, type: d.reading.genre, questions: n, answered, correct };
  }).sort((a, b) => a.day - b.day);
}
