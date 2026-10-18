import Link from "next/link";
import { requireUser, getProfile } from "@/server/auth";
import { attemptSummary, examCatalog, listAttempts } from "@/server/exam";
import { TEF_CANADA, SECTION_ORDER } from "@/content/tef-config";
import { ExamStart } from "@/components/exam-start";

export const metadata = { title: "Practice exams" };
export const dynamic = "force-dynamic";

export default async function ExamPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const attempts = (await listAttempts(user.id)).map(attemptSummary);
  const mocks = examCatalog();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Practice exams <span lang="hi" className="deva text-lg font-normal text-muted">· अभ्यास परीक्षा</span></h1>
        <p className="text-muted">Full TEF Canada-format practice under exam rules, or one section at a time.</p>
      </header>
      {profile && profile.examVariant !== "tef_canada" && <p className="card text-sm">Your profile names a TEF variant other than TEF Canada. Only the TEF Canada format is built so far.</p>}

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">The format used here</h2>
        <table className="w-full text-left">
          <thead><tr><th className="py-1">Section</th><th>Time</th><th>What you do</th></tr></thead>
          <tbody>
            {SECTION_ORDER.map((k) => { const c = TEF_CANADA.sections[k]; return (
              <tr key={k} className="border-t border-app align-top"><td className="py-1 pr-2"><span className="font-medium">{c.en}</span><br /><span lang="fr" className="text-muted">{c.title}</span></td><td className="pr-2">{c.minutes} min</td><td><ul className="list-disc pl-4">{c.rules.map((r, i) => <li key={i}>{r.text}{r.source === "prep-guides" ? " *" : ""}</li>)}</ul></td></tr>
            ); })}
          </tbody>
        </table>
        <p className="text-xs text-muted">Checked on {TEF_CANADA.checkedOn} against: {TEF_CANADA.sources.map((s) => <a key={s.url} href={s.url} className="underline" target="_blank" rel="noreferrer">{s.label}</a>)}. Rules marked * come from widely published preparation guides and are not stated in that handbook. Check the official site before your exam, since the format can change.</p>
        <p className="text-xs text-muted">All practice material is original. It is not official TEF material, and results are raw practice counts, not TEF scores, CEFR levels or NCLC levels.</p>
      </section>

      <ExamStart mocks={mocks} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your attempts</h2>
        {attempts.length === 0 && <p className="text-sm text-muted">No attempts yet.</p>}
        <ul className="space-y-2">
          {attempts.map((a) => (
            <li key={a.id}>
              <Link href={`/exam/${a.id}`} className="card block hover:border-brand-500">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{a.title}</span>
                  <span className="text-xs text-muted">{new Date(a.createdAt).toLocaleDateString()} · {a.strict ? "exam rules" : "relaxed"} · {a.status === "completed" ? "done" : "in progress"}</span>
                </span>
                <span className="mt-1 flex flex-wrap gap-2 text-sm">
                  {a.sections.map((k) => { const s = a.scores[k]; return (
                    <span key={k} className="chip surface-2">{TEF_CANADA.sections[k].en}: {!s ? "not finished" : "correct" in s ? `${s.correct}/${s.total}` : "words" in s ? `A ${s.words.a} words, B ${s.words.b} words` : "done"}</span>
                  ); })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
