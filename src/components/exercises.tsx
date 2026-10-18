"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { checkAnswer, type AnswerCheck } from "@/lib/text";
import { Bi } from "./bi";
import { Speak } from "./audio";
import { AccentBar } from "./accent-bar";

type Explain = { en: string; hi: string };
export type McqView = { q: { fr?: string; en: string }; options: string[]; kind?: string };
type McqResult = { correct: boolean; answer: number; explanation: Explain; evidence?: string };

/** Multiple-choice question graded on the server; the explanation appears only after an attempt. */
export function McqLive({ q, index, endpoint, section, onAnswered, name }: { q: McqView; index: number; endpoint: string; section: "listening" | "reading"; onAnswered?: (r: McqResult) => void; name: string }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [res, setRes] = useState<McqResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (choice === null) return;
    try {
      const r = await api<McqResult>(endpoint, { body: { section, index, choice } });
      setRes(r); onAnswered?.(r);
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <fieldset className="rounded-xl border border-app p-3">
      <legend className="px-1 font-medium">
        {index + 1}. {q.q.fr && <span lang="fr" className="block">{q.q.fr}</span>}<span className={q.q.fr ? "text-sm text-muted" : ""}>{q.q.en}</span>
        {q.kind && <span className="chip surface-2 ml-2 text-[10px]">{q.kind}</span>}
      </legend>
      <div className="mt-2 grid gap-2">
        {q.options.map((o, i) => {
          const state = res ? (i === res.answer ? "right" : i === choice ? "wrong" : "") : "";
          return (
            <label key={i} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${state === "right" ? "border-green-600 bg-green-50 dark:bg-green-900/30" : state === "wrong" ? "border-red-500 bg-red-50 dark:bg-red-900/30" : choice === i ? "border-brand-500" : "border-app"}`}>
              <input type="radio" name={name} checked={choice === i} disabled={!!res} onChange={() => setChoice(i)} className="mt-1" />
              <span lang="fr">{o}</span>
              {state === "right" && <span className="ml-auto text-sm text-green-700 dark:text-green-300">✓ correct answer</span>}
              {state === "wrong" && <span className="ml-auto text-sm text-red-700 dark:text-red-300">your answer</span>}
            </label>
          );
        })}
      </div>
      {!res && <button type="button" className="btn btn-primary btn-sm mt-2" disabled={choice === null} onClick={submit}>Check</button>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {res && (
        <div className="mt-2 rounded-lg surface-2 p-2 text-sm" aria-live="polite">
          <p className="font-medium">{res.correct ? "Correct!" : "Not quite — this one is now in your mistake notebook for review."}</p>
          <Bi t={res.explanation} />
          {res.evidence && <p className="mt-1">Evidence: <q lang="fr">{res.evidence}</q></p>}
        </div>
      )}
    </fieldset>
  );
}

export function ResultLine({ r }: { r: AnswerCheck }) {
  if (r.result === "correct") return <p className="text-sm text-green-700 dark:text-green-300">✓ Correct</p>;
  if (r.result === "accent") return <p className="text-sm text-saffron-700">Almost — check the accents: <span lang="fr" className="font-medium">{r.expected}</span></p>;
  return <p className="text-sm text-red-700 dark:text-red-300">Expected: <span lang="fr" className="font-medium">{r.expected}</span></p>;
}

/** Dictation: listen, type, compare. */
export function Dictation({ sentences, day, voice = "f1" }: { sentences: string[]; day?: number; voice?: "f1" | "m1" }) {
  const [vals, setVals] = useState<string[]>(sentences.map(() => ""));
  const [res, setRes] = useState<(AnswerCheck | null)[]>(sentences.map(() => null));
  const check = async (i: number) => {
    const r = checkAnswer(vals[i], sentences[i]);
    setRes((p) => p.map((x, j) => (j === i ? r : x)));
    await api("/api/attempts", { body: { day: day ?? null, kind: "dictation", itemRef: `day:${day}:dictation:${i}`, skill: "listening", correct: r.result === "correct", score: r.result === "correct" ? 1 : r.result === "accent" ? 0.7 : 0, response: vals[i],
      mistake: r.result === "wrong" ? { category: "spelling", original: vals[i] || "(blank)", corrected: sentences[i], explanation: { en: "Dictation: compare your version with the original, word by word.", hi: "डिक्टेशन: अपने लिखे हुए को मूल वाक्य से शब्द-दर-शब्द मिलाइए।" } } : undefined } }).catch(() => {});
  };
  return (
    <ol className="space-y-3">
      {sentences.map((s, i) => (
        <li key={i} className="space-y-1">
          <div className="flex items-center gap-2"><span className="text-sm text-muted">Sentence {i + 1}</span><Speak text={s} voice={voice} label={`dictation sentence ${i + 1}`} /></div>
          <input className="input" lang="fr" aria-label={`Type dictation sentence ${i + 1}`} value={vals[i]} onChange={(e) => setVals((p) => p.map((x, j) => (j === i ? e.target.value : x)))} disabled={!!res[i]} />
          {!res[i] ? <button type="button" className="btn btn-secondary btn-sm" disabled={!vals[i].trim()} onClick={() => check(i)}>Check</button> : <ResultLine r={res[i]!} />}
        </li>
      ))}
      <li><AccentBar /></li>
    </ol>
  );
}

/** Gap-fill from the transcript ("___" marks each gap). */
export function GapFill({ text, answers, day, itemRef, skill = "listening" }: { text: string; answers: string[]; day?: number; itemRef?: string; skill?: "listening" | "reading" }) {
  const parts = text.split("___");
  const [vals, setVals] = useState<string[]>(answers.map(() => ""));
  const [res, setRes] = useState<AnswerCheck[] | null>(null);
  const check = () => {
    const r = answers.map((a, i) => checkAnswer(vals[i], a));
    setRes(r);
    const score = r.reduce((s, x) => s + (x.result === "correct" ? 1 : x.result === "accent" ? 0.5 : 0), 0) / r.length;
    api("/api/attempts", { body: { day: day ?? null, kind: "gapfill", itemRef: itemRef ?? `day:${day}:gapfill`, skill, correct: score === 1, score, response: vals } }).catch(() => {});
  };
  return (
    <div className="space-y-2">
      <p lang="fr" className="leading-loose">
        {parts.map((p, i) => (
          <span key={i}>{p}{i < answers.length && (
            <input style={{ width: "8rem", display: "inline-block" }} className={`input mx-1 min-h-0 py-0.5 ${res ? (res[i].result === "correct" ? "border-green-600" : res[i].result === "accent" ? "border-saffron-500" : "border-red-500") : ""}`} aria-label={`Gap ${i + 1}`} value={vals[i]} disabled={!!res} onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
          )}</span>
        ))}
      </p>
      {!res ? <button type="button" className="btn btn-secondary btn-sm" onClick={check}>Check</button> : <ul className="text-sm">{res.map((r, i) => <li key={i}>Gap {i + 1}: <ResultLine r={r} /></li>)}</ul>}
    </div>
  );
}
