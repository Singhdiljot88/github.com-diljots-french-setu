import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { savedWords } from "@/db/schema";
import { authed, body, HttpError } from "@/server/http";
import { addCards, wordHistory } from "@/server/words";

export const GET = authed<{ id: string }>(async ({ user, params }) => wordHistory(user.id, params.id));

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const p = await body(req, z.object({ personalExample: z.string().max(500).nullable().optional(), addKinds: z.array(z.enum(["fr_to_meaning", "meaning_to_fr", "audio", "gender", "dictation", "cloze"])).optional() }));
  const db = await getDb();
  const [w] = await db.select().from(savedWords).where(and(eq(savedWords.id, params.id), eq(savedWords.userId, user.id)));
  if (!w) throw new HttpError(404, "Word not found");
  if (p.personalExample !== undefined) await db.update(savedWords).set({ personalExample: p.personalExample }).where(eq(savedWords.id, w.id));
  if (p.addKinds?.length) await addCards(user.id, w.id, p.addKinds);
  return { ok: true };
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  const db = await getDb();
  await db.delete(savedWords).where(and(eq(savedWords.id, params.id), eq(savedWords.userId, user.id)));
  return { ok: true };
});
