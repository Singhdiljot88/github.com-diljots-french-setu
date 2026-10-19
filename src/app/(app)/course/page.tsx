import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState, scheduleInput } from "@/server/learner";
import { courseMap } from "@/server/content";
import { CHECKPOINT_DAYS, MOCK_DAYS, PHASES, isLightDay } from "@/content/outline";
import { dateForDay } from "@/lib/schedule";
import { formatLocalDate } from "@/lib/dates";
import { Bi } from "@/components/bi";

export const metadata = { title: "Course map" };
export const dynamic = "force-dynamic";

type State = "done" | "today" | "started" | "missed" | "upcoming";
const STATE_STYLE: Record<State, { icon: string; label: { en: string; hi: string }; cls: string }> = {
  done: { icon: "✓", label: { en: "Done", hi: "पूरा" }, cls: "bg-brand-600 text-white" },
  today: { icon: "●", label: { en: "Today", hi: "आज" }, cls: "bg-amber-400 text-black" },
  started: { icon: "◐", label: { en: "Started", hi: "शुरू किया" }, cls: "bg-brand-100 text-brand-900" },
  missed: { icon: "!", label: { en: "Behind schedule", hi: "योजना से पीछे" }, cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100" },
  upcoming: { icon: "", label: { en: "Upcoming", hi: "आने वाला" }, cls: "surface-2 text-muted" },
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
  const label = (t: { en: string; hi: string }) => (profile.explanationLang === "hi" ? t.hi : profile.explanationLang === "both" ? `${t.en} · ${t.hi}` : t.en);

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
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Course map", hi: "पाठ्यक्रम" }} /></h1>
        <Bi className="text-muted" t={{ en: `${st.completed.size} of 120 days done · ${available} of 120 lessons available in this build.`, hi: `120 में से ${st.completed.size} दिन पूरे · इस संस्करण में 120 में से ${available} पाठ उपलब्ध।` }} />
        <ul className="mt-2 flex flex-wrap gap-2 text-xs" aria-label={label({ en: "Legend", hi: "संकेत" })}>
          {(Object.keys(STATE_STYLE) as State[]).map((k) => <li key={k} className="flex items-center gap-1"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${STATE_STYLE[k].cls}`} aria-hidden>{STATE_STYLE[k].icon}</span><Bi as="span" t={STATE_STYLE[k].label} /></li>)}
          <li className="chip">🌙 <Bi as="span" t={{ en: "Light day", hi: "हल्का दिन" }} /></li><li className="chip">🏁 <Bi as="span" t={{ en: "Checkpoint", hi: "चेकपॉइंट" }} /></li><li className="chip">📝 <Bi as="span" t={{ en: "Mock exam", hi: "मॉक परीक्षा" }} /></li>
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
                <h2 className="text-lg font-semibold"><Bi as="span" t={{ en: `Phase ${ph.phase}: ${ph.en}`, hi: `चरण ${ph.phase}: ${ph.hi}` }} /></h2>
                <Bi as="span" className="text-sm text-muted" t={{ en: `Days ${ph.from}–${ph.to} · ${done}/${days.length} done`, hi: `दिन ${ph.from}–${ph.to} · ${done}/${days.length} पूरे` }} />
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full surface-2" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={days.length} aria-label={label({ en: `Phase ${ph.phase} progress`, hi: `चरण ${ph.phase} की प्रगति` })}>
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
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.cls}`} aria-label={label(style.label)}>{style.icon || d.day}</span>
                      <span className="min-w-0 flex-1">
                        <Bi as="span" className="block font-medium" t={{ en: `Day ${d.day}: ${d.title}`, hi: `दिन ${d.day}: ${d.titleHi ?? d.title}` }} />
                        {d.titleFr && <span className="block text-sm text-muted" lang="fr">{d.titleFr}</span>}
                        <span className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted">
                          {date && <span>{formatLocalDate(date)}</span>}
                          {isLightDay(d.day) && <span className="chip">🌙 <Bi as="span" t={{ en: "Light", hi: "हल्का" }} /></span>}
                          {CHECKPOINT_DAYS.includes(d.day) && <span className="chip">🏁 <Bi as="span" t={{ en: "Checkpoint", hi: "चेकपॉइंट" }} /></span>}
                          {mock && <span className="chip">📝 <Bi as="span" t={{ en: mock.id.replace("mock-", "Mock "), hi: mock.id.replace("mock-", "मॉक ") }} /></span>}
                          {!d.available && <Bi as="span" className="chip" t={{ en: "Outline only", hi: "सिर्फ़ रूपरेखा" }} />}
                          {p?.assessmentScore != null && <Bi as="span" className="chip" t={{ en: `Check: ${Math.round(p.assessmentScore * 100)}%`, hi: `जाँच: ${Math.round(p.assessmentScore * 100)}%` }} />}
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
