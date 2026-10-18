import { z } from "zod";
import { getDb } from "@/db";
import { contentReports } from "@/db/schema";
import { authed, body } from "@/server/http";
import { CURRICULUM_VERSION } from "@/content/load";

export const POST = authed(async ({ req, user }) => {
  const r = await body(req, z.object({ ref: z.string().max(200), message: z.string().min(1).max(1000) }));
  const db = await getDb();
  await db.insert(contentReports).values({ userId: user.id, ref: r.ref, message: r.message, contentVersion: CURRICULUM_VERSION });
  return { ok: true };
});
