import { z } from "zod";
import { authed, body } from "@/server/http";
import { attemptSummary, createAttempt, examCatalog, listAttempts } from "@/server/exam";

export const GET = authed(async ({ user }) => ({
  mocks: examCatalog(),
  attempts: (await listAttempts(user.id)).map(attemptSummary),
}));

export const POST = authed(async ({ req, user }) => {
  const b = await body(req, z.object({
    mockId: z.string().min(1).max(64),
    sections: z.array(z.enum(["reading", "listening", "writing", "speaking"])).min(1).max(4),
    strict: z.boolean().default(true),
  }));
  const a = await createAttempt(user.id, b.mockId, b.sections, b.strict);
  return { id: a.id };
});
