import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson } from "@/server/content";
import { toClientLesson } from "@/server/lesson-view";
import { ReadingBlock } from "@/components/lesson-player";
import { PaceTimer } from "@/components/pace-timer";
import { Bi } from "@/components/bi";

export const dynamic = "force-dynamic";

export default async function ReadingItem({ params, searchParams }: { params: Promise<{ day: string }>; searchParams: Promise<{ mode?: string }> }) {
  const day = Number((await params).day);
  const timed = (await searchParams).mode === "timed";
  const l = Number.isInteger(day) ? await getLesson(day) : null;
  if (!l) notFound();
  const d = toClientLesson(l.day);
  // TEF reading: 40 questions in 60 minutes, about 90 seconds per question including reading time
  const seconds = d.reading.questions.length * 90;
  return (
    <div className="space-y-4">
      <Link href="/reading" className="text-sm underline">← <Bi as="span" t={{ en: "Reading", hi: "पढ़ने का अभ्यास" }} /></Link>
      <header>
        <Bi className="text-sm text-muted" t={{ en: `Day ${day} · ${d.title.en}`, hi: `दिन ${day} · ${d.title.hi}` }} />
        <h1 className="text-2xl font-bold" lang="fr">{d.reading.title}</h1>
      </header>
      <nav className="flex gap-2" aria-labelledby="mode-h">
        <h2 id="mode-h" className="sr-only"><Bi as="span" t={{ en: "Mode", hi: "मोड" }} /></h2>
        <Link href={`/reading/${day}`} className={`btn btn-sm ${timed ? "btn-secondary" : "btn-primary"}`}><Bi as="span" t={{ en: "Practice", hi: "अभ्यास" }} /></Link>
        <Link href={`/reading/${day}?mode=timed`} className={`btn btn-sm ${timed ? "btn-primary" : "btn-secondary"}`}><Bi as="span" t={{ en: "Timed (exam pace)", hi: "समय सीमा के साथ (परीक्षा की गति)" }} /></Link>
      </nav>
      {timed && <PaceTimer seconds={seconds} note={{ en: `About 90 seconds per question, the TEF reading pace (${d.reading.questions.length} questions).`, hi: `हर प्रश्न के लिए लगभग 90 सेकंड, TEF में पढ़ने की गति (${d.reading.questions.length} प्रश्न)।` }} />}
      <div className="card"><ReadingBlock d={d} share={1} /></div>
    </div>
  );
}
