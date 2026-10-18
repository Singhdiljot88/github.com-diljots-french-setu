import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { getLesson } from "@/server/content";
import { toClientLesson } from "@/server/lesson-view";
import { learnerState } from "@/server/learner";
import { reviewQueue } from "@/server/words";
import { blockMinutes, itemShare, type DailyMinutes, type Pace } from "@/lib/schedule";
import { OUTLINE } from "@/content/outline";
import { LessonPlayer } from "@/components/lesson-player";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ day: string }> }) {
  return { title: `Day ${(await params).day}` };
}

export default async function LessonPage({ params }: { params: Promise<{ day: string }> }) {
  const day = Number((await params).day);
  if (!Number.isInteger(day) || day < 1 || day > 120) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const lesson = await getLesson(day);
  const outline = OUTLINE.find((o) => o.day === day)!;
  if (!lesson) {
    return (
      <div className="card space-y-2">
        <h1 className="text-xl font-bold">Day {day}: {outline.title}</h1>
        <p>The full lesson for this day is not included in this build yet. Planned content: {outline.grammar}; vocabulary: {outline.vocab}.</p>
        <Link className="underline" href="/course">Back to the course map</Link>
      </div>
    );
  }
  const st = await learnerState(user.id, profile);
  const row = st.progress.find((p) => p.day === day);
  const q = await reviewQueue(user.id, { timezone: profile.timezone, dailyMinutes: profile.dailyMinutes as DailyMinutes });
  const minutes = profile.dailyMinutes as DailyMinutes, pace = profile.pace as Pace;
  return (
    <>
      <nav className="mb-3 flex justify-between text-sm" aria-label="Lesson navigation">
        {day > 1 ? <Link className="underline" href={`/lesson/${day - 1}`}>← Day {day - 1}</Link> : <span />}
        <Link className="underline" href="/course">Course map</Link>
        {day < 120 ? <Link className="underline" href={`/lesson/${day + 1}`}>Day {day + 1} →</Link> : <span />}
      </nav>
      <LessonPlayer lesson={toClientLesson(lesson.day)} activities={row?.activities ?? {}} minutes={blockMinutes(day, minutes, pace)} share={itemShare(minutes, pace)} reviewStatus={lesson.reviewStatus} dueCount={q.cards.length} />
    </>
  );
}
