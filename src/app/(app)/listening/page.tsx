import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { libraryItems } from "@/server/library";
import { LibraryList } from "@/components/library-list";
import { Bi } from "@/components/bi";

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
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Listening", hi: "सुनने का अभ्यास" }} /></h1>
        <Bi className="text-muted" t={{ en: "Every recording from the course. Practise with replays and slow speed, or try exam mode: one play, no pause, like the TEF.", hi: "पाठ्यक्रम की हर रिकॉर्डिंग। बार-बार सुनकर और धीमी गति से अभ्यास करें, या परीक्षा मोड आज़माएँ: TEF की तरह, सिर्फ़ एक बार सुनें, बीच में रोक नहीं।" }} />
      </header>
      <LibraryList items={await libraryItems(user.id, "listening")} kind="listening" currentDay={st.todayDay} />
    </div>
  );
}
