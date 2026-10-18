import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { recordings } from "@/db/schema";
import { authed, HttpError } from "@/server/http";
import { getProfile } from "@/server/auth";

const MAX_BYTES = 2_000_000; // about a minute of compressed speech
const MAX_PER_USER = 200;
const MIME = /^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac)(;.*)?$/;

/** Lists the learner's kept recordings (metadata only). */
export const GET = authed(async ({ user }) => {
  const db = await getDb();
  const rows = await db.select({ id: recordings.id, kind: recordings.kind, ref: recordings.ref, mime: recordings.mime, createdAt: recordings.createdAt }).from(recordings).where(eq(recordings.userId, user.id)).orderBy(desc(recordings.createdAt));
  return { recordings: rows };
});

/** Stores a recording only when the learner turned on "keep my recordings". */
export const POST = authed(async ({ req, user }) => {
  const profile = await getProfile(user.id);
  if (!profile?.keepRecordings) throw new HttpError(403, "Keeping recordings is turned off in your settings.");
  const fd = await req.formData();
  const audio = fd.get("audio");
  if (!(audio instanceof Blob)) throw new HttpError(400, "No audio");
  if (audio.size > MAX_BYTES) throw new HttpError(413, "Recording is too long to keep.");
  const mime = audio.type || "audio/webm";
  if (!MIME.test(mime)) throw new HttpError(415, "Unsupported audio type");
  const db = await getDb();
  const existing = await db.select({ id: recordings.id }).from(recordings).where(eq(recordings.userId, user.id));
  if (existing.length >= MAX_PER_USER) throw new HttpError(409, `You can keep up to ${MAX_PER_USER} recordings. Delete some in Settings first.`);
  const [r] = await db.insert(recordings).values({
    userId: user.id, kind: String(fd.get("kind") ?? "practice").slice(0, 40), ref: String(fd.get("ref") ?? "").slice(0, 200),
    mime: mime.split(";")[0], audio: Buffer.from(await audio.arrayBuffer()),
  }).returning({ id: recordings.id });
  return { id: r.id };
});

export const DELETE = authed(async ({ user }) => {
  const db = await getDb();
  await db.delete(recordings).where(eq(recordings.userId, user.id));
  return { ok: true };
});

