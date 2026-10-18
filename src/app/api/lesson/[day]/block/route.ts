import { z } from "zod";
import { authed, body, HttpError } from "@/server/http";
import { getProfile } from "@/server/auth";
import { completeBlock } from "@/server/progress";
import { BLOCK_ORDER } from "@/lib/schedule";

export const POST = authed<{ day: string }>(async ({ req, user, params }) => {
  const day = Number(params.day);
  if (!Number.isInteger(day) || day < 1 || day > 120) throw new HttpError(400, "Invalid day");
  const { block, minutes } = await body(req, z.object({ block: z.enum(BLOCK_ORDER as [string, ...string[]]), minutes: z.number().min(0).max(240).default(0) }));
  const profile = await getProfile(user.id);
  if (!profile) throw new HttpError(400, "Finish onboarding first");
  return completeBlock(user.id, profile, day, block as (typeof BLOCK_ORDER)[number], minutes);
});
