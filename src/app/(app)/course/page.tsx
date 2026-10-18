import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState, scheduleInput } from "@/server/learner";
import { courseMap } from "@/server/content";
import { CHECKPOINT_DAYS, MOCK_DAYS, PHASES, isLightDay } from "@/content/outline";
import { dateForDay } from "@/lib/schedule";
import { formatLocalDate } from "@/lib/dates";

export const metadata = { title: "Course map" };
export const dynamic = "force-dynamic";

type State = "done" | "today" | "started" | "missed" | "upcoming";
const STATE_STYLE: Record<State, { icon: string; label: string; cls: string }> = {
  done: { icon: "✓", label: "Done", cls: "bg-brand-600 text-white" },
  today: { icon: "●", label: "Today", cls: "bg-amber-400 text-black" },
  started: { icon: "◐", label: "Started", cls: "bg-brand-100 text-brand-900" },
  missed: { icon: "!", label: "Behind schedule", cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100" },
  upcoming: { icon: "", label: "Upcoming", cls: "surface-2 text-muted" },
};

export default async function CoursePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const st = await learnerState(user.id, profile);
  const s = scheduleInput(profile);
  const map = await courseMap();
  const prog = new Map(st.progress.map((p) => [p.day, p]));
  const available = map.filter((d) => d.available).length;

  const stateOf = (day: number): State => {
    const p = prog.get(day);
    if (p?.status === "completed") return "done";
    if (day === st.todayDay) return "today";
    if (p) return "started";
    if (day >= profile.placementDay && day < st.scheduledDay && !st.slot.beforeStart) return "missed";
    return "upcoming";
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Course map <span lang="hi" className="deva text-lg font-normal text-muted">· कोर्स नक्शा</span></h1>
        <p className="text-muted">{st.completed.size} of 120 days done · {available} of 120 lessons available in this build.</p>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs" aria-label="Legend">
          {(Object.keys(STATE_STYLE) as State[]).map((k) => <li key={k} className="flex items-center gap-1"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${STATE_STYLE[k].cls}`} aria-hidden>{STATE_STYLE[k].icon}</span>{STATE_STYLE[k].label}</li>)}
          <li className="chip">🌙 Light day</li><li className="chip">🏁 Checkpoint</li><li className="chip">📝 Mock exam</li>
        </ul>
      </header>
      {PHASES.map((ph) => {
        const days = map.filter((d) => d.day >= ph.from && d.day <= ph.to);
        const done = days.filter((d) => prog.get(d.day)?.status === "completed").length;
        const open = st.todayDay >= ph.from && st.todayDay <= ph.to;
        return (
          <details key={ph.phase} className="card" open={open}>
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Phase {ph.phase}: {ph.en} <span lang="hi" className="deva font-normal text-muted">({ph.hi})</span></h2>
                <span className="text-sm text-muted">Days {ph.from}–{ph.to} · {done}/{days.length} done</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full surface-2" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={days.length} aria-label={`Phase ${ph.phase} progress`}>
                <div className="h-full bg-brand-600" style={{ width: `${(done / days.length) * 100}%` }} />
              </div>
            </summary>
            <ol className="mt-3 divide-y divide-[var(--border)]">
              {days.map((d) => {
                const state = stateOf(d.day);
                const style = STATE_STYLE[state];
                const p = prog.get(d.day);
                const mock = MOCK_DAYS[d.day];
                const date = d.day >= profile.placementDay ? dateForDay(s, d.day) : null;
                return (
                  <li key={d.day}>
                    <Link href={`/lesson/${d.day}`} className="flex items-start gap-3 py-2 hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] rounded-lg px-1">
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.cls}`} aria-label={style.label}>{style.icon || d.day}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">Day {d.day}: {d.title}</span>
                        {d.titleFr && <span className="block text-sm text-muted" lang="fr">{d.titleFr}</span>}
                        <span className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted">
                          {date && <span>{formatLocalDate(date)}</span>}
                          {isLightDay(d.day) && <span className="chip">🌙 Light</span>}
                          {CHECKPOINT_DAYS.includes(d.day) && <span className="chip">🏁 Checkpoint</span>}
                          {mock && <span className="chip">📝 {mock.id.replace("mock-", "Mock ")}</span>}
                          {!d.available && <span className="chip">Outline only</span>}
                          {p?.assessmentScore != null && <span className="chip">Check: {Math.round(p.assessmentScore * 100)}%</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
