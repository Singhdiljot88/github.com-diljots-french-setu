import type { ActivitySummary } from "@/server/activity";
import { Bi } from "./bi";

const level = (m: number, a: number) => (m <= 0 && a <= 0 ? 0 : m < 10 ? 1 : m < 30 ? 2 : m < 60 ? 3 : 4);

/** Last 12 weeks of study, one square per day (columns are weeks). Counts days, never proficiency. */
export function ActivityHeatmap({ a, today }: { a: ActivitySummary; today: string }) {
  // Pad the start so each column is a Monday→Sunday week.
  const first = new Date(`${a.days[0].date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const pad = (first + 6) % 7;
  const cells: ({ date: string; minutes: number; answers: number } | null)[] = [...Array(pad).fill(null), ...a.days];
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <section className="card space-y-3" aria-labelledby="heat-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="heat-h" className="font-semibold"><Bi as="span" t={{ en: "Your study rhythm", hi: "आपकी पढ़ाई की लय" }} /></h2>
        <Bi as="span" className="text-sm text-muted" t={{ en: `${a.activeDays} study days in 12 weeks · longest run ${a.bestStreak}`, hi: `12 हफ़्तों में ${a.activeDays} दिन पढ़ाई · सबसे लंबा सिलसिला ${a.bestStreak}` }} />
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} role="img"
        aria-label={`${a.activeDays} study days in the last 12 weeks`}>
        {weeks.map((w, wi) => (
          <div key={wi} className="grid gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const c = w[di];
              return c ? <span key={di} className="heat" data-l={level(c.minutes, c.answers)} data-today={c.date === today} title={`${c.date}: ${c.minutes} min`} />
                : <span key={di} className="heat opacity-0" />;
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-xs text-muted">
        <Bi as="span" t={{ en: "less", hi: "कम" }} />
        {[0, 1, 2, 3, 4].map((l) => <span key={l} className="heat inline-block !w-3" data-l={l} />)}
        <Bi as="span" t={{ en: "more", hi: "ज़्यादा" }} />
      </div>
    </section>
  );
}
