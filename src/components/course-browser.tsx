"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { matchesDayQuery } from "@/lib/jump";
import { Bi, useBiLabel } from "./bi";

export type CourseDay = {
  day: number;
  titleEn: string;
  titleHi: string;
  titleFr: string | null;
  state: "done" | "today" | "started" | "missed" | "upcoming";
  dateLabel: string | null;
  light: boolean;
  checkpoint: boolean;
  mock: string | null;
  available: boolean;
  score: number | null;
};

export type CoursePhase = {
  phase: number;
  en: string;
  hi: string;
  from: number;
  to: number;
  done: number;
  open: boolean;
  days: CourseDay[];
};

const STATE_STYLE: Record<CourseDay["state"], { icon: string; label: { en: string; hi: string }; cls: string }> = {
  done: { icon: "✓", label: { en: "Done", hi: "पूरा" }, cls: "bg-brand-600 text-white" },
  today: { icon: "●", label: { en: "Today", hi: "आज" }, cls: "bg-amber-400 text-black" },
  started: { icon: "◐", label: { en: "Started", hi: "शुरू किया" }, cls: "bg-brand-100 text-brand-900" },
  missed: { icon: "!", label: { en: "Behind schedule", hi: "योजना से पीछे" }, cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100" },
  upcoming: { icon: "", label: { en: "Upcoming", hi: "आने वाला" }, cls: "surface-2 text-muted" },
};

/** Searchable course map: filter 120 days by number or title, and jump back to today. */
export function CourseBrowser({ phases, todayDay }: { phases: CoursePhase[]; todayDay: number }) {
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const L = useBiLabel();
  const query = q.trim();
  const matches = phases.flatMap((p) => p.days.filter((d) => matchesDayQuery(d, query)).map((d) => ({ phase: p, day: d })));

  const jumpToday = () => {
    setQ("");
    requestAnimationFrame(() => {
      const el = root.current?.querySelector<HTMLElement>(`#day-${todayDay}`);
      const details = el?.closest("details");
      if (details) details.open = true;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div ref={root} className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-sm font-medium" htmlFor="course-q">
          {L({ en: "Find a day", hi: "कोई दिन खोजें" })}
          <input id="course-q" name="course-q" type="search" className="input mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ en: "12, bonjour, numbers…", hi: "12, bonjour, संख्याएँ…" })} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={jumpToday}>{L({ en: `Jump to Day ${todayDay}`, hi: `दिन ${todayDay} पर जाएँ` })}</button>
      </div>
      <p className="sr-only" aria-live="polite">{query ? L({ en: `${matches.length} days match`, hi: `${matches.length} दिन मिले` }) : ""}</p>

      {query ? (
        matches.length === 0 ? (
          <p className="card text-sm"><Bi as="span" t={{ en: `No day matches “${query}”. Try a number from 1 to 120 or a word from the title.`, hi: `“${query}” से कोई दिन नहीं मिला। 1 से 120 तक कोई संख्या, या शीर्षक का कोई शब्द लिखें।` }} /></p>
        ) : (
          <ul className="card divide-y divide-[var(--border)]">
            {matches.map(({ phase, day }) => <DayRow key={day.day} day={day} phaseLabel={{ en: `Phase ${phase.phase}`, hi: `चरण ${phase.phase}` }} />)}
          </ul>
        )
      ) : phases.map((ph) => (
        <details key={ph.phase} className="card" open={ph.open}>
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold"><Bi as="span" t={{ en: `Phase ${ph.phase}: ${ph.en}`, hi: `चरण ${ph.phase}: ${ph.hi}` }} /></h2>
              <Bi as="span" className="text-sm text-muted" t={{ en: `Days ${ph.from}–${ph.to} · ${ph.done}/${ph.days.length} done`, hi: `दिन ${ph.from}–${ph.to} · ${ph.done}/${ph.days.length} पूरे` }} />
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full surface-2" role="progressbar" aria-valuenow={ph.done} aria-valuemin={0} aria-valuemax={ph.days.length} aria-label={L({ en: `Phase ${ph.phase} progress`, hi: `चरण ${ph.phase} की प्रगति` })}>
              <div className="h-full bg-brand-600" style={{ width: `${(ph.done / ph.days.length) * 100}%` }} />
            </div>
          </summary>
          <ol className="mt-3 divide-y divide-[var(--border)]">
            {ph.days.map((d) => <DayRow key={d.day} day={d} />)}
          </ol>
        </details>
      ))}
    </div>
  );
}

function DayRow({ day, phaseLabel }: { day: CourseDay; phaseLabel?: { en: string; hi: string } }) {
  const L = useBiLabel();
  const style = STATE_STYLE[day.state];
  return (
    <li id={`day-${day.day}`} className="scroll-mt-24">
      <Link href={`/lesson/${day.day}`} className="flex items-start gap-3 rounded-lg px-1 py-2 hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)]">
        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.cls}`} aria-label={L(style.label)}>{style.icon || day.day}</span>
        <span className="min-w-0 flex-1">
          <Bi as="span" className="block font-medium" t={{ en: `Day ${day.day}: ${day.titleEn}`, hi: `दिन ${day.day}: ${day.titleHi}` }} />
          {day.titleFr && <span className="block text-sm text-muted" lang="fr">{day.titleFr}</span>}
          <span className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted">
            {phaseLabel && <span className="chip"><Bi as="span" t={phaseLabel} /></span>}
            {day.dateLabel && <span>{day.dateLabel}</span>}
            {day.light && <span className="chip">🌙 <Bi as="span" t={{ en: "Light", hi: "हल्का" }} /></span>}
            {day.checkpoint && <span className="chip">🏁 <Bi as="span" t={{ en: "Checkpoint", hi: "चेकपॉइंट" }} /></span>}
            {day.mock && <span className="chip">📝 <Bi as="span" t={{ en: day.mock.replace("mock-", "Mock "), hi: day.mock.replace("mock-", "मॉक ") }} /></span>}
            {!day.available && <Bi as="span" className="chip" t={{ en: "Outline only", hi: "सिर्फ़ रूपरेखा" }} />}
            {day.score != null && <Bi as="span" className="chip" t={{ en: `Check: ${Math.round(day.score * 100)}%`, hi: `जाँच: ${Math.round(day.score * 100)}%` }} />}
          </span>
        </span>
      </Link>
    </li>
  );
}
