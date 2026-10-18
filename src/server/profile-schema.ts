import { z } from "zod";
import { isValidDate, isValidTimeZone } from "@/lib/dates";

export const EXAM_VARIANTS = {
  tef_canada: { en: "TEF Canada (immigration and citizenship in Canada)", supported: true },
  tefaq: { en: "TEFAQ (Québec immigration)", supported: false },
  tef_etudes: { en: "TEF Études (studies in France)", supported: false },
  tef_naturalisation: { en: "TEF Naturalisation (French nationality)", supported: false },
  tef_irn: { en: "TEF IRN (integration, residence, nationality — France)", supported: false },
  undecided: { en: "Not sure yet", supported: false },
} as const;
export type ExamVariant = keyof typeof EXAM_VARIANTS;

export const ProfileInput = z.object({
  displayName: z.string().max(60).default(""),
  explanationLang: z.enum(["en", "hi", "both"]),
  dailyMinutes: z.union([z.literal(45), z.literal(90), z.literal(150), z.literal(180)]),
  pace: z.enum(["compact", "complete"]),
  startDate: z.string().refine(isValidDate, "Invalid start date"),
  examDate: z.string().refine(isValidDate, "Invalid exam date").nullable().optional(),
  examVariant: z.enum(Object.keys(EXAM_VARIANTS) as [ExamVariant, ...ExamVariant[]]),
  desiredOutcome: z.string().max(300).default(""),
  experience: z.enum(["none", "other_language", "some_french"]),
  entryPath: z.enum(["absolute_beginner", "placement"]),
  placementDay: z.number().int().refine((d) => [1, 21, 41].includes(d), "Start day must be 1, 21 or 41"),
  micOptIn: z.boolean(),
  slowAudioDefault: z.boolean(),
  devanagariMode: z.enum(["auto", "always", "never"]),
  showIpa: z.boolean(),
  keepRecordings: z.boolean(),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone"),
}).refine((p) => !p.examDate || p.examDate >= p.startDate, { message: "The exam date must be after the start date", path: ["examDate"] });
export type ProfileInput = z.infer<typeof ProfileInput>;

/** Partial update used by Settings */
export const ProfilePatch = z.object({
  displayName: z.string().max(60),
  explanationLang: z.enum(["en", "hi", "both"]),
  dailyMinutes: z.union([z.literal(45), z.literal(90), z.literal(150), z.literal(180)]),
  pace: z.enum(["compact", "complete"]),
  examDate: z.string().refine(isValidDate).nullable(),
  examVariant: z.enum(Object.keys(EXAM_VARIANTS) as [ExamVariant, ...ExamVariant[]]),
  desiredOutcome: z.string().max(300),
  micOptIn: z.boolean(),
  slowAudioDefault: z.boolean(),
  devanagariMode: z.enum(["auto", "always", "never"]),
  showIpa: z.boolean(),
  keepRecordings: z.boolean(),
  timezone: z.string().refine(isValidTimeZone),
}).partial();
