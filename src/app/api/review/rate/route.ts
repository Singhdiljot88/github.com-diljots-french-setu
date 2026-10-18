import { z } from "zod";
import { authed, body } from "@/server/http";
import { rateCard } from "@/server/words";
import { recordAttempt } from "@/server/progress";

export const POST = authed(async ({ req, user }) => {
  const r = await body(req, z.object({ cardId: z.string().uuid(), rating: z.enum(["again", "hard", "good", "easy"]), answer: z.string().max(300).optional(), kind: z.string().max(30).optional() }));
  const next = await rateCard(user.id, r.cardId, r.rating, r.answer);
  await recordAttempt(user.id, { kind: "review", itemRef: `card:${r.cardId}`, skill: r.kind === "audio" || r.kind === "dictation" ? "listening" : "vocabulary", correct: r.rating !== "again", score: { again: 0, hard: 0.6, good: 1, easy: 1 }[r.rating] });
  return { next };
});
