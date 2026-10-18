import { allLessons } from "@/server/content";
import { speakingCatalog } from "@/server/speaking";
import { SpeakingTutor } from "@/components/speaking-tutor";

export const metadata = { title: "Speaking tutor" };
export const dynamic = "force-dynamic";

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ scenario?: string; mode?: string }> }) {
  const sp = await searchParams;
  const roleplays = [...(await allLessons()).values()].filter((l) => l.day.speaking.scenario).map((l) => ({ id: `day:${l.day.day}`, title: { en: `Day ${l.day.day}: ${l.day.title.en}`, hi: l.day.title.hi } })).sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)));
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Speaking tutor <span lang="hi" className="deva text-lg font-normal text-muted">· बोलने का अभ्यास</span></h1>
        <p className="text-muted">Practise real conversations: role-plays from your lessons, everyday chats, and the two TEF speaking tasks.</p>
      </header>
      <SpeakingTutor catalog={{ ...speakingCatalog(), roleplays }} initial={sp.scenario ? { mode: "roleplay", ref: sp.scenario } : undefined} />
    </div>
  );
}
