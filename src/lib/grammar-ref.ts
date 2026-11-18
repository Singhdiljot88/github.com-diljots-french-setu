import type { Day } from "@/content/schema";
import { searchKey } from "./text";

export type GrammarPoint = {
  day: number;
  phase: number;
  title: { en: string; hi: string };
  explanation: { en: string; hi: string };
  comparison?: { en: string; hi: string };
  examples: { fr: string; en: string; hi: string; pron?: string }[];
  pitfalls: { en: string; hi: string }[];
  lessonTitle: { en: string; hi: string };
};

/** One card per lesson, taken from the grammar box the learner already studies that day. */
export function toGrammarPoints(days: Day[]): GrammarPoint[] {
  return [...days].sort((a, b) => a.day - b.day).map((d) => ({
    day: d.day,
    phase: d.phase,
    title: d.grammar.title,
    explanation: d.grammar.explanation,
    comparison: d.grammar.comparison,
    examples: d.grammar.examples.slice(0, 4).map((e) => ({ fr: e.fr, en: e.en, hi: e.hi, pron: e.pron })),
    pitfalls: d.grammar.pitfalls,
    lessonTitle: { en: d.title.en, hi: d.title.hi },
  }));
}

/** Search French, English or Hindi. `maxDay` hides points the course has not reached yet. */
export function filterGrammar(points: GrammarPoint[], o: { q: string; phase: number; maxDay: number | null }): GrammarPoint[] {
  const key = searchKey(o.q);
  return points.filter((p) => {
    if (o.maxDay != null && p.day > o.maxDay) return false;
    if (o.phase && p.phase !== o.phase) return false;
    if (!key) return true;
    const hay = searchKey([
      p.title.en, p.title.hi, p.explanation.en, p.explanation.hi, p.lessonTitle.en, p.lessonTitle.hi,
      p.comparison?.en ?? "", p.comparison?.hi ?? "",
      ...p.examples.flatMap((e) => [e.fr, e.en, e.hi]),
      ...p.pitfalls.flatMap((x) => [x.en, x.hi]),
    ].join("\n"));
    return key.split(" ").every((w) => hay.includes(w));
  });
}
