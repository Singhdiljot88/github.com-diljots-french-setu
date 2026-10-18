import Link from "next/link";
import { requireUser, getProfile } from "@/server/auth";
import { sayReport } from "@/server/say-report";
import { STATUS_LABEL } from "@/lib/speech-match";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Pronunciation practice report" };
export const dynamic = "force-dynamic";

const RANGES = { all: "All time", "30": "Last 30 days", "7": "Last 7 days", "1": "Today" } as const;
const fmtDate = (d: Date, tz: string) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: tz });

export default async function SayReportPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const tz = profile?.timezone ?? "UTC";
  const range = ((await searchParams).range ?? "all") as keyof typeof RANGES;
  const days = range === "all" ? null : Number(range);
  const since = days ? new Date(Date.now() - days * 86_400_000) : undefined;
  const r = await sayReport(user.id, since);
  const name = profile?.displayName || (user.isGuest ? "Learner" : user.email.split("@")[0]);
  const perfect = r.phrases.filter((p) => p.status === "all");
  const improved = r.phrases.filter((p) => p.improved);
  const work = r.phrases.filter((p) => p.status !== "all");
  const missedWords = [...new Set(work.flatMap((p) => p.stillMissed))].slice(0, 20);

  return (
    <article className="space-y-5 print:space-y-3 print:text-[11pt]">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/pronunciation?tab=say" className="text-sm underline">← Say it practice</Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Date range" className="flex flex-wrap gap-1">
            {Object.entries(RANGES).map(([k, v]) => <Link key={k} href={`/pronunciation/report?range=${k}`} className={`chip ${range === k ? "bg-brand-100 text-brand-900" : "surface-2"}`} aria-current={range === k ? "page" : undefined}>{v}</Link>)}
          </nav>
          <PrintButton />
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-bold">{name}&apos;s French pronunciation: best attempts</h1>
        <p className="text-sm text-muted">
          {r.from ? <>Practice from {fmtDate(r.from, tz)} to {fmtDate(r.to!, tz)} · {r.attempts} attempts on {r.phrases.length} phrases</> : "No attempts in this period yet."}
          {" · "}Printed from French Setu
        </p>
      </header>

      <section className="card space-y-1 text-sm print:border print:shadow-none" aria-labelledby="how-h">
        <h2 id="how-h" className="font-semibold">How this was measured</h2>
        <p>
          Each attempt is what a French speech recognizer wrote down when {name} said the phrase
          {r.usedBrowser && r.usedKeyboard ? " (the browser's built-in recognizer, or a phone voice keyboard)" : r.usedKeyboard ? " (a phone voice keyboard)" : " (the browser's built-in recognizer)"}.
          The phrase is compared with that text word by word, ignoring capitals, accents and punctuation.
          A word counts as recognised when the recognizer wrote it in the right order.
        </p>
        <p>This shows whether the sounds were clear enough for a machine to understand. It is not an accent score, a CEFR or NCLC level, or a TEF result, and no audio was kept.</p>
      </section>

      {r.phrases.length === 0 ? (
        <p className="card text-sm print:hidden">Practise in the <Link className="underline" href="/pronunciation?tab=say">Say it</Link> tab of the pronunciation lab, then come back here.</p>
      ) : (
        <>
          <section className="space-y-1 text-sm" aria-labelledby="hl-h">
            <h2 id="hl-h" className="text-lg font-semibold">Highlights</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>{perfect.length} of {r.phrases.length} phrases had every word recognised at least once.</li>
              {perfect.sort((a, b) => b.best.count - a.best.count)[0] && <li>Most reliable: <span lang="fr" className="italic">{perfect[0].fr}</span>, recognised in full {perfect[0].best.count} time{perfect[0].best.count === 1 ? "" : "s"}.</li>}
              {improved.length > 0 && <li>{improved.length} phrase{improved.length === 1 ? "" : "s"} improved between the first and the best attempt.</li>}
            </ul>
          </section>

          <section aria-labelledby="pp-h" className="space-y-2">
            <h2 id="pp-h" className="text-lg font-semibold">Phrase by phrase</h2>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm print:min-w-0 print:text-[9.5pt]">
                <thead>
                  <tr className="border-b border-app align-bottom">
                    <th className="py-1 pr-2">French</th><th className="pr-2">Meaning</th><th className="pr-2">Approx. pronunciation</th><th className="pr-2">Best attempt (what was heard)</th><th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {r.phrases.map((p) => (
                    <tr key={p.fr} className="border-b border-app align-top break-inside-avoid">
                      <td className="py-1.5 pr-2" lang="fr"><span className="font-medium">{p.fr}</span>{p.day && <span className="block text-xs text-muted">Day {p.day}</span>}</td>
                      <td className="pr-2">{p.en}<span lang="hi" className="deva block text-muted">{p.hi}</span></td>
                      <td className="pr-2" lang="hi"><span className="deva">{p.pron ?? "—"}</span></td>
                      <td className="pr-2"><q lang="fr">{p.best.transcript}</q><span className="block text-xs text-muted">{p.tries} tr{p.tries === 1 ? "y" : "ies"}</span></td>
                      <td>{STATUS_LABEL[p.status].icon} {p.best.heard}/{p.total}<span className="block text-xs text-muted">{STATUS_LABEL[p.status].en}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">Approximate pronunciation in Devanagari only. French has sounds with no exact Hindi letter: ü and ö mark the rounded vowels, ग़ the soft throaty French r, झ़ the sound in English &ldquo;measure&rdquo;, and ँ a nasal vowel.</p>
          </section>

          {improved.length > 0 && (
            <section className="space-y-1 text-sm break-inside-avoid" aria-labelledby="imp-h">
              <h2 id="imp-h" className="text-lg font-semibold">What improved</h2>
              <ul className="list-disc space-y-1 pl-5">
                {improved.slice(0, 12).map((p) => <li key={p.fr}><span lang="fr" className="italic">{p.fr}</span>: first heard as <q lang="fr">{p.first.transcript}</q> ({p.first.heard}/{p.total}), best <q lang="fr">{p.best.transcript}</q> ({p.best.heard}/{p.total}).</li>)}
              </ul>
            </section>
          )}

          {work.length > 0 && (
            <section className="space-y-1 text-sm break-inside-avoid" aria-labelledby="wk-h">
              <h2 id="wk-h" className="text-lg font-semibold">What to work on next</h2>
              <ul className="list-disc space-y-1 pl-5">
                {work.slice(0, 10).map((p) => <li key={p.fr}><span lang="fr" className="italic">{p.fr}</span>{p.stillMissed.length ? <>: the recognizer has not yet written <span lang="fr" className="font-medium">{p.stillMissed.join(", ")}</span>.</> : "."} Listen to the model at slow speed, then say it again.</li>)}
              </ul>
              {missedWords.length > 0 && <p>Words not recognised in any attempt so far: <span lang="fr">{missedWords.join(" · ")}</span>. The sound lessons in the pronunciation lab explain the hardest French sounds for Hindi and English speakers.</p>}
            </section>
          )}
        </>
      )}
    </article>
  );
}
