"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import type { ClientLesson } from "@/server/lesson-view";
import { usePlayer, AudioSourceNote, Speak } from "./audio";
import { Bi } from "./bi";

type Result = { correct: boolean; answer: number; explanation: { en: string; hi: string }; evidence?: string };

/** Exam-style listening: questions first, the recording plays once at normal speed, no pause or replay, transcript only after submitting. */
export function ExamListening({ d }: { d: ClientLesson }) {
  const L = d.listening;
  const { play, playing, error } = usePlayer();
  const [phase, setPhase] = useState<"ready" | "playing" | "answer" | "done">("ready");
  const [choices, setChoices] = useState<(number | null)[]>(L.questions.map(() => null));
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setPhase("playing");
    await play(L.lines.map((l) => ({ text: l.fr, voice: l.voice })));
    setPhase("answer");
  };
  const submit = async () => {
    setBusy(true);
    const out: Result[] = [];
    for (const [i, c] of choices.entries()) out.push(await api<Result>(`/api/lesson/${d.day}/answer`, { body: { section: "listening", index: i, choice: c ?? -1 } }));
    setResults(out); setPhase("done"); setBusy(false);
  };
  const score = results?.filter((r) => r.correct).length ?? 0;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-saffron-500/60 p-3 text-sm">
        <p className="font-semibold">Exam rules</p>
        <p>Read the questions first. The recording plays <strong>once</strong>, at normal speed, with no pause and no replay. You can answer while it plays. The transcript appears after you submit.</p>
      </div>
      <AudioSourceNote />
      {phase === "ready" && <button type="button" className="btn btn-primary" onClick={start}>▶ Start the recording (plays once)</button>}
      {phase === "playing" && <p className="font-medium" aria-live="polite">🔊 Playing… line {(playing ?? 0) + 1} of {L.lines.length}</p>}
      {phase === "answer" && <p className="text-sm text-muted" aria-live="polite">The recording has finished. Answer and submit.</p>}
      {error && <p role="alert" className="text-sm">{error}</p>}
      <ol className="space-y-3">
        {L.questions.map((q, i) => {
          const r = results?.[i];
          return (
            <li key={i}>
              <fieldset className="rounded-xl border border-app p-3">
                <legend className="px-1 font-medium">{i + 1}. {q.q.fr && <span lang="fr" className="block">{q.q.fr}</span>}<span className={q.q.fr ? "text-sm text-muted" : ""}>{q.q.en}</span></legend>
                <div className="mt-2 grid gap-2">
                  {q.options.map((o, j) => (
                    <label key={j} className={`flex items-start gap-2 rounded-lg border p-2 ${r ? (j === r.answer ? "border-green-600 bg-green-50 dark:bg-green-900/30" : j === choices[i] ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-app") : choices[i] === j ? "border-brand-500" : "border-app"}`}>
                      <input type="radio" name={`xl-${i}`} checked={choices[i] === j} disabled={phase === "done"} onChange={() => setChoices((c) => c.map((x, k) => (k === i ? j : x)))} className="mt-1" />
                      <span lang="fr">{o}</span>
                    </label>
                  ))}
                </div>
                {r && <div className="mt-2 rounded-lg surface-2 p-2 text-sm"><p className="font-medium">{r.correct ? "Correct" : choices[i] === null ? "No answer" : "Not quite"}</p><Bi t={r.explanation} />{r.evidence && <p className="mt-1">Evidence: <q lang="fr">{r.evidence}</q></p>}</div>}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {phase !== "done" && <button type="button" className="btn btn-primary" disabled={phase !== "answer" || busy} onClick={submit}>{busy ? "Checking…" : phase === "answer" ? "Submit answers" : "Submit (after the recording)"}</button>}
      {phase === "done" && (
        <div className="space-y-3">
          <p className="text-lg font-semibold" aria-live="polite">{score} / {L.questions.length} correct</p>
          {score < L.questions.length && <p className="text-sm text-muted">Wrong answers were added to your mistake notebook.</p>}
          <details className="card"><summary className="cursor-pointer font-medium">Transcript and translation</summary>
            <ol className="mt-2 space-y-2">{L.lines.map((l, i) => <li key={i}><p><span className="text-sm font-semibold">{l.speaker}:</span> <span lang="fr">{l.fr}</span> <Speak text={l.fr} voice={l.voice} /></p><p className="text-sm text-muted">{l.en} · <span lang="hi" className="deva">{l.hi}</span></p></li>)}</ol>
          </details>
        </div>
      )}
    </div>
  );
}
