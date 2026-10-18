import { z } from "zod";
import { authed, body } from "@/server/http";
import { gradeAssessment } from "@/server/progress";

export const POST = authed<{ day: string }>(async ({ req, user, params }) => {
  const { responses } = await body(req, z.object({ responses: z.array(z.union([z.string().max(500), z.number(), z.null()])).max(20) }));
  return gradeAssessment(user.id, Number(params.day), responses);
});
