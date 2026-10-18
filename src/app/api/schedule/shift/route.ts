import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { authed, HttpError } from "@/server/http";
import { getProfile } from "@/server/auth";
import { learnerState, scheduleInput } from "@/server/learner";
import { partsPerLesson, type DailyMinutes, type Pace } from "@/lib/schedule";

/** Recovery: move the remaining schedule forward so the next incomplete lesson is today. Completed work is untouched. */
export const POST = authed(async ({ user }) => {
  const p = await getProfile(user.id);
  if (!p) throw new HttpError(400, "No profile");
  const st = await learnerState(user.id, p);
  if (!st.recovery) return { shifted: 0 };
  const parts = partsPerLesson(p.dailyMinutes as DailyMinutes, p.pace as Pace);
  const shiftBy = st.recovery.behindBy * parts;
  const db = await getDb();
  await db.update(profiles).set({ scheduleShiftDays: p.scheduleShiftDays + shiftBy, updatedAt: new Date() }).where(eq(profiles.userId, user.id));
  void scheduleInput;
  return { shifted: shiftBy };
});
