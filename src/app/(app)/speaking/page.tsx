import { allLessons } from "@/server/content";
import { speakingCatalog } from "@/server/speaking";
import { SpeakingTutor } from "@/components/speaking-tutor";
import { Bi } from "@/components/bi";

export const metadata = { title: "Speaking tutor" };
export const dynamic = "force-dynamic";

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ scenario?: string; mode?: string }> }) {
  const sp = await searchParams;
  const roleplays = [...(await allLessons()).values()].filter((l) => l.day.speaking.scenario).map((l) => ({ id: `day:${l.day.day}`, title: { en: `Day ${l.day.day}: ${l.day.title.en}`, hi: `दिन ${l.day.day}: ${l.day.title.hi}` } })).sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)));
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Speaking tutor", hi: "बोलने का अभ्यास" }} /></h1>
        <Bi className="text-muted" t={{ en: "Practise real conversations: role-plays from your lessons, everyday chats, and the two TEF speaking tasks.", hi: "असली बातचीत का अभ्यास करें: आपके पाठों के रोल-प्ले, रोज़मर्रा की बातचीत, और TEF के बोलने वाले दोनों कार्य।" }} />
      </header>
      <SpeakingTutor catalog={{ ...speakingCatalog(), roleplays }} initial={sp.scenario ? { mode: "roleplay", ref: sp.scenario } : undefined} />
    </div>
  );
}
