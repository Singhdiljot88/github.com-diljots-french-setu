import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { getLesson } from "@/server/content";
import { reviewQueue, vocabularyStats } from "@/server/words";
import { skillStats, topMistakes } from "@/server/stats";
import { adaptations } from "@/server/adapt";
import { BLOCK_LABELS, blockMinutes, blocksForPart, partsPerLesson, type DailyMinutes, type Pace } from "@/lib/schedule";
import { PHASES, isCheckpointDay } from "@/content/outline";
import { diffDays, formatLocalDate } from "@/lib/dates";
import { RecoveryCard } from "@/components/recovery";
import { Bi } from "@/components/bi";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

const SKILL_LABEL: Record<string, string> = { listening: "Listening", reading: "Reading", speaking: "Speaking", writing: "Writing", vocabulary: "Vocabulary", grammar: "Grammar", pronunciation: "Pronunciation" };

export default async function Today() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const st = await learnerState(user.id, profile);
  const day = st.todayDay;
  const lesson = await getLesson(day);
  const minutes = profile.dailyMinutes as DailyMinutes;
  const pace = profile.pace as Pace;
  const parts = partsPerLesson(minutes, pace);
  const part = st.slot.beforeStart ? 1 : st.slot.part;
  const blocks = blocksForPart(parts, Math.min(part, parts));
  const mins = blockMinutes(day, minutes, pace);
  const progressRow = st.progress.find((p) => p.day === day);
  const done = progressRow?.activities ?? {};
  const planned = blocks.reduce((s, b) => s + mins[b], 0);
  const queue = await reviewQueue(user.id, { timezone: profile.timezone, dailyMinutes: minutes });
  const vocab = await vocabularyStats(user.id);
  const skills = (await skillStats(user.id)).filter((s) => ["listening", "reading", "speaking", "writing"].includes(s.skill));
  const mistakesTop = await topMistakes(user.id, 3);
  const extra = await adaptations(user.id, day);
  const phase = PHASES.find((p) => day >= p.from && day <= p.to)!;
  const completedCount = st.completed.size;
  const nextBlock = blocks.find((b) => !done[b]);
  const lessonDone = progressRow?.status === "completed";

  let next: { href: string; en: string; hi: string };
  if (queue.cards.length > 0 && !done.review) next = { href: "/review", en: `Start with spaced review (${queue.cards.length} cards)`, hi: `दोहराई से शुरू कीजिए (${queue.cards.length} कार्ड)` };
  else if (nextBlock) next = { href: `/lesson/${day}#${nextBlock}`, en: `Continue Day ${day}: ${BLOCK_LABELS[nextBlock].en}`, hi: `दिन ${day} जारी रखिए: ${BLOCK_LABELS[nextBlock].hi}` };
  else if (extra[0]) next = { href: extra[0].href, en: extra[0].en, hi: extra[0].hi };
  else if (lessonDone && day < 120) next = { href: `/lesson/${day + 1}`, en: `Today's plan is done. You can preview Day ${day + 1} or practise freely.`, hi: `आज की योजना पूरी हो गई। आप दिन ${day + 1} देख सकते हैं या खुलकर अभ्यास कर सकते हैं।` };
  else next = { href: "/speaking", en: "Practise speaking with the tutor", hi: "ट्यूटर के साथ बोलने का अभ्यास कीजिए" };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{formatLocalDate(st.today)} · {profile.timezone}</p>
        <h1 className="text-2xl font-bold">{profile.displayName ? `Bonjour, ${profile.displayName} !` : "Bonjour !"}</h1>
        <p className="text-muted">Day <strong className="text-[var(--text)]">{day}</strong> of 120 · Phase {phase.phase}: {phase.en} <span lang="hi" className="deva">({phase.hi})</span>{isCheckpointDay(day) && <span className="chip ml-2 bg-brand-100 text-brand-900">Checkpoint</span>}</p>
        {st.slot.beforeStart && <p className="mt-2 rounded-lg surface-2 p-2 text-sm">Your plan starts on {formatLocalDate(profile.startDate)}. You can already look at Day {day}.</p>}
      </header>

      {st.recovery && <RecoveryCard plan={st.recovery} />}

      <section className="card bg-brand-50 dark:bg-brand-900/30" aria-labelledby="next-h">
        <h2 id="next-h" className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">Recommended next</h2>
        <Bi t={next} className="mt-1 text-lg font-medium" />
        <Link href={next.href} className="btn btn-primary mt-3">Go</Link>
      </section>

      <section className="card" aria-labelledby="tasks-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tasks-h" className="text-lg font-semibold">Today&apos;s tasks {parts > 1 && <span className="text-sm font-normal text-muted">(part {part} of {parts} of this lesson)</span>}</h2>
          <p className="text-sm text-muted">Planned {planned} min · studied {Math.round(st.minutesToday)} min</p>
        </div>
        {lesson ? (
          <>
            <p className="mt-1"><Link className="font-medium underline" href={`/lesson/${day}`}>{lesson.day.title.en}</Link> <span lang="hi" className="deva text-muted">· {lesson.day.title.hi}</span></p>
            <Bi t={lesson.day.objective} className="mt-1 text-sm text-muted" />
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {blocks.map((b) => (
                <li key={b} className="flex items-center gap-3 py-2">
                  <span aria-hidden className={`grid size-6 place-items-center rounded-full text-xs ${done[b] ? "bg-brand-600 text-white" : "border border-app"}`}>{done[b] ? "✓" : ""}</span>
                  <Link href={b === "review" ? "/review" : `/lesson/${day}#${b}`} className="flex-1 hover:underline">
                    <Bi as="span" t={BLOCK_LABELS[b]} />
                  </Link>
                  <span className="text-sm text-muted">{mins[b] > 0 ? `${mins[b]} min` : "optional"}</span>
                  <span className="sr-only">{done[b] ? "completed" : "not completed"}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm">The full lesson for Day {day} is not available in this build yet. See the <Link className="underline" href="/course">course map</Link>.</p>
        )}
      </section>

      {extra.length > 0 && (
        <section className="card" aria-labelledby="extra-h">
          <h2 id="extra-h" className="font-semibold">Adjusted for you</h2>
          <p className="text-sm text-muted">Extra practice based on your recent answers. Your course plan stays the same.</p>
          <ul className="mt-2 space-y-2">{extra.map((x) => <li key={x.key}><Link className="underline" href={x.href}><Bi as="span" t={x} /></Link> <span className="text-xs text-muted">({x.reason})</span></li>)}</ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card" aria-labelledby="review-h">
          <h2 id="review-h" className="font-semibold">Review queue</h2>
          <p className="text-3xl font-bold">{queue.cards.length}</p>
          <p className="text-sm text-muted">{queue.dueTotal} due · {queue.newLimitRemaining} new allowed today · {queue.newWaiting} new waiting</p>
          {queue.overdueCapped && <p className="mt-1 text-sm">You have a backlog, so today&apos;s reviews are capped to keep things manageable.</p>}
          <Link href="/review" className="btn btn-secondary btn-sm mt-2">Review now</Link>
        </section>
        <section className="card" aria-labelledby="vocab-h">
          <h2 id="vocab-h" className="font-semibold">Vocabulary</h2>
          <p className="text-3xl font-bold">{vocab.retained}<span className="text-base font-normal text-muted"> retained</span></p>
          <p className="text-sm text-muted">of {vocab.words} saved words and phrases. “Retained” means recalled with an interval of 7+ days.</p>
        </section>
      </div>

      <section className="card" aria-labelledby="skills-h">
        <h2 id="skills-h" className="font-semibold">Skills — demonstrated, not just completed</h2>
        <p className="text-sm text-muted">Lessons completed: {completedCount} of 120. Below is accuracy on your recent scored answers, which is separate from completion.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {skills.map((s) => (
            <li key={s.skill} className="rounded-xl surface-2 p-3">
              <p className="font-medium">{SKILL_LABEL[s.skill]}</p>
              {s.recentAccuracy === null ? <p className="text-sm text-muted">Not enough evidence yet ({s.attempts} attempts).</p> : (
                <>
                  <div className="mt-1 h-2 rounded-full bg-[var(--border)]" role="img" aria-label={`${Math.round(s.recentAccuracy * 100)}% recent accuracy`}><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.round(s.recentAccuracy * 100)}%` }} /></div>
                  <p className="mt-1 text-sm">{Math.round(s.recentAccuracy * 100)}% on recent answers{s.previousAccuracy !== null && <> · before: {Math.round(s.previousAccuracy * 100)}% {s.recentAccuracy > s.previousAccuracy + 0.05 ? "— improving" : ""}</>}</p>
                </>
              )}
              {(s.skill === "speaking" || s.skill === "writing") && <p className="text-xs text-muted">Speaking and writing are judged from feedback on your texts and conversations, not percentages alone.</p>}
            </li>
          ))}
        </ul>
        <Link href="/progress" className="mt-3 inline-block text-sm underline">See full progress and checkpoint reports</Link>
      </section>

      {mistakesTop.length > 0 && (
        <section className="card" aria-labelledby="mist-h">
          <h2 id="mist-h" className="font-semibold">Recurring mistakes</h2>
          <ul className="mt-2 space-y-1 text-sm">{mistakesTop.map((m) => <li key={m.id}><span className="chip surface-2 mr-2">{m.category}</span><span lang="fr" className="line-through decoration-red-500">{m.original.slice(0, 60)}</span> → <span lang="fr" className="font-medium">{m.corrected.slice(0, 60)}</span> {m.occurrences > 1 && <span className="text-muted">×{m.occurrences}</span>}</li>)}</ul>
          <Link href="/mistakes" className="mt-2 inline-block text-sm underline">Open the mistake notebook</Link>
        </section>
      )}

      {profile.examDate && (
        <p className="text-sm text-muted">Exam date: {formatLocalDate(profile.examDate)} ({diffDays(st.today, profile.examDate)} days away). French Setu does not estimate exam readiness as a percentage; checkpoint reports show evidence instead.</p>
      )}
    </div>
  );
}
