import { z } from "zod";
import { Explain } from "./schema";

const devanagari = z.string().regex(/[ऀ-ॿ]/, "must contain Devanagari");

export const PersonForms = z.array(z.string().min(1)).length(6);

export const DictEntry = z.object({
  lemma: z.string().trim().min(1),
  pos: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "number", "interjection", "phrase"]),
  /** nouns: grammatical gender; "mf" for nouns with one form for both (un/une élève) */
  gender: z.enum(["m", "f", "mf"]).optional(),
  plural: z.string().optional(),
  /** feminine form for adjectives and for nouns of people (acteur -> actrice) */
  feminine: z.string().optional(),
  en: z.array(z.string().min(1)).min(1),
  hi: z.array(devanagari).min(1),
  ipa: z.string().optional(),
  /** Approximate Devanagari pronunciation; omit when not reliable */
  pron: z.string().optional(),
  level: z.enum(["A1", "A2", "B1", "B2"]),
  register: z.enum(["neutral", "formal", "informal", "familiar"]).default("neutral"),
  topics: z.array(z.string()).default([]),
  examples: z.array(z.object({ fr: z.string().min(1), en: z.string().min(1), hi: devanagari })).min(1),
  collocations: z.array(z.string()).default([]),
  mistakes: z.array(Explain).default([]),
  related: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  /** Frequent learner misspellings that should still find this entry */
  misspellings: z.array(z.string()).default([]),
  verb: z.object({
    group: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    aux: z.enum(["avoir", "être"]),
    pronominal: z.boolean().default(false),
    /** Required for irregular verbs (group 3 and irregular -er like aller); regular verbs are conjugated by the engine */
    irregular: z.object({
      present: PersonForms,
      participle: z.string(),
      /** stem for futur simple & conditionnel, e.g. "ir" for aller, "ser" for être */
      futureStem: z.string(),
      /** imparfait stem when not derivable from nous-present (only être: "ét") */
      imperfectStem: z.string().optional(),
      subjunctive: PersonForms,
      imperative: z.array(z.string()).length(3).optional(),
    }).optional(),
  }).optional(),
});
export type DictEntry = z.infer<typeof DictEntry>;
