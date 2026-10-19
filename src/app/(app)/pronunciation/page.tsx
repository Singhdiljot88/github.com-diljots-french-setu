import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { allLessons } from "@/server/content";
import { loadPronunciationFromDisk } from "@/content/load";
import { PronunciationLab, type ShadowLine } from "@/components/pronunciation-lab";
import type { SayItem } from "@/components/say-it";
import { Bi } from "@/components/bi";

export const metadata = { title: "Pronunciation lab" };
export const dynamic = "force-dynamic";

export default async function PronunciationPage({ searchParams }: { searchParams: Promise<{ sound?: string; tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const st = await learnerState(user.id, profile);
  const content = loadPronunciationFromDisk();
  // Shadowing uses dialogue lines from lessons the learner has reached, newest first.
  const lines: ShadowLine[] = [];
  for (const { day } of [...(await allLessons()).values()].filter((l) => l.day.day <= Math.max(st.todayDay, 3)).sort((a, b) => b.day.day - a.day.day)) {
    for (const l of day.listening.lines) if (l.fr.split(" ").length <= 16) lines.push({ day: day.day, fr: l.fr, en: l.en, hi: l.hi, voice: l.voice });
    if (lines.length >= 60) break;
  }
  // "Say it" practises the phrases and words of every lesson reached so far.
  const say: SayItem[] = [];
  for (const { day } of [...(await allLessons()).values()].filter((l) => l.day.day <= Math.max(st.todayDay, 1))) {
    for (const p of [...day.phrases, ...day.vocabulary]) say.push({ day: day.day, fr: p.fr, en: p.en, hi: p.hi, pron: p.pron });
  }
  const sp = await searchParams;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Pronunciation lab", hi: "उच्चारण लैब" }} /></h1>
        <Bi className="text-muted" t={{ en: "The sounds of French explained for Hindi and English speakers. Listen, record yourself, and compare by ear.", hi: "हिंदी और अंग्रेज़ी बोलने वालों के लिए फ़्रेंच की ध्वनियाँ, समझाकर। सुनें, अपनी आवाज़ रिकॉर्ड करें, और कान से तुलना करें।" }} />
      </header>
      <PronunciationLab content={content} shadow={lines} say={say} today={st.todayDay} initialSound={sp.sound} initialTab={sp.tab} />
    </div>
  );
}
