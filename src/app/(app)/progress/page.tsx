import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/server/auth";
import { checkpointReport, pacingNote, progressOverview, type CheckpointReport } from "@/server/reports";
import { CHECKPOINT_DAYS } from "@/content/outline";
import { TEF_CANADA } from "@/content/tef-config";
import { formatLocalDate } from "@/lib/dates";
import { CATEGORY_LABEL, SKILL_LABEL } from "@/lib/labels";
import { Bi } from "@/components/bi";

export const metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
type Lang = "en" | "hi" | "both";
type T = { en: string; hi: string };
const pick = (lang: Lang, t: T) => (lang === "hi" ? t.hi : lang === "both" ? `${t.en} · ${t.hi}` : t.en);

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
    return <CheckpointView lang={profile.explanationLang} r={snapshot?.report ?? report} savedAt={snapshot?.createdAt ?? null} reached={reached} pacing={pacingNote(profile, o.today, o.nextIncomplete, o.scheduledDay)} />;
  }
  const maxMin = Math.max(1, ...o.last14.map((d) => d.minutes));
  const label = (t: T) => pick(profile.explanationLang, t);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Progress", hi: "प्रगति" }} /></h1>
        <Bi className="text-muted" t={{ en: "What you have done and how your practice answers have gone. These are your own counts, not a prediction of a TEF result.", hi: "आपने क्या किया है और अभ्यास में आपके उत्तर कैसे रहे। ये आपकी अपनी गिनतियाँ हैं, TEF परिणाम का अनुमान नहीं।" }} />
      </header>

      <section className="card space-y-3">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Course", hi: "पाठ्यक्रम" }} /></h2>
        <Bi t={{
          en: `${o.completedCount} of 120 days completed${o.beforeStart ? " · your plan has not started yet" : ` · the plan has you on day ${o.scheduledDay}`}.`,
          hi: `120 में से ${o.completedCount} दिन पूरे${o.beforeStart ? " · आपकी योजना अभी शुरू नहीं हुई है" : ` · योजना के अनुसार आप दिन ${o.scheduledDay} पर हैं`}।`,
        }} />
        <ul className="space-y-2">
          {o.phases.map((p) => (
            <li key={p.phase} className="text-sm">
              <div className="flex justify-between"><Bi as="span" t={{ en: `Phase ${p.phase}: ${p.en}`, hi: `चरण ${p.phase}: ${p.hi}` }} /><span className="font-mono">{p.done}/{p.total}</span></div>
              <Bar value={p.done} max={p.total} label={label({ en: `${p.done} of ${p.total} days`, hi: `${p.total} में से ${p.done} दिन` })} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Study time", hi: "पढ़ाई का समय" }} /></h2>
        <Bi className="text-sm" t={{ en: `${Math.round(o.totalMinutes / 6) / 10} hours on ${o.studyDays} days in total.`, hi: `कुल ${o.studyDays} दिनों में ${Math.round(o.totalMinutes / 6) / 10} घंटे।` }} />
        <div className="flex h-24 items-end gap-1" role="img" aria-label={label({ en: `Minutes per day for the last 14 days: ${o.last14.map((d) => d.minutes).join(", ")}`, hi: `पिछले 14 दिनों में रोज़ के मिनट: ${o.last14.map((d) => d.minutes).join(", ")}` })}>
          {o.last14.map((d) => <div key={d.date} className="flex-1 rounded-t bg-brand-500" style={{ height: `${Math.max(2, (d.minutes / maxMin) * 100)}%`, opacity: d.minutes ? 1 : 0.25 }} title={label({ en: `${d.date}: ${d.minutes} min`, hi: `${d.date}: ${d.minutes} मिनट` })} />)}
        </div>
        <Bi className="text-xs text-muted" t={{ en: "Last 14 days, minutes per day. Time is counted when you finish lesson blocks and practice activities.", hi: "पिछले 14 दिन, रोज़ के मिनट। समय तब गिना जाता है जब आप पाठ के हिस्से और अभ्यास गतिविधियाँ पूरी करते हैं।" }} />
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Skills", hi: "कौशल" }} /></h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th className="py-1 pr-2"><Bi as="span" t={{ en: "Skill", hi: "कौशल" }} /></th><th className="pr-2 text-right"><Bi as="span" t={{ en: "Answers", hi: "उत्तर" }} /></th><th className="pr-2 text-right"><Bi as="span" t={{ en: "Recent", hi: "हाल के" }} /></th><th className="text-right"><Bi as="span" t={{ en: "Before", hi: "पहले" }} /></th></tr></thead>
          <tbody>{o.skills.map((s) => <tr key={s.skill} className="border-t border-app"><td className="py-1"><Bi as="span" t={SKILL_LABEL[s.skill]} /></td><td className="pr-2 text-right">{s.attempts}</td><td className="pr-2 text-right">{pct(s.recentAccuracy)}</td><td className="text-right">{pct(s.previousAccuracy)}</td></tr>)}</tbody>
        </table>
        <Bi className="text-xs text-muted" t={{ en: "Share of correct answers in scored practice: your last 30 answers, and the 30 before them. Speaking and writing only count where an exercise was scored, so treat those rows with care.", hi: "अंक वाले अभ्यास में सही उत्तरों का हिस्सा: आपके पिछले 30 उत्तर, और उनसे पहले के 30। बोलना और लिखना सिर्फ़ वहीं गिने जाते हैं जहाँ किसी अभ्यास के अंक दिए गए, इसलिए इन पंक्तियों को सावधानी से देखें।" }} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold"><Bi as="span" t={{ en: "Words", hi: "शब्द" }} /></h2>
          <Bi t={{ en: `${o.vocab.words} words in your list · ${o.vocab.retained} remembered for a week or more · ${o.vocab.learning} still being learned`, hi: `आपकी सूची में ${o.vocab.words} शब्द · ${o.vocab.retained} एक हफ़्ते या ज़्यादा से याद हैं · ${o.vocab.learning} अभी सीखे जा रहे हैं` }} />
          <Link href="/words" className="underline"><Bi as="span" t={{ en: "My words →", hi: "मेरे शब्द →" }} /></Link>
        </div>
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold"><Bi as="span" t={{ en: "Open mistakes", hi: "बाक़ी ग़लतियाँ" }} /></h2>
          {o.mistakeCounts.length === 0 ? <Bi t={{ en: "None open.", hi: "कोई बाक़ी नहीं।" }} /> : <ul>{o.mistakeCounts.sort((a, b) => b.n - a.n).map((m) => <li key={m.category}><Bi as="span" t={CATEGORY_LABEL[m.category] ?? { en: m.category }} />: {m.n}</li>)}</ul>}
          <Link href="/mistakes" className="underline"><Bi as="span" t={{ en: "Mistake notebook →", hi: "ग़लतियों की कॉपी →" }} /></Link>
        </div>
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold"><Bi as="span" t={{ en: "Production", hi: "बोलना और लिखना" }} /></h2>
          <Bi t={{ en: `${o.writingSubmitted} texts submitted · ${o.speakingSessions} speaking sessions`, hi: `${o.writingSubmitted} लेख जमा किए · ${o.speakingSessions} बोलने के सत्र` }} />
        </div>
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold"><Bi as="span" t={{ en: "Practice exams", hi: "परीक्षा अभ्यास" }} /></h2>
          {o.mocks.length === 0 ? <Bi t={{ en: "None yet.", hi: "अभी कोई नहीं।" }} /> : (
            <ul>{o.mocks.slice(0, 5).map((m) => {
              const line = (lang: "en" | "hi") => m.sections.map((k) => { const s = m.scores[k]; return s && "correct" in s ? `${TEF_CANADA.sections[k][lang]} ${s.correct}/${s.total}` : null; }).filter(Boolean).join(" · ");
              return <li key={m.id}><Link className="underline" href={`/exam/${m.id}`}>{m.title}</Link>: <Bi as="span" t={{ en: line("en") || (m.status === "completed" ? "done" : "in progress"), hi: line("hi") || (m.status === "completed" ? "पूरा" : "जारी है") }} /></li>;
            })}</ul>
          )}
          <Bi className="text-xs text-muted" t={{ en: "Raw counts. Not TEF scores, CEFR or NCLC levels.", hi: "सिर्फ़ सीधी गिनती। ये TEF अंक, CEFR या NCLC स्तर नहीं हैं।" }} />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Checkpoint reports", hi: "चेकपॉइंट रिपोर्ट" }} /></h2>
        <ul className="flex flex-wrap gap-2">
          {o.checkpoints.map((c) => <li key={c.day}><Link href={`/progress?checkpoint=${c.day}`} className={`chip ${c.reached ? "bg-brand-100 text-brand-900" : "surface-2"}`}><Bi as="span" t={{ en: `Day ${c.day}`, hi: `दिन ${c.day}` }} />{c.reached ? " ✓" : ""}</Link></li>)}
        </ul>
        <Bi className="text-xs text-muted" t={{ en: "Each report covers the 20 days up to that checkpoint. It is saved when you first open it after finishing the checkpoint day.", hi: "हर रिपोर्ट उस चेकपॉइंट तक के 20 दिनों की होती है। चेकपॉइंट वाला दिन पूरा करने के बाद जब आप इसे पहली बार खोलते हैं, तब यह सहेजी जाती है।" }} />
      </section>
    </div>
  );
}

function CheckpointView({ lang, r, savedAt, reached, pacing }: { lang: Lang; r: CheckpointReport; savedAt: Date | null; reached: boolean; pacing: string[] }) {
  const label = (t: T) => pick(lang, t);
  return (
    <div className="space-y-4">
      <Link href="/progress" className="text-sm underline"><Bi as="span" t={{ en: "← Progress", hi: "← प्रगति" }} /></Link>
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: `Checkpoint report: day ${r.checkpoint}`, hi: `चेकपॉइंट रिपोर्ट: दिन ${r.checkpoint}` }} /></h1>
        <Bi className="text-muted" t={{ en: `Days ${r.from}–${r.to}${r.phase ? ` · Phase ${r.phase.phase}: ${r.phase.en}` : ""}`, hi: `दिन ${r.from}–${r.to}${r.phase ? ` · चरण ${r.phase.phase}: ${r.phase.hi}` : ""}` }} />
        {(savedAt || !reached) && <Bi className="text-sm" t={savedAt
          ? { en: `Saved on ${formatLocalDate(savedAt.toISOString().slice(0, 10))}.`, hi: `${formatLocalDate(savedAt.toISOString().slice(0, 10))} को सहेजी गई।` }
          : { en: "You have not finished this checkpoint day yet, so this report shows your progress so far.", hi: "आपने यह चेकपॉइंट वाला दिन अभी पूरा नहीं किया है, इसलिए यह रिपोर्ट अब तक की आपकी प्रगति दिखाती है।" }} />}
      </header>

      <section className="card space-y-1 text-sm">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Days", hi: "दिन" }} /></h2>
        <Bi t={{ en: `${r.completed.length} of 20 days completed.${r.missing.length ? ` Behind the plan: ${r.missing.join(", ")}.` : ""}`, hi: `20 में से ${r.completed.length} दिन पूरे।${r.missing.length ? ` योजना से पीछे: ${r.missing.join(", ")}।` : ""}` }} />
        {r.checkpointScore !== null && <Bi t={{ en: `Checkpoint test: ${pct(r.checkpointScore)} correct.`, hi: `चेकपॉइंट टेस्ट: ${pct(r.checkpointScore)} सही।` }} />}
        {r.assessments.length > 0 && (
          <div className="mt-2 flex h-20 items-end gap-1" role="img" aria-label={label({ en: `Daily check scores: ${r.assessments.map((a) => `day ${a.day} ${pct(a.score)}`).join(", ")}`, hi: `रोज़ की जाँच के अंक: ${r.assessments.map((a) => `दिन ${a.day} ${pct(a.score)}`).join(", ")}` })}>
            {r.assessments.map((a) => <div key={a.day} className="flex-1 rounded-t bg-brand-500" style={{ height: `${Math.max(4, a.score * 100)}%` }} title={label({ en: `Day ${a.day}: ${pct(a.score)}`, hi: `दिन ${a.day}: ${pct(a.score)}` })} />)}
          </div>
        )}
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "What you can do now", hi: "अब आप क्या कर सकते हैं" }} /></h2>
        {(r.canDo ?? []).length === 0 ? <Bi t={{ en: "Nothing is shown here until a day's check is done with at least 70% correct.", hi: "जब तक किसी दिन की जाँच कम से कम 70% सही उत्तरों के साथ पूरी नहीं होती, यहाँ कुछ नहीं दिखेगा।" }} /> : (
          <ul className="list-disc space-y-1 pl-5">{r.canDo.map((c) => <li key={c.day}><Bi as="span" t={c} /> <Bi as="span" className="text-xs text-muted" t={{ en: `(day ${c.day} check: ${pct(c.score)})`, hi: `(दिन ${c.day} की जाँच: ${pct(c.score)})` }} /></li>)}</ul>
        )}
        {(r.toRevisit ?? []).length > 0 && <>
          <Bi as="h3" className="pt-1 font-medium" t={{ en: "Finished, but the check shows more work is needed", hi: "पूरा हो गया, पर जाँच बताती है कि और मेहनत चाहिए" }} />
          <ul className="list-disc space-y-1 pl-5">{r.toRevisit.map((c) => <li key={c.day}><Link href={`/lesson/${c.day}`} className="underline"><Bi as="span" t={{ en: `Day ${c.day}`, hi: `दिन ${c.day}` }} /></Link>: <Bi as="span" t={c} /> <span className="text-xs text-muted">({pct(c.score)})</span></li>)}</ul>
        </>}
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Skills in these days", hi: "इन दिनों के कौशल" }} /></h2>
        {r.skills.length === 0 ? <Bi t={{ en: "No scored answers in these days yet.", hi: "इन दिनों में अभी अंक वाले कोई उत्तर नहीं हैं।" }} /> : (
          <table className="w-full"><thead><tr className="text-left text-muted"><th><Bi as="span" t={{ en: "Skill", hi: "कौशल" }} /></th><th><Bi as="span" t={{ en: "Answers", hi: "उत्तर" }} /></th><th><Bi as="span" t={{ en: "Correct", hi: "सही" }} /></th></tr></thead>
            <tbody>{r.skills.map((s) => <tr key={s.skill} className="border-t border-app"><td className="py-1"><Bi as="span" t={SKILL_LABEL[s.skill]} /></td><td>{s.attempts}</td><td>{pct(s.accuracy)}</td></tr>)}</tbody></table>
        )}
        <Bi t={{ en: `Words from these lessons: ${r.vocab.words}, of which ${r.vocab.retained} are remembered for a week or more.`, hi: `इन पाठों के शब्द: ${r.vocab.words}, जिनमें से ${r.vocab.retained} एक हफ़्ते या ज़्यादा से याद हैं।` }} />
        <Bi t={{ en: `Writing tasks submitted: ${r.writingSubmitted} · role-plays practised: ${r.speakingSessions}`, hi: `जमा किए गए लेखन कार्य: ${r.writingSubmitted} · अभ्यास किए गए रोल-प्ले: ${r.speakingSessions}` }} />
      </section>

      {r.topMistakes.length > 0 && (
        <section className="card space-y-2 text-sm">
          <h2 className="font-semibold"><Bi as="span" t={{ en: "Errors that keep coming back", hi: "बार-बार लौटने वाली ग़लतियाँ" }} /></h2>
          <ul className="space-y-1">{r.topMistakes.map((m) => <li key={m.id}><Bi as="span" className="chip surface-2 mr-1" t={CATEGORY_LABEL[m.category] ?? { en: m.category }} /><span lang="fr" className="line-through">{m.original}</span> → <span lang="fr" className="font-medium">{m.corrected}</span>{m.occurrences > 1 ? ` (${m.occurrences}×)` : ""}</li>)}</ul>
        </section>
      )}

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "What to do next", hi: "आगे क्या करें" }} /></h2>
        <ul className="list-disc space-y-1 pl-5">{r.next.map((n, i) => <li key={i}>{n.text} <Link href={n.href} className="underline"><Bi as="span" t={{ en: "Go →", hi: "चलें →" }} /></Link></li>)}</ul>
        <Bi className="text-xs text-muted" t={{ en: "Suggestions from simple rules applied to your own numbers. This report does not estimate a TEF score or level.", hi: "ये सुझाव आपकी अपनी संख्याओं पर लगाए गए सरल नियमों से आते हैं। यह रिपोर्ट TEF अंक या स्तर का अनुमान नहीं लगाती।" }} />
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Exam date and workload", hi: "परीक्षा की तारीख़ और काम का बोझ" }} /></h2>
        <ul className="list-disc space-y-1 pl-5">{pacing.map((n, i) => <li key={i}>{n}</li>)}</ul>
        <Link href="/settings" className="underline"><Bi as="span" t={{ en: "Change daily time or exam date →", hi: "रोज़ का समय या परीक्षा की तारीख़ बदलें →" }} /></Link>
      </section>
    </div>
  );
}
