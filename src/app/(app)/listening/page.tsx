import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { libraryItems } from "@/server/library";
import { LibraryList } from "@/components/library-list";

export const metadata = { title: "Listening" };
export const dynamic = "force-dynamic";

export default async function ListeningLibrary() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const st = await learnerState(user.id, profile);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Listening <span lang="hi" className="deva text-lg font-normal text-muted">· सुनना</span></h1>
        <p className="text-muted">Every recording from the course. Practise with replays and slow speed, or try exam mode: one play, no pause, like the TEF.</p>
      </header>
      <LibraryList items={await libraryItems(user.id, "listening")} kind="listening" currentDay={st.todayDay} />
    </div>
  );
}
