import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/server/auth";
import { checkpointReport, pacingNote, progressOverview, type CheckpointReport } from "@/server/reports";
import { CHECKPOINT_DAYS } from "@/content/outline";
import { TEF_CANADA } from "@/content/tef-config";
import { formatLocalDate } from "@/lib/dates";
import { CATEGORY_LABEL, SKILL_LABEL } from "@/lib/labels";

export const metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="h-2 w-full rounded-full surface-2" role="img" aria-label={label}>
      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ checkpoint?: string }> }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding");
  const sp = await searchParams;
  const o = await progressOverview(user.id, profile);
  const cp = Number(sp.checkpoint);
  if (CHECKPOINT_DAYS.includes(cp)) {
    const reached = o.checkpoints.find((c) => c.day === cp)!.reached;
    const { report, snapshot } = await checkpointReport(user.id, cp, reached, o.beforeStart ? 0 : o.scheduledDay);
    return <CheckpointView r={snapshot?.report ?? report} savedAt={snapshot?.createdAt ?? null} reached={reached} pacing={pacingNote(profile, o.today, o.nextIncomplete, o.scheduledDay)} />;
  }
  const maxMin = Math.max(1, ...o.last14.map((d) => d.minutes));
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Progress <span lang="hi" className="deva text-lg font-normal text-muted">· प्रगति</span></h1>
        <p className="text-muted">What you have done and how your practice answers have gone. These are your own counts, not a prediction of a TEF result.</p>
      </header>

      <section className="card space-y-3">
        <h2 className="font-semibold">Course</h2>
        <p><strong>{o.completedCount}</strong> of 120 days completed{o.beforeStart ? " · your plan has not started yet" : ` · the plan has you on day ${o.scheduledDay}`}.</p>
        <ul className="space-y-2">
          {o.phases.map((p) => (
            <li key={p.phase} className="text-sm">
              <div className="flex justify-between"><span>Phase {p.phase}: {p.en} <span lang="hi" className="deva text-muted">· {p.hi}</span></span><span className="font-mono">{p.done}/{p.total}</span></div>
              <Bar value={p.done} max={p.total} label={`${p.done} of ${p.total} days`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Study time</h2>
        <p className="text-sm">{Math.round(o.totalMinutes / 6) / 10} hours on {o.studyDays} days in total.</p>
        <div className="flex h-24 items-end gap-1" role="img" aria-label={`Minutes per day for the last 14 days: ${o.last14.map((d) => d.minutes).join(", ")}`}>
          {o.last14.map((d) => <div key={d.date} className="flex-1 rounded-t bg-brand-500" style={{ height: `${Math.max(2, (d.minutes / maxMin) * 100)}%`, opacity: d.minutes ? 1 : 0.25 }} title={`${d.date}: ${d.minutes} min`} />)}
        </div>
        <p className="text-xs text-muted">Last 14 days, minutes per day. Time is counted when you finish lesson blocks and practice activities.</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Skills</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th className="py-1 pr-2">Skill</th><th className="pr-2 text-right">Answers</th><th className="pr-2 text-right">Recent</th><th className="text-right">Before</th></tr></thead>
          <tbody>{o.skills.map((s) => <tr key={s.skill} className="border-t border-app"><td className="py-1">{SKILL_LABEL[s.skill].en} <span lang="hi" className="deva text-muted">· {SKILL_LABEL[s.skill].hi}</span></td><td className="pr-2 text-right">{s.attempts}</td><td className="pr-2 text-right">{pct(s.recentAccuracy)}</td><td className="text-right">{pct(s.previousAccuracy)}</td></tr>)}</tbody>
        </table>
        <p className="text-xs text-muted">Share of correct answers in scored practice: your last 30 answers, and the 30 before them. Speaking and writing only count where an exercise was scored, so treat those rows with care.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold">Words</h2>
          <p><strong>{o.vocab.words}</strong> words in your list · <strong>{o.vocab.retained}</strong> remembered for a week or more · {o.vocab.learning} still being learned</p>
          <Link href="/words" className="underline">My words →</Link>
        </div>
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold">Open mistakes</h2>
          {o.mistakeCounts.length === 0 ? <p>None open.</p> : <ul>{o.mistakeCounts.sort((a, b) => b.n - a.n).map((m) => <li key={m.category}>{CATEGORY_LABEL[m.category]?.en ?? m.category}: {m.n}</li>)}</ul>}
          <Link href="/mistakes" className="underline">Mistake notebook →</Link>
        </div>
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold">Production</h2>
          <p>{o.writingSubmitted} texts submitted · {o.speakingSessions} speaking sessions</p>
        </div>
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold">Practice exams</h2>
          {o.mocks.length === 0 ? <p>None yet.</p> : (
            <ul>{o.mocks.slice(0, 5).map((m) => <li key={m.id}><Link className="underline" href={`/exam/${m.id}`}>{m.title}</Link>: {m.sections.map((k) => { const s = m.scores[k]; return s && "correct" in s ? `${TEF_CANADA.sections[k].en} ${s.correct}/${s.total}` : null; }).filter(Boolean).join(" · ") || (m.status === "completed" ? "done" : "in progress")}</li>)}</ul>
          )}
          <p className="text-xs text-muted">Raw counts. Not TEF scores, CEFR or NCLC levels.</p>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Checkpoint reports</h2>
        <ul className="flex flex-wrap gap-2">
          {o.checkpoints.map((c) => <li key={c.day}><Link href={`/progress?checkpoint=${c.day}`} className={`chip ${c.reached ? "bg-brand-100 text-brand-900" : "surface-2"}`}>Day {c.day}{c.reached ? " ✓" : ""}</Link></li>)}
        </ul>
        <p className="text-xs text-muted">Each report covers the 20 days up to that checkpoint. It is saved when you first open it after finishing the checkpoint day.</p>
      </section>
    </div>
  );
}

function CheckpointView({ r, savedAt, reached, pacing }: { r: CheckpointReport; savedAt: Date | null; reached: boolean; pacing: string[] }) {
  return (
    <div className="space-y-4">
      <Link href="/progress" className="text-sm underline">← Progress</Link>
      <header>
        <h1 className="text-2xl font-bold">Checkpoint report: day {r.checkpoint}</h1>
        <p className="text-muted">Days {r.from}–{r.to}{r.phase ? ` · Phase ${r.phase.phase}: ${r.phase.en}` : ""}</p>
        <p className="text-sm">{savedAt ? `Saved on ${formatLocalDate(savedAt.toISOString().slice(0, 10))}.` : reached ? "" : "You have not finished this checkpoint day yet, so this report shows your progress so far."}</p>
      </header>

      <section className="card space-y-1 text-sm">
        <h2 className="font-semibold">Days</h2>
        <p><strong>{r.completed.length}</strong> of 20 days completed.{r.missing.length ? ` Behind the plan: ${r.missing.join(", ")}.` : ""}</p>
        {r.checkpointScore !== null && <p>Checkpoint test: <strong>{pct(r.checkpointScore)}</strong> correct.</p>}
        {r.assessments.length > 0 && (
          <div className="mt-2 flex h-20 items-end gap-1" role="img" aria-label={`Daily check scores: ${r.assessments.map((a) => `day ${a.day} ${pct(a.score)}`).join(", ")}`}>
            {r.assessments.map((a) => <div key={a.day} className="flex-1 rounded-t bg-brand-500" style={{ height: `${Math.max(4, a.score * 100)}%` }} title={`Day ${a.day}: ${pct(a.score)}`} />)}
          </div>
        )}
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">What you can do now</h2>
        {(r.canDo ?? []).length === 0 ? <p>Nothing is shown here until a day&apos;s check is done with at least 70% correct.</p> : (
          <ul className="list-disc space-y-1 pl-5">{r.canDo.map((c) => <li key={c.day}>{c.en} <span className="text-xs text-muted">(day {c.day} check: {pct(c.score)})</span><br /><span lang="hi" className="deva text-muted">{c.hi}</span></li>)}</ul>
        )}
        {(r.toRevisit ?? []).length > 0 && <>
          <h3 className="pt-1 font-medium">Finished, but the check shows more work is needed</h3>
          <ul className="list-disc space-y-1 pl-5">{r.toRevisit.map((c) => <li key={c.day}><Link href={`/lesson/${c.day}`} className="underline">Day {c.day}</Link>: {c.en} <span className="text-xs text-muted">({pct(c.score)})</span></li>)}</ul>
        </>}
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">Skills in these days</h2>
        {r.skills.length === 0 ? <p>No scored answers in these days yet.</p> : (
          <table className="w-full"><thead><tr className="text-left text-muted"><th>Skill</th><th>Answers</th><th>Correct</th></tr></thead>
            <tbody>{r.skills.map((s) => <tr key={s.skill} className="border-t border-app"><td className="py-1">{SKILL_LABEL[s.skill].en}</td><td>{s.attempts}</td><td>{pct(s.accuracy)}</td></tr>)}</tbody></table>
        )}
        <p>Words from these lessons: <strong>{r.vocab.words}</strong>, of which <strong>{r.vocab.retained}</strong> are remembered for a week or more.</p>
        <p>Writing tasks submitted: {r.writingSubmitted} · role-plays practised: {r.speakingSessions}</p>
      </section>

      {r.topMistakes.length > 0 && (
        <section className="card space-y-2 text-sm">
          <h2 className="font-semibold">Errors that keep coming back</h2>
          <ul className="space-y-1">{r.topMistakes.map((m) => <li key={m.id}><span className="chip surface-2 mr-1">{CATEGORY_LABEL[m.category]?.en ?? m.category}</span><span lang="fr" className="line-through">{m.original}</span> → <span lang="fr" className="font-medium">{m.corrected}</span>{m.occurrences > 1 ? ` (${m.occurrences}×)` : ""}</li>)}</ul>
        </section>
      )}

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">What to do next</h2>
        <ul className="list-disc space-y-1 pl-5">{r.next.map((n, i) => <li key={i}>{n.text} <Link href={n.href} className="underline">Go →</Link></li>)}</ul>
        <p className="text-xs text-muted">Suggestions from simple rules applied to your own numbers. This report does not estimate a TEF score or level.</p>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">Exam date and workload</h2>
        <ul className="list-disc space-y-1 pl-5">{pacing.map((n, i) => <li key={i}>{n}</li>)}</ul>
        <Link href="/settings" className="underline">Change daily time or exam date →</Link>
      </section>
    </div>
  );
}
