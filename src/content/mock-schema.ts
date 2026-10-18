import { z } from "zod";
import { Explain, Mcq, Voice } from "./schema";

const Doc = z.object({ genre: z.string(), title: z.string(), text: z.string().min(1) });

export const ReadingItem = z.object({ document: Doc, questions: z.array(Mcq).min(1) });
export const ListeningItem = z.object({
  context: z.string().min(1),
  type: z.enum(["conversation", "announcement", "voicemail", "street_interview", "radio", "interview", "report", "everyday"]),
  lines: z.array(z.object({ speaker: z.string(), voice: Voice, fr: z.string().min(1) })).min(1),
  questions: z.array(Mcq).min(1),
});

export const Mock = z.object({
  id: z.string(),
  title: z.string(),
  disclaimer: z.string(),
  reading: z.object({
    sections: z.array(z.object({ key: z.string(), title: z.string(), instruction: z.string(), items: z.array(ReadingItem).min(1) })).min(1),
  }),
  listening: z.object({
    sections: z.array(z.object({ key: z.string(), title: z.string(), instruction: z.string(), items: z.array(ListeningItem).min(1) })).min(1),
  }),
  writing: z.object({
    a: z.object({ articleStart: z.string().min(1), instruction: Explain, minWords: z.literal(80) }),
    b: z.object({ statement: z.string().min(1), instruction: Explain, minWords: z.literal(200) }),
  }),
  speaking: z.object({
    a: z.object({ document: z.string().min(1), instruction: Explain, partnerFacts: z.array(z.string()).min(8) }),
    b: z.object({ document: z.string().min(1), instruction: Explain, partnerObjections: z.array(z.string()).min(5) }),
  }),
});
export type Mock = z.infer<typeof Mock>;
