import type { Day } from "@/content/schema";

/** Lesson as sent to the browser: comprehension and assessment answers stay on the server until the learner answers. */
export function toClientLesson(d: Day) {
  const stripMcq = (q: Day["listening"]["questions"][number]) => ({ q: q.q, options: q.options, kind: q.kind });
  return {
    ...d,
    listening: { ...d.listening, questions: d.listening.questions.map(stripMcq) },
    reading: { ...d.reading, questions: d.reading.questions.map(stripMcq) },
    assessment: d.assessment.map((q) => {
      switch (q.type) {
        case "mcq": return { type: q.type, prompt: q.prompt, options: q.options };
        case "fill": return { type: q.type, prompt: q.prompt, sentence: q.sentence };
        case "translate": return { type: q.type, prompt: q.prompt, source: q.source };
        case "reorder": return { type: q.type, prompt: q.prompt, words: shuffleStable(q.words, d.day) };
      }
    }),
  };
}
export type ClientLesson = ReturnType<typeof toClientLesson>;

function shuffleStable<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed * 9301 + 49297;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
