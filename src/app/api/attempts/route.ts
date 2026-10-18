import { z } from "zod";
import { authed, body } from "@/server/http";
import { recordAttempt, addMistake } from "@/server/progress";

const Mistake = z.object({
  category: z.enum(["grammar", "spelling", "gender", "agreement", "tense", "vocabulary", "organization", "comprehension", "pronunciation"]),
  original: z.string().max(500), corrected: z.string().max(500), explanation: z.object({ en: z.string().max(1000), hi: z.string().max(1000).optional() }),
});

export const POST = authed(async ({ req, user }) => {
  const a = await body(req, z.object({
    day: z.number().int().min(1).max(120).nullable().optional(),
    kind: z.string().max(40), itemRef: z.string().max(200),
    skill: z.enum(["reading", "listening", "speaking", "writing", "vocabulary", "grammar", "pronunciation"]),
    correct: z.boolean().nullable().optional(), score: z.number().min(0).max(1).nullable().optional(),
    response: z.unknown().optional(), mistake: Mistake.optional(),
  }));
  await recordAttempt(user.id, a);
  if (a.mistake) await addMistake(user.id, { ...a.mistake, source: a.kind, sourceRef: a.itemRef, drill: { prompt: a.mistake.original, answer: a.mistake.corrected } });
  return { ok: true };
});
