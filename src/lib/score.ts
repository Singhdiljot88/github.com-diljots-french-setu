import { z } from "zod";

/** A practice score out of 10. Official TEF, CLB and NCLC results are not produced here. */
export const Score = z.number().min(0).max(10);

export const Evaluation = z.object({
  grammar: Score,
  vocabulary: Score,
  fluency: Score,
  task: Score,
  summary: z.object({ en: z.string().min(1).max(500), hi: z.string().max(500).default("") }),
  corrections: z.array(z.object({
    original: z.string().min(1).max(300),
    corrected: z.string().min(1).max(300),
    why: z.object({ en: z.string().min(1).max(400), hi: z.string().max(400).default("") }),
  })).max(6),
  nextSteps: z.array(z.object({ en: z.string().min(1).max(240), hi: z.string().max(240).default("") })).min(2).max(3),
  modelAnswer: z.object({ fr: z.string().min(1).max(800), en: z.string().max(800).default(""), hi: z.string().max(800).default("") }),
  encouragement: z.object({ en: z.string().min(1).max(240), hi: z.string().max(240).default("") }),
});
export type Evaluation = z.infer<typeof Evaluation> & { overall: number; nclc: number };

export type ScoredEvaluation = {
  id: string;
  skill: "speaking" | "writing" | "exercise";
  sourceRef: string;
  provider: string;
  isDemo: boolean;
  label: { en: string; hi: string };
  createdAt: string;
  evaluation: Evaluation;
};

const PUNCT_NIT = /capital|full stop|punctuation|comma|period|exclamation/i;

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
}

/** Mean of the four criteria, one decimal. */
export function overallFromSubs(s: { grammar: number; vocabulary: number; fluency: number; task: number }): number {
  return clampScore((clampScore(s.grammar) + clampScore(s.vocabulary) + clampScore(s.fluency) + clampScore(s.task)) / 4);
}

/**
 * Rough practice band from an overall score out of 10.
 * This is an estimate for study, not an official NCLC or CLB result.
 */
export function estimateNclc(overall: number): number {
  const s = clampScore(overall);
  if (s < 2) return 3;
  if (s < 3.5) return 4;
  if (s < 5) return 5;
  if (s < 6.5) return 6;
  if (s < 7.5) return 7;
  if (s < 8.5) return 8;
  if (s < 9.5) return 9;
  return 10;
}

/** Validate a model payload, recompute the overall and the level, and drop punctuation nits on speech. */
export function parseEvaluation(raw: unknown, o: { spoken?: boolean } = {}): Evaluation {
  const parsed = Evaluation.parse(raw);
  const corrections = o.spoken ? parsed.corrections.filter((c) => !PUNCT_NIT.test(`${c.why.en} ${c.original}`)) : parsed.corrections;
  const overall = overallFromSubs(parsed);
  return { ...parsed, corrections, overall, nclc: estimateNclc(overall) };
}

/** Labelled non-AI evaluation. Spoken turns are not marked down for capitals or full stops. */
export function demoEvaluation(text: string, o: { spoken?: boolean; task?: string } = {}): Evaluation {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const broken = /\bje bien\b/i.test(text) || /\bmontague\b/i.test(text) || (o.spoken ? false : text.trim().length > 0 && !/[.!?]$/.test(text.trim()) && words > 12);
  const grammar = broken ? 3.5 : words >= 8 ? 7 : words >= 3 ? 5.5 : 3;
  const vocabulary = /\bmontague\b/i.test(text) ? 3 : words >= 8 ? 6.5 : 5;
  const fluency = words >= 12 ? 6.5 : words >= 4 ? 5 : 3.5;
  const task = words >= 6 ? 6 : 4;
  const corrections = /\bje bien\b/i.test(text) ? [{
    original: text.trim().slice(0, 300) || "je bien",
    corrected: "Je vais bien.",
    why: {
      en: "“I am well” needs the verb aller: je vais bien. You are close, and this is a sentence you can use today.",
      hi: "“मैं ठीक हूँ” के लिए क्रिया aller चाहिए: je vais bien। आप पास हैं, और यह वाक्य आप आज इस्तेमाल कर सकते हैं।",
    },
  }] : [];
  return parseEvaluation({
    grammar, vocabulary, fluency, task,
    summary: {
      en: words ? "This is a practice estimate from a fixed checker, not an official result. The useful part is the corrected sentence below." : "There was not enough French to score. Say or write one full sentence and try again.",
      hi: words ? "यह एक तय जाँच का अभ्यास-अनुमान है, आधिकारिक परिणाम नहीं। असली मदद नीचे वाला सुधारा वाक्य है।" : "अंक देने के लिए पर्याप्त फ़्रेंच नहीं था। एक पूरा वाक्य बोलिए या लिखिए।",
    },
    corrections,
    nextSteps: [
      { en: "Say the corrected sentence out loud, then add one reason with parce que.", hi: "सुधारा वाक्य ज़ोर से बोलिए, फिर parce que से एक कारण जोड़िए।" },
      { en: "Answer the follow-up in a full sentence instead of one word.", hi: "अगले सवाल का जवाब एक शब्द में नहीं, पूरे वाक्य में दीजिए।" },
    ],
    modelAnswer: {
      fr: "Je vais bien, merci. J'aime la montagne parce que c'est calme.",
      en: "I am well, thank you. I like the mountain because it is calm.",
      hi: "मैं ठीक हूँ, धन्यवाद। मुझे पहाड़ पसंद है क्योंकि वहाँ शांति है।",
    },
    encouragement: {
      en: "You put French together. That is the part that counts. One clearer sentence next time is a real step.",
      hi: "आपने फ़्रेंच जोड़कर कही। यही मायने रखता है। अगली बार एक साफ़ वाक्य असली प्रगति है।",
    },
  }, o);
}
