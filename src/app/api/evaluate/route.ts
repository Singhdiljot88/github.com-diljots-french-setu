import { z } from "zod";
import { authed, body } from "@/server/http";
import { recordEvaluation } from "@/server/evaluation";

export const POST = authed(async ({ req, user }) => {
  const b = await body(req, z.object({
    sourceRef: z.string().min(1).max(120),
    task: z.string().max(500).default("Practice exercise"),
    items: z.array(z.object({
      prompt: z.string().max(300).default(""),
      learner: z.string().max(500),
      expected: z.string().max(500).default(""),
    })).min(1).max(12),
    useAi: z.boolean().default(true),
  }));
  const learnerText = b.items.map((item, i) => `${i + 1}. ${item.prompt}\nLearner: ${item.learner}\nA clear version: ${item.expected}`).join("\n");
  return recordEvaluation(user.id, { skill: "exercise", sourceRef: b.sourceRef, task: b.task, learnerText, spoken: false, useAi: b.useAi });
});
