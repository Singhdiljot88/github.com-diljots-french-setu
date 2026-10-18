import { z } from "zod";
import { authed, body, HttpError } from "@/server/http";
import { getLesson } from "@/server/content";
import { answerQuestion } from "@/server/progress";

export const POST = authed<{ day: string }>(async ({ req, user, params }) => {
  const lesson = await getLesson(Number(params.day));
  if (!lesson) throw new HttpError(404, "Lesson not found");
  const { section, index, choice } = await body(req, z.object({ section: z.enum(["listening", "reading"]), index: z.number().int().min(0), choice: z.number().int().min(-1).max(3) }));
  return answerQuestion(user.id, lesson.day, section, index, choice);
});
