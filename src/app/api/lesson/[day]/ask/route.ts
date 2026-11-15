import { z } from "zod";
import { AiUnavailable } from "@/server/ai";
import { getLesson } from "@/server/content";
import { authed, body, HttpError } from "@/server/http";
import { askLessonTutor } from "@/server/lesson-tutor";

/** "Ask the tutor": a doubt about this lesson, answered in simple Hindi and English. */
export const POST = authed<{ day: string }>(async ({ req, user, params }) => {
  const lesson = await getLesson(Number(params.day));
  if (!lesson) throw new HttpError(404, "Lesson not found");
  const { question, history } = await body(req, z.object({
    question: z.string().trim().min(2).max(500),
    history: z.array(z.object({ q: z.string().max(500), a: z.string().max(2000) })).max(6).default([]),
  }));
  try {
    return await askLessonTutor(user.id, lesson.day, question, history);
  } catch (e) {
    if (e instanceof AiUnavailable) throw new HttpError(503, e.message);
    throw e;
  }
});
