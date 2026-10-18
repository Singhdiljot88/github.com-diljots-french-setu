import { z } from "zod";
import { Explain } from "./schema";

const Ex = z.object({ fr: z.string().min(1), pron: z.string().min(1), en: z.string().min(1) });

export const PronunciationContent = z.object({
  status: z.string(),
  sounds: z.array(z.object({
    id: z.string(), ipa: z.string(), spelling: z.string(), name: Explain,
    group: z.enum(["vowel", "nasal", "consonant", "spelling"]), difficulty: z.number().int().min(1).max(3),
    mouth: Explain, trap: Explain, examples: z.array(Ex).min(3),
  })).min(10),
  minimalPairs: z.array(z.object({ contrast: z.string(), label: Explain, pairs: z.array(z.tuple([z.string(), z.string()])).min(3) })),
  liaison: z.object({ intro: Explain, groups: z.array(z.object({ rule: Explain, examples: z.array(Ex).min(2) })) }),
});
export type PronunciationContent = z.infer<typeof PronunciationContent>;
