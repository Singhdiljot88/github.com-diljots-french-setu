import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson } from "@/server/content";
import { toClientLesson } from "@/server/lesson-view";
import { ReadingBlock } from "@/components/lesson-player";
import { PaceTimer } from "@/components/pace-timer";

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
      <Link href="/reading" className="text-sm underline">← Reading</Link>
      <header>
        <p className="text-sm text-muted">Day {day} · {d.title.en}</p>
        <h1 className="text-2xl font-bold" lang="fr">{d.reading.title}</h1>
      </header>
      <nav className="flex gap-2" aria-label="Mode">
        <Link href={`/reading/${day}`} className={`btn btn-sm ${timed ? "btn-secondary" : "btn-primary"}`}>Practice</Link>
        <Link href={`/reading/${day}?mode=timed`} className={`btn btn-sm ${timed ? "btn-primary" : "btn-secondary"}`}>Timed (exam pace)</Link>
      </nav>
      {timed && <PaceTimer seconds={seconds} note={`About 90 seconds per question, the TEF reading pace (${d.reading.questions.length} questions).`} />}
      <div className="card"><ReadingBlock d={d} share={1} /></div>
    </div>
  );
}
