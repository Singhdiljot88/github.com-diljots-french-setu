import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { libraryItems } from "@/server/library";
import { LibraryList } from "@/components/library-list";
import { Bi } from "@/components/bi";

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
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Reading", hi: "पढ़ने का अभ्यास" }} /></h1>
        <Bi className="text-muted" t={{ en: "Every text from the course: signs, messages, emails, articles. Tap any word to look it up. Timed mode helps you practise exam pace.", hi: "पाठ्यक्रम का हर पाठ: सूचना-पट, संदेश, ईमेल, लेख। किसी भी शब्द पर टैप करके उसका अर्थ देखें। समय सीमा वाला मोड परीक्षा की गति से अभ्यास में मदद करता है।" }} />
      </header>
      <LibraryList items={await libraryItems(user.id, "reading")} kind="reading" currentDay={st.todayDay} />
    </div>
  );
}
