import { authed, body, HttpError } from "@/server/http";
import { getProfile } from "@/server/auth";
import { PracticeResult, savePracticeSession } from "@/server/practice";

export const POST = authed(async ({ req, user }) => {
  const r = await body(req, PracticeResult);
  const profile = await getProfile(user.id);
  if (!profile) throw new HttpError(400, "Finish onboarding first");
  return savePracticeSession(user.id, profile, r);
});
