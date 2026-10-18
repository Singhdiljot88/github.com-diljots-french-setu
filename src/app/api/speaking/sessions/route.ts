import { z } from "zod";
import { authed, body } from "@/server/http";
import { recentSessions, SPEAKING_MODES, speakingCatalog, startSession } from "@/server/speaking";

export const GET = authed(async ({ user }) => ({ catalog: speakingCatalog(), recent: await recentSessions(user.id) }));

export const POST = authed(async ({ req, user }) => {
  const b = await body(req, z.object({ mode: z.enum(SPEAKING_MODES), ref: z.string().max(100), useAi: z.boolean().default(true) }));
  return startSession(user.id, b.mode, b.ref, b.useAi);
});
