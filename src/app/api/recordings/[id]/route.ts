import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { recordings } from "@/db/schema";
import { authed, HttpError } from "@/server/http";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const db = await getDb();
  const [r] = await db.select().from(recordings).where(and(eq(recordings.id, params.id), eq(recordings.userId, user.id)));
  if (!r) throw new HttpError(404, "Recording not found");
  return new Response(new Uint8Array(r.audio), { headers: { "content-type": r.mime, "cache-control": "private, no-store" } });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  const db = await getDb();
  await db.delete(recordings).where(and(eq(recordings.id, params.id), eq(recordings.userId, user.id)));
  return { ok: true };
});
