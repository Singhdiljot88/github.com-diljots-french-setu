import { z } from "zod";
import { authed, body } from "@/server/http";
import { answerDrill, deleteMistake, setResolved } from "@/server/mistakes";

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ resolved: z.boolean() }));
  return { mistake: await setResolved(user.id, params.id, b.resolved) };
});

export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ answer: z.string().max(1000) }));
  return answerDrill(user.id, params.id, b.answer);
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await deleteMistake(user.id, params.id);
  return { ok: true };
});
