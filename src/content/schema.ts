import { z } from "zod";

/**
 * Structured lesson schema for the 120-day course.
 * Factual language data (French text, translations) is kept separate from
 * explanations so that individual items can be corrected and versioned.
 */

const nonEmpty = z.string().trim().min(1);
const devanagari = z.string().regex(/[ऀ-ॿ]/, "must contain Devanagari");

/** Bilingual explanation text. `hi` must be natural Hindi in Devanagari. */
export const Explain = z.object({ en: nonEmpty, hi: devanagari });
export type Explain = z.infer<typeof Explain>;

/** A French item with meanings and an optional approximate Devanagari pronunciation guide. */
export const LangItem = z.object({
  fr: nonEmpty,
  en: nonEmpty,
  hi: devanagari,
  /** Approximate pronunciation in Devanagari (see content/CONVENTIONS.md). Never the Hindi meaning. */
  pron: z.string().optional(),
  ipa: z.string().optional(),
  note: Explain.optional(),
});
export type LangItem = z.infer<typeof LangItem>;

export const VocabItem = LangItem.extend({
  pos: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "number", "interjection", "phrase"]),
  gender: z.enum(["m", "f", "mf"]).optional(),
  /** Dictionary lemma when different from `fr` (e.g. fr "la maison" -> lemma "maison"). */
  lemma: z.string().optional(),
  /** Hindi memory aid (याद करने की तरकीब), shown labelled as a memory aid, never as a translation. Must reuse this item's `pron`, not a new spelling. */
  mnemonic: z.object({ hi: devanagari, en: z.string().optional(), reviewed: z.boolean().default(false) }).optional(),
});
export type VocabItem = z.infer<typeof VocabItem>;

export const Mcq = z.object({
  q: z.object({ fr: z.string().optional(), en: nonEmpty, hi: devanagari.optional() }),
  options: z.array(nonEmpty).min(3).max(4),
  /** Hindi versions of English answer choices (left out when the choices are French). */
  optionsHi: z.array(nonEmpty).min(3).max(4).optional(),
  answer: z.number().int().min(0).max(3),
  explanation: Explain,
  kind: z.enum(["literal", "inference", "vocabulary", "grammar", "gist"]).optional(),
  /** Exact quote from the passage/audio transcript that justifies the answer. */
  evidence: z.string().optional(),
}).refine((m) => m.answer < m.options.length, "answer index out of range")
  .refine((m) => !m.optionsHi || m.optionsHi.length === m.options.length, "optionsHi must match options one to one");
export type Mcq = z.infer<typeof Mcq>;

export const Voice = z.enum(["f1", "m1", "f2", "m2", "narrator"]);

export const Listening = z.object({
  title: z.object({ fr: nonEmpty, en: nonEmpty }),
  type: z.enum(["dialogue", "monologue", "announcement", "voicemail", "interview", "radio", "street_interview", "story"]),
  /** pedagogical = deliberately slow & clear; natural = normal conversational speed */
  mode: z.enum(["pedagogical", "natural"]),
  context: Explain,
  lines: z.array(z.object({ speaker: nonEmpty, voice: Voice, fr: nonEmpty, en: nonEmpty, hi: devanagari })).min(2),
  questions: z.array(Mcq).min(3),
  dictation: z.array(nonEmpty).min(1).max(4),
  gapFill: z.object({ text: z.string().includes("___"), answers: z.array(nonEmpty).min(1) }),
});

export const Speaking = z.object({
  type: z.enum(["repeat", "pronunciation", "shadowing", "roleplay", "conversation", "tef_a", "tef_b", "presentation"]),
  focusSound: z.string().optional(),
  instructions: Explain,
  prompts: z.array(LangItem.extend({ model: z.string().optional() })).min(3),
  tip: Explain,
  /** For role-plays: scenario the simulated interlocutor plays. */
  scenario: z.object({ setting: Explain, learnerRole: Explain, partnerRole: Explain, goals: z.array(Explain).min(1) }).optional(),
});

export const Reading = z.object({
  genre: z.enum(["sign", "menu", "advertisement", "message", "notice", "email", "form", "article", "opinion", "story", "schedule", "chart", "letter", "dialogue"]),
  title: nonEmpty,
  text: nonEmpty,
  translation: z.object({ en: nonEmpty, hi: devanagari }),
  questions: z.array(Mcq).min(3),
});

export const Writing = z.object({
  type: z.enum(["sentences", "form", "message", "email", "paragraph", "story", "article_continuation", "opinion_letter", "rewrite"]),
  prompt: z.object({ en: nonEmpty, hi: devanagari, fr: z.string().optional() }),
  minWords: z.number().int().min(3),
  maxWords: z.number().int().optional(),
  hints: z.array(Explain).min(1),
  usefulPhrases: z.array(LangItem).min(2),
  model: z.object({ fr: nonEmpty, en: nonEmpty }),
  checklist: z.array(Explain).min(2),
});

export const AssessmentQ = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mcq"), prompt: Explain.extend({ fr: z.string().optional() }), options: z.array(nonEmpty).min(3).max(4), answer: z.number().int().min(0).max(3), explanation: Explain }),
  z.object({ type: z.literal("fill"), prompt: Explain, sentence: z.string().includes("___"), answer: nonEmpty, accept: z.array(z.string()).default([]), explanation: Explain }),
  z.object({ type: z.literal("translate"), prompt: Explain, source: Explain, answer: nonEmpty, accept: z.array(z.string()).default([]), explanation: Explain }),
  z.object({ type: z.literal("reorder"), prompt: Explain, words: z.array(nonEmpty).min(3), answer: nonEmpty, explanation: Explain }),
]);
export type AssessmentQ = z.infer<typeof AssessmentQ>;

export const Day = z.object({
  day: z.number().int().min(1).max(120),
  phase: z.number().int().min(1).max(6),
  title: z.object({ fr: nonEmpty, en: nonEmpty, hi: devanagari }),
  objective: Explain,
  prerequisites: z.object({ days: z.array(z.number().int().min(1).max(119)), summary: Explain }),
  light: z.boolean(),
  checkpoint: z.boolean(),
  mock: z.object({ id: z.string(), part: z.enum(["reading_listening", "writing_speaking", "review"]) }).optional(),
  vocabulary: z.array(VocabItem).min(5),
  phrases: z.array(LangItem).min(3),
  grammar: z.object({
    title: Explain,
    explanation: Explain,
    comparison: Explain.optional(),
    examples: z.array(LangItem).min(3),
    pitfalls: z.array(Explain).min(1),
  }),
  pronunciation: z.object({ focus: nonEmpty, tip: Explain, words: z.array(LangItem).min(3) }),
  listening: Listening,
  speaking: Speaking,
  reading: Reading,
  writing: Writing,
  review: z.object({ fromDays: z.array(z.number().int()), items: z.array(LangItem).min(4) }),
  assessment: z.array(AssessmentQ).min(5),
});
export type Day = z.infer<typeof Day>;
export type Listening = z.infer<typeof Listening>;
export type Reading = z.infer<typeof Reading>;
export type Writing = z.infer<typeof Writing>;
export type Speaking = z.infer<typeof Speaking>;
