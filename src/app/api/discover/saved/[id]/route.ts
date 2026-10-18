import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webResources } from "@/db/schema";
import { authed } from "@/server/http";
import { savedResource } from "@/server/web/service";

export const GET = authed<{ id: string }>(async ({ user, params }) => savedResource(user.id, params.id));
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  const db = await getDb();
  await db.delete(webResources).where(and(eq(webResources.id, params.id), eq(webResources.userId, user.id)));
  return { ok: true };
});
