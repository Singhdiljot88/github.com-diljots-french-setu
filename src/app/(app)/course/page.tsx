import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState, scheduleInput } from "@/server/learner";
import { courseMap } from "@/server/content";
import { CHECKPOINT_DAYS, MOCK_DAYS, PHASES, isLightDay } from "@/content/outline";
import { dateForDay } from "@/lib/schedule";
import { formatLocalDate } from "@/lib/dates";
import { Bi } from "@/components/bi";
import { CourseBrowser, type CoursePhase } from "@/components/course-browser";

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
      <CourseBrowser todayDay={st.todayDay} phases={PHASES.map((ph): CoursePhase => {
        const days = map.filter((d) => d.day >= ph.from && d.day <= ph.to);
        return {
          phase: ph.phase, en: ph.en, hi: ph.hi, from: ph.from, to: ph.to,
          done: days.filter((d) => prog.get(d.day)?.status === "completed").length,
          open: st.todayDay >= ph.from && st.todayDay <= ph.to,
          days: days.map((d) => {
            const p = prog.get(d.day);
            const date = d.day >= profile.placementDay ? dateForDay(s, d.day) : null;
            return {
              day: d.day, titleEn: d.title, titleHi: d.titleHi ?? d.title, titleFr: d.titleFr ?? null,
              state: stateOf(d.day), dateLabel: date ? formatLocalDate(date) : null,
              light: isLightDay(d.day), checkpoint: CHECKPOINT_DAYS.includes(d.day),
              mock: MOCK_DAYS[d.day]?.id ?? null, available: d.available,
              score: p?.assessmentScore ?? null,
            };
          }),
        };
      })} />
    </div>
  );
}
