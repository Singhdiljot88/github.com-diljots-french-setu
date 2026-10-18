import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, recordings } from "@/db/schema";
import { authed, body, HttpError } from "@/server/http";
import { ProfileInput, ProfilePatch } from "@/server/profile-schema";

export const GET = authed(async ({ user }) => {
  const db = await getDb();
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
  return { profile: p ?? null };
});

/** Onboarding: create or replace the profile. */
export const POST = authed(async ({ req, user }) => {
  const input = await body(req, ProfileInput);
  const db = await getDb();
  const values = { ...input, examDate: input.examDate ?? null, examVariantConfirmed: true, userId: user.id, onboardedAt: new Date(), updatedAt: new Date() };
  await db.insert(profiles).values(values).onConflictDoUpdate({ target: profiles.userId, set: values });
  return { ok: true };
});

/** Settings: partial update. Turning off "keep recordings" deletes stored recordings. */
export const PATCH = authed(async ({ req, user }) => {
  const patch = await body(req, ProfilePatch);
  const db = await getDb();
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
  if (!p) throw new HttpError(404, "Profile not found");
  await db.update(profiles).set({ ...patch, updatedAt: new Date() }).where(eq(profiles.userId, user.id));
  if (patch.keepRecordings === false) await db.delete(recordings).where(eq(recordings.userId, user.id));
  return { ok: true };
});
