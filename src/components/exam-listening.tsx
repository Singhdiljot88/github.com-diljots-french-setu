"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import type { ClientLesson } from "@/server/lesson-view";
import { usePlayer, AudioSourceNote, AudioError, Speak } from "./audio";
import { Bi, useBiLabel } from "./bi";
import { usePrefs } from "./prefs";

type Result = { correct: boolean; answer: number; explanation: { en: string; hi: string }; evidence?: string };

/** Exam-style listening: questions first, the recording plays once at normal speed, no pause or replay, transcript only after submitting. */
export function ExamListening({ d }: { d: ClientLesson }) {
  const Ls = d.listening;
  const { play, playing, error } = usePlayer();
  const [phase, setPhase] = useState<"ready" | "playing" | "answer" | "done">("ready");
  const [choices, setChoices] = useState<(number | null)[]>(Ls.questions.map(() => null));
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setPhase("playing");
    await play(Ls.lines.map((l) => ({ text: l.fr, voice: l.voice })));
    setPhase("answer");
  };
  const submit = async () => {
    setBusy(true);
    const out: Result[] = [];
    for (const [i, c] of choices.entries()) out.push(await api<Result>(`/api/lesson/${d.day}/answer`, { body: { section: "listening", index: i, choice: c ?? -1 } }));
    setResults(out); setPhase("done"); setBusy(false);
  };
  const score = results?.filter((r) => r.correct).length ?? 0;
  const L = useBiLabel();
  const { explanationLang } = usePrefs();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-saffron-500/60 p-3 text-sm">
        <Bi className="font-semibold" t={{ en: "Exam rules", hi: "परीक्षा के नियम और निर्देश" }} />
        {explanationLang !== "hi" && <p lang="en">Read the questions first. The recording plays <strong>once</strong>, at normal speed, with no pause and no replay. You can answer while it plays. The transcript appears after you submit.</p>}
        {explanationLang !== "en" && <p lang="hi" className={`deva ${explanationLang === "both" ? "text-muted mt-0.5" : ""}`}>पहले प्रश्न पढ़ें। रिकॉर्डिंग सामान्य गति से <strong>केवल एक बार</strong> चलती है, बिना रुके और बिना दोबारा चले। आप उसके चलते-चलते उत्तर दे सकते हैं। जमा करने के बाद लिखित पाठ दिखेगा।</p>}
      </div>
      <AudioSourceNote />
      {phase === "ready" && <button type="button" className="btn btn-primary" onClick={start}>▶ {L({ en: "Start the recording (plays once)", hi: "रिकॉर्डिंग सुनें (एक ही बार चलेगी)" })}</button>}
      {phase === "playing" && <p className="font-medium" aria-live="polite">🔊 {L({ en: `Playing… line ${(playing ?? 0) + 1} of ${Ls.lines.length}`, hi: `चल रही है… ${Ls.lines.length} में से पंक्ति ${(playing ?? 0) + 1}` })}</p>}
      {phase === "answer" && <p className="text-sm text-muted" aria-live="polite">{L({ en: "The recording has finished. Answer and submit.", hi: "रिकॉर्डिंग ख़त्म हो गई। उत्तर दें और जमा करें।" })}</p>}
      <AudioError error={error} />
      <ol className="space-y-3">
        {Ls.questions.map((q, i) => {
          const r = results?.[i];
          return (
            <li key={i}>
              <fieldset className="rounded-xl border border-app p-3">
                <legend className="px-1 font-medium">{i + 1}. {q.q.fr && <span lang="fr" className="block">{q.q.fr}</span>}<Bi as="span" t={{ en: q.q.en, hi: q.q.hi }} className={q.q.fr ? "text-sm text-muted" : ""} /></legend>
                <div className="mt-2 grid gap-2">
                  {q.options.map((o, j) => (
                    <label key={j} className={`flex items-start gap-2 rounded-lg border p-2 ${r ? (j === r.answer ? "border-green-600 bg-green-50 dark:bg-green-900/30" : j === choices[i] ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-app") : choices[i] === j ? "border-brand-500" : "border-app"}`}>
                      <input type="radio" name={`xl-${i}`} checked={choices[i] === j} disabled={phase === "done"} onChange={() => setChoices((c) => c.map((x, k) => (k === i ? j : x)))} className="mt-1" />
                      <span lang="fr">{o}</span>
                    </label>
                  ))}
                </div>
                {r && <div className="mt-2 rounded-lg surface-2 p-2 text-sm"><p className="font-medium">{L(r.correct ? { en: "Correct", hi: "सही" } : choices[i] === null ? { en: "No answer", hi: "कोई उत्तर नहीं" } : { en: "Not quite", hi: "सही नहीं" })}</p><Bi t={r.explanation} />{r.evidence && <p className="mt-1">{L({ en: "Evidence:", hi: "प्रमाण:" })} <q lang="fr">{r.evidence}</q></p>}</div>}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {phase !== "done" && <button type="button" className="btn btn-primary" disabled={phase !== "answer" || busy} onClick={submit}>{L(busy ? { en: "Checking…", hi: "जाँच हो रही है…" } : phase === "answer" ? { en: "Submit answers", hi: "उत्तर जमा करें" } : { en: "Submit (after the recording)", hi: "जमा करें (रिकॉर्डिंग के बाद)" })}</button>}
      {phase === "done" && (
        <div className="space-y-3">
          <p className="text-lg font-semibold" aria-live="polite">{L({ en: `${score} / ${Ls.questions.length} correct`, hi: `${Ls.questions.length} में से ${score} सही` })}</p>
          {score < Ls.questions.length && <Bi className="text-sm text-muted" t={{ en: "Wrong answers were added to your mistake notebook.", hi: "ग़लत उत्तर आपकी ग़लतियों की कॉपी में जोड़ दिए गए हैं।" }} />}
          <details className="card"><summary className="cursor-pointer font-medium">{L({ en: "Transcript and translation", hi: "लिखित पाठ और अनुवाद" })}</summary>
            <ol className="mt-2 space-y-2">{Ls.lines.map((l, i) => <li key={i}><p><span className="text-sm font-semibold">{l.speaker}:</span> <span lang="fr">{l.fr}</span> <Speak text={l.fr} voice={l.voice} /></p><Bi as="span" className="block text-sm text-muted" t={{ en: l.en, hi: l.hi }} /></li>)}</ol>
          </details>
        </div>
      )}
    </div>
  );
}
