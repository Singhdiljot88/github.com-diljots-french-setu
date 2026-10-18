import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson } from "@/server/content";
import { toClientLesson } from "@/server/lesson-view";
import { ListeningBlock } from "@/components/lesson-player";
import { ExamListening } from "@/components/exam-listening";

export const dynamic = "force-dynamic";

export default async function ListeningItem({ params, searchParams }: { params: Promise<{ day: string }>; searchParams: Promise<{ mode?: string }> }) {
  const day = Number((await params).day);
  const exam = (await searchParams).mode === "exam";
  const l = Number.isInteger(day) ? await getLesson(day) : null;
  if (!l) notFound();
  const d = toClientLesson(l.day);
  return (
    <div className="space-y-4">
      <Link href="/listening" className="text-sm underline">← Listening</Link>
      <header>
        <p className="text-sm text-muted">Day {day} · {d.title.en}</p>
        <h1 className="text-2xl font-bold" lang="fr">{d.listening.title.fr}</h1>
      </header>
      <nav className="flex gap-2" aria-label="Mode">
        <Link href={`/listening/${day}`} className={`btn btn-sm ${exam ? "btn-secondary" : "btn-primary"}`} aria-current={!exam ? "page" : undefined}>Practice</Link>
        <Link href={`/listening/${day}?mode=exam`} className={`btn btn-sm ${exam ? "btn-primary" : "btn-secondary"}`} aria-current={exam ? "page" : undefined}>Exam mode</Link>
      </nav>
      <div className="card">{exam ? <ExamListening key="exam" d={d} /> : <ListeningBlock d={d} share={1} />}</div>
    </div>
  );
}
