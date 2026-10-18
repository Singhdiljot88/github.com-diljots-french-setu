import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { libraryItems } from "@/server/library";
import { LibraryList } from "@/components/library-list";

export const metadata = { title: "Reading" };
export const dynamic = "force-dynamic";

export default async function ReadingLibrary() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const st = await learnerState(user.id, profile);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Reading <span lang="hi" className="deva text-lg font-normal text-muted">· पढ़ना</span></h1>
        <p className="text-muted">Every text from the course: signs, messages, emails, articles. Tap any word to look it up. Timed mode helps you practise exam pace.</p>
      </header>
      <LibraryList items={await libraryItems(user.id, "reading")} kind="reading" currentDay={st.todayDay} />
    </div>
  );
}
