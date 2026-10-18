import { z } from "zod";
import { authed, body } from "@/server/http";
import {
  examView, endSpeakingTask, loadAttempt, nextListening, playListening, saveAnswer,
  speakingTurn, startSection, startSpeakingTask, submitSection, writingFeedback,
} from "@/server/exam";

const Section = z.enum(["reading", "listening", "writing", "speaking"]);
const Task = z.enum(["a", "b"]);
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), section: Section }),
  z.object({ action: z.literal("answer"), section: Section, qid: z.string().max(32), value: z.union([z.number().int().min(-1).max(3), z.string().max(8000)]) }),
  z.object({ action: z.literal("play"), n: z.number().int().min(0).max(200) }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("submit"), section: Section }),
  z.object({ action: z.literal("speak_start"), task: Task }),
  z.object({ action: z.literal("speak_turn"), task: Task, text: z.string().min(1).max(1500), via: z.enum(["typed", "speech_browser", "speech_server"]).default("typed") }),
  z.object({ action: z.literal("speak_end"), task: Task }),
  z.object({ action: z.literal("writing_feedback"), task: Task, useAi: z.boolean().default(true) }),
]);

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const { attempt, mock } = await loadAttempt(user.id, params.id);
  return examView(user.id, attempt, mock);
});

export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Action);
  const id = params.id;
  switch (b.action) {
    case "start": { const { attempt, mock } = await startSection(user.id, id, b.section); return examView(user.id, attempt, mock); }
    case "submit": { const { attempt, mock } = await submitSection(user.id, id, b.section); return examView(user.id, attempt, mock); }
    case "answer": return saveAnswer(user.id, id, b.section, b.qid, b.value);
    case "play": return playListening(user.id, id, b.n);
    case "next": return nextListening(user.id, id);
    case "speak_start": return startSpeakingTask(user.id, id, b.task);
    case "speak_turn": return speakingTurn(user.id, id, b.task, b.text, b.via);
    case "speak_end": return { report: await endSpeakingTask(user.id, id, b.task) };
    case "writing_feedback": return writingFeedback(user.id, id, b.task, b.useAi);
  }
});
