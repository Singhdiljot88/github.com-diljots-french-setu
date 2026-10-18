import { z } from "zod";

export const ERROR_CATEGORIES = ["grammar", "spelling", "gender", "agreement", "tense", "vocabulary", "organization"] as const;

export const Correction = z.object({
  original: z.string().min(1).max(400),
  corrected: z.string().max(400),
  category: z.enum(ERROR_CATEGORIES),
  /** true = an actual error; false = optional stylistic improvement */
  isError: z.boolean(),
  explanation: z.object({ en: z.string().min(1).max(600), hi: z.string().max(600).default("") }),
  practice: z.object({ prompt: z.string().min(1).max(300), answer: z.string().min(1).max(300) }),
});
export type Correction = z.infer<typeof Correction>;

export const WritingFeedback = z.object({
  summary: z.object({ en: z.string().max(800), hi: z.string().max(800).default("") }),
  strengths: z.array(z.string().max(300)).max(5),
  corrections: z.array(Correction).max(12),
  /** Corrected version at the learner's level, preserving their meaning */
  correctedText: z.string().max(6000),
  /** Optional more advanced rewrite, offered after the level-appropriate correction */
  advancedVersion: z.string().max(6000).optional(),
  taskNotes: z.array(z.string().max(300)).max(5).default([]),
});
export type WritingFeedback = z.infer<typeof WritingFeedback>;

export type FeedbackEnvelope = { provider: string; isDemo: boolean; label: string; feedback: WritingFeedback; limitations?: string };

export const SpeakingFeedback = z.object({
  strengths: z.array(z.string().max(300)).max(5),
  corrections: z.array(Correction).max(6),
  grammarVocab: z.array(z.string().max(300)).max(6),
  strongerVersions: z.array(z.object({ original: z.string().max(400), stronger: z.string().max(600) })).max(3),
  retry: z.object({ instruction: z.string().max(300), prompts: z.array(z.string().max(300)).min(1).max(4) }),
});
export type SpeakingFeedback = z.infer<typeof SpeakingFeedback>;
