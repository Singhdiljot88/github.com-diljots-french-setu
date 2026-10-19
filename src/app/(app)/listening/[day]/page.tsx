import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson } from "@/server/content";
import { toClientLesson } from "@/server/lesson-view";
import { ListeningBlock } from "@/components/lesson-player";
import { ExamListening } from "@/components/exam-listening";
import { Bi } from "@/components/bi";

export const dynamic = "force-dynamic";

export default async function ListeningItem({ params, searchParams }: { params: Promise<{ day: string }>; searchParams: Promise<{ mode?: string }> }) {
  const day = Number((await params).day);
  const exam = (await searchParams).mode === "exam";
  const l = Number.isInteger(day) ? await getLesson(day) : null;
  if (!l) notFound();
  const d = toClientLesson(l.day);
  return (
    <div className="space-y-4">
      <Link href="/listening" className="text-sm underline">← <Bi as="span" t={{ en: "Listening", hi: "सुनने का अभ्यास" }} /></Link>
      <header>
        <Bi className="text-sm text-muted" t={{ en: `Day ${day} · ${d.title.en}`, hi: `दिन ${day} · ${d.title.hi}` }} />
        <h1 className="text-2xl font-bold" lang="fr">{d.listening.title.fr}</h1>
      </header>
      <nav className="flex gap-2" aria-labelledby="mode-h">
        <h2 id="mode-h" className="sr-only"><Bi as="span" t={{ en: "Mode", hi: "मोड" }} /></h2>
        <Link href={`/listening/${day}`} className={`btn btn-sm ${exam ? "btn-secondary" : "btn-primary"}`} aria-current={!exam ? "page" : undefined}><Bi as="span" t={{ en: "Practice", hi: "अभ्यास" }} /></Link>
        <Link href={`/listening/${day}?mode=exam`} className={`btn btn-sm ${exam ? "btn-primary" : "btn-secondary"}`} aria-current={exam ? "page" : undefined}><Bi as="span" t={{ en: "Exam mode", hi: "परीक्षा मोड" }} /></Link>
      </nav>
      <div className="card">{exam ? <ExamListening key="exam" d={d} /> : <ListeningBlock d={d} share={1} />}</div>
    </div>
  );
}
