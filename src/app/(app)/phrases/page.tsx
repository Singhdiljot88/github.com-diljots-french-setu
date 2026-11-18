import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { allLessons } from "@/server/content";
import { buildPhrasebook } from "@/lib/situations";
import { Phrasebook } from "@/components/phrasebook";

export const metadata = { title: "Phrasebook" };
export const dynamic = "force-dynamic";

export default async function PhrasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding");
  const st = await learnerState(user.id, profile);
  const lessons = await allLessons();
  const book = buildPhrasebook([...lessons.values()].map((l) => l.day));
  return <Phrasebook book={book} courseDay={st.todayDay} />;
}
