"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { AttemptView } from "@/server/exam";
import type { SpeakingReport } from "@/server/speaking";
import type { FeedbackEnvelope } from "@/lib/feedback-schema";
import { TEF_CANADA, GRACE_SECONDS, type SectionKey } from "@/content/tef-config";
import { usePlayer, AudioSourceNote, Speak, type VoiceKey } from "./audio";
import { Bi } from "./bi";
import { AccentBar } from "./accent-bar";
import { FeedbackView } from "./writing-editor";
import { Conversation, type Turn } from "./speaking-tutor";
import { usePrefs } from "./prefs";

type BiT = { en: string; hi: string };
type Q = { id: string; q: { fr?: string; en: string }; options: string[]; kind?: string; answer?: number; explanation?: BiT; evidence?: string };
type Base = { startedAt: string | null; deadline: string | null; submittedAt: string | null; autoSubmitted: boolean; answers: Record<string, number | string> };
type Result = { correct: number; total: number; byKind: Record<string, { correct: number; total: number }>; bySection: { key: string; title: string; correct: number; total: number }[] };
type ReadingV = Base & { parts: { key: string; title: string; instruction: string; items: { document: { genre: string; title: string; text: string }; questions: Q[] }[] }[]; result: Result | null };
type ListeningV = Base & { position: number; played: number[]; count: number; items: { n: number; sectionKey: string; sectionTitle: string; instruction: string; context: string; questions: Q[]; transcript?: { speaker: string; voice: VoiceKey; fr: string }[] }[]; result: Result | null };
type WTask = { title: string; minWords: number; instruction: BiT; stimulus: string };
type WritingV = Base & { tasks: { a: WTask; b: WTask }; words: { a: number; b: number }; feedback: Record<string, FeedbackEnvelope> };
type STask = { title: string; minutes: number; instruction: BiT; document: string; state: { sessionId: string; startedAt: string; deadline: string; endedAt?: string } | null };
type SpeakingV = Base & { tasks: { a: STask; b: STask } };

const KIND_LABEL: Record<string, string> = { literal: "Finding stated details", inference: "Inference", vocabulary: "Vocabulary in context", grammar: "Grammar", gist: "Main idea", other: "Other" };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function useClock(offsetMs: number) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offsetMs), 1000); return () => clearInterval(t); }, [offsetMs]);
  return now;
}

export function ExamRunner({ initial }: { initial: AttemptView }) {
  const [v, setV] = useState(initial);
  const offset = useMemo(() => new Date(initial.serverNow).getTime() - Date.now(), [initial.serverNow]);
  const firstOpen = v.sectionKeys.find((k) => { const s = v.sections[k] as Base; return s.startedAt && !s.submittedAt; });
  const [active, setActive] = useState<SectionKey | null>(firstOpen ?? v.sectionKeys.find((k) => !(v.sections[k] as Base).submittedAt) ?? null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => { try { setV(await api<AttemptView>(`/api/exam/${v.id}`)); } catch (e) { setError((e as Error).message); } }, [v.id]);
  const act = useCallback(async <T,>(body: Record<string, unknown>): Promise<T | null> => {
    setError(null);
    try { return await api<T>(`/api/exam/${v.id}`, { body }); }
    catch (e) { setError((e as Error).message); if ((e as { status?: number }).status === 409) reload(); return null; }
  }, [v.id, reload]);
  const start = async (k: SectionKey) => { const r = await act<AttemptView>({ action: "start", section: k }); if (r) { setV(r); setActive(k); } };
  const submit = async (k: SectionKey) => { const r = await act<AttemptView>({ action: "submit", section: k }); if (r) setV(r); };

  const sec = <T,>(k: SectionKey) => v.sections[k] as T;
  const anyOpen = v.sectionKeys.some((k) => { const s = sec<Base>(k); return s.startedAt && !s.submittedAt; });

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/exam" className="text-sm underline">← Practice exams</Link>
        <h1 className="text-2xl font-bold">{v.title} <span className="text-base font-normal text-muted">· TEF Canada format</span></h1>
        <p className="text-sm text-muted">{v.disclaimer}</p>
        <p className="text-sm"><span className={`chip ${v.strict ? "bg-saffron-100 text-saffron-700" : "surface-2"}`}>{v.strict ? "Exam rules: timers enforced on the server" : "Relaxed: timers are shown but not enforced"}</span></p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-500 p-2 text-sm">{error}</p>}

      <nav aria-label="Sections" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {v.sectionKeys.map((k) => {
          const s = sec<Base & { result?: Result | null }>(k);
          const status = s.submittedAt ? (s.autoSubmitted ? "Submitted when time ran out" : "Submitted") : s.startedAt ? "In progress" : "Not started";
          return (
            <button key={k} type="button" onClick={() => setActive(k)} aria-current={active === k}
              className={`card text-left ${active === k ? "border-brand-500 ring-1 ring-brand-500" : ""}`}>
              <span className="block font-medium">{TEF_CANADA.sections[k].en} <span lang="fr" className="text-sm text-muted">· {TEF_CANADA.sections[k].title}</span></span>
              <span className="block text-sm text-muted">{TEF_CANADA.sections[k].minutes} min · {status}</span>
              {s.result && <span className="block text-sm font-semibold">{s.result.correct} / {s.result.total} correct</span>}
            </button>
          );
        })}
      </nav>

      {v.status === "completed" && (
        <div className="card text-sm">
          <p className="font-semibold">All sections are done.</p>
          <p>Scores here are raw practice counts on original material. They are not TEF scores and there is no reliable way to turn them into a TEF score, CEFR level or NCLC level, so none is shown. Wrong answers were added to your <Link href="/mistakes" className="underline">mistake notebook</Link>.</p>
        </div>
      )}

      {active && (() => {
        const s = sec<Base>(active);
        if (!s.startedAt) return <StartCard k={active} strict={v.strict} blocked={anyOpen} onStart={() => start(active)} />;
        const common = { act, reload, offset, strict: v.strict, onSubmit: () => submit(active) };
        return (
          <section aria-label={TEF_CANADA.sections[active].en} className="space-y-4">
            {!s.submittedAt && s.deadline && <SectionTimer deadline={s.deadline} offset={offset} enforced={v.strict} onExpire={() => setTimeout(reload, (GRACE_SECONDS + 1) * 1000)} />}
            {active === "reading" && <Reading v={sec<ReadingV>("reading")} {...common} />}
            {active === "listening" && <Listening v={sec<ListeningV>("listening")} {...common} />}
            {active === "writing" && <Writing v={sec<WritingV>("writing")} {...common} />}
            {active === "speaking" && <Speaking v={sec<SpeakingV>("speaking")} sessions={v.speakingSessions} {...common} />}
          </section>
        );
      })()}
    </div>
  );
}

function StartCard({ k, strict, blocked, onStart }: { k: SectionKey; strict: boolean; blocked: boolean; onStart: () => void }) {
  const c = TEF_CANADA.sections[k];
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">{c.en} · <span lang="fr">{c.title}</span></h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {c.rules.map((r, i) => <li key={i}>{r.text} <span className="text-xs text-muted">({r.source === "official" ? "official handbook" : "prep guides, not in the official handbook"})</span></li>)}
      </ul>
      {strict
        ? <p className="text-sm">Once you start, the clock runs on the server. Closing or reloading the page does not pause it, and the section is submitted automatically when time runs out.</p>
        : <p className="text-sm">Relaxed mode: the clock is only a guide and nothing is submitted for you.</p>}
      {blocked && <p className="text-sm text-muted">Finish the section that is in progress first.</p>}
      <button type="button" className="btn btn-primary" disabled={blocked} onClick={onStart}>Start {c.en.toLowerCase()}</button>
    </div>
  );
}

function SectionTimer({ deadline, offset, enforced, onExpire }: { deadline: string; offset: number; enforced: boolean; onExpire: () => void }) {
  const now = useClock(offset);
  const left = Math.ceil((new Date(deadline).getTime() - now) / 1000);
  const fired = useRef(false);
  useEffect(() => { if (enforced && left <= 0 && !fired.current) { fired.current = true; onExpire(); } }, [left, enforced, onExpire]);
  const warn = left <= 300;
  return (
    <div role="timer" aria-live="off" className={`sticky top-16 z-10 rounded-xl border p-2 text-sm ${left <= 0 ? "border-red-500 bg-red-50 dark:bg-red-950" : warn ? "border-saffron-500 surface" : "border-app surface"}`}>
      <span className="font-mono text-lg font-semibold">{left > 0 ? fmt(left) : "0:00"}</span>{" "}
      <span className="text-muted">{left > 0 ? "left" : enforced ? "time is up, submitting…" : "past the exam time"}</span>
      {warn && left > 0 && <span className="sr-only" aria-live="polite">{Math.ceil(left / 60)} minutes left</span>}
    </div>
  );
}

type Common = { act: <T>(b: Record<string, unknown>) => Promise<T | null>; reload: () => Promise<void>; offset: number; strict: boolean; onSubmit: () => void };

function ConfirmSubmit({ label, note, onSubmit }: { label: string; note?: string; onSubmit: () => void }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className="btn btn-primary" onClick={() => setAsk(true)}>{label}</button>;
  return (
    <div className="card space-y-2 border-saffron-500">
      <p className="text-sm">Submit this section? You cannot change your answers afterwards.{note ? ` ${note}` : ""}</p>
      <div className="flex gap-2"><button type="button" className="btn btn-primary" onClick={onSubmit}>Yes, submit</button><button type="button" className="btn btn-secondary" onClick={() => setAsk(false)}>Keep working</button></div>
    </div>
  );
}

function useAnswers(initial: Record<string, number | string>, section: SectionKey, act: Common["act"]) {
  const [answers, setAnswers] = useState(initial);
  const choose = async (qid: string, value: number) => {
    const prev = answers[qid];
    setAnswers((a) => ({ ...a, [qid]: value }));
    const r = await act({ action: "answer", section, qid, value });
    if (!r) setAnswers((a) => { const c = { ...a }; if (prev === undefined) delete c[qid]; else c[qid] = prev; return c; });
  };
  return { answers, choose };
}

function QuestionCard({ q, n, chosen, locked, onChoose, name }: { q: Q; n: number; chosen: number | undefined; locked: boolean; onChoose: (j: number) => void; name: string }) {
  const revealed = q.answer !== undefined;
  return (
    <fieldset className="rounded-xl border border-app p-3">
      <legend className="px-1 font-medium">{n}. {q.q.fr && <span lang="fr" className="block">{q.q.fr}</span>}<span className={q.q.fr ? "text-sm text-muted" : ""}>{q.q.en}</span></legend>
      <div className="mt-2 grid gap-2">
        {q.options.map((o, j) => (
          <label key={j} className={`flex items-start gap-2 rounded-lg border p-2 ${revealed ? (j === q.answer ? "border-green-600 bg-green-50 dark:bg-green-900/30" : j === chosen ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-app") : chosen === j ? "border-brand-500" : "border-app"}`}>
            <input type="radio" name={name} checked={chosen === j} disabled={locked} onChange={() => onChoose(j)} className="mt-1" />
            <span lang="fr">{o}</span>
          </label>
        ))}
      </div>
      {revealed && (
        <div className="mt-2 rounded-lg surface-2 p-2 text-sm">
          <p className="font-medium">{chosen === q.answer ? "Correct" : chosen === undefined ? "No answer" : "Not quite"}{q.kind ? ` · ${KIND_LABEL[q.kind] ?? q.kind}` : ""}</p>
          {q.explanation && <Bi t={q.explanation} />}
          {q.evidence && <p className="mt-1">Evidence: <q lang="fr">{q.evidence}</q></p>}
        </div>
      )}
    </fieldset>
  );
}

function ResultSummary({ r, what }: { r: Result; what: string }) {
  return (
    <div className="card space-y-2">
      <p className="text-lg font-semibold">{what}: {r.correct} / {r.total} correct</p>
      <p className="text-xs text-muted">Raw practice count. Not a TEF score, CEFR level or NCLC level.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <table className="text-sm"><caption className="text-left font-medium">By part</caption><tbody>{r.bySection.map((b) => <tr key={b.key}><td className="pr-2">{b.title}</td><td className="text-right font-mono">{b.correct}/{b.total}</td></tr>)}</tbody></table>
        <table className="text-sm"><caption className="text-left font-medium">By question type</caption><tbody>{Object.entries(r.byKind).map(([k, b]) => <tr key={k}><td className="pr-2">{KIND_LABEL[k] ?? k}</td><td className="text-right font-mono">{b.correct}/{b.total}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

// ───────────── Reading ─────────────

function Reading({ v, act, onSubmit }: { v: ReadingV } & Common) {
  const done = !!v.submittedAt;
  const { answers, choose } = useAnswers(v.answers, "reading", act);
  const all = v.parts.flatMap((p) => p.items.flatMap((it) => it.questions));
  const answered = all.filter((q) => typeof answers[q.id] === "number").length;
  let n = 0;
  return (
    <div className="space-y-4">
      {done && v.result && <ResultSummary r={v.result} what="Reading" />}
      {!done && <p className="text-sm text-muted" aria-live="polite">{answered} of {all.length} answered. Your answers are saved as you choose them.</p>}
      {v.parts.map((p) => (
        <section key={p.key} className="space-y-3">
          <h2 className="text-lg font-semibold" lang="fr">{p.title}</h2>
          <p className="text-sm">{p.instruction}</p>
          {p.items.map((it, ii) => (
            <div key={ii} className="card space-y-3">
              <article lang="fr" className="whitespace-pre-wrap rounded-lg surface-2 p-3"><p className="mb-1 text-xs uppercase text-muted">{it.document.genre}</p><h3 className="font-semibold">{it.document.title}</h3>{it.document.text}</article>
              {it.questions.map((q) => { n++; return <QuestionCard key={q.id} q={q} n={n} name={q.id} chosen={answers[q.id] as number | undefined} locked={done} onChoose={(j) => choose(q.id, j)} />; })}
            </div>
          ))}
        </section>
      ))}
      {!done && <ConfirmSubmit label="Submit reading" note={answered < all.length ? `${all.length - answered} questions have no answer.` : undefined} onSubmit={onSubmit} />}
    </div>
  );
}

// ───────────── Listening ─────────────

function Listening({ v, act, strict, onSubmit, reload }: { v: ListeningV } & Common) {
  const done = !!v.submittedAt;
  const { answers, choose } = useAnswers(v.answers, "listening", act);
  const [view, setView] = useState(v.position);
  const [phase, setPhase] = useState<"idle" | "playing">("idle");
  const [played, setPlayed] = useState<number[]>(v.played);
  const { play, playing, error, stop } = usePlayer();
  const cur = done ? null : v.items[strict ? v.position : view];

  const start = async () => {
    if (!cur) return;
    const r = await act<{ lines: { voice: VoiceKey; text: string }[] }>({ action: "play", n: cur.n });
    if (!r) return;
    setPlayed((p) => [...new Set([...p, cur.n])]);
    setPhase("playing");
    await play(r.lines);
    setPhase("idle");
  };
  const next = async () => {
    stop();
    const r = await act<{ position: number }>({ action: "next" });
    if (r) { await reload(); setView(r.position); }
  };

  if (done) {
    return (
      <div className="space-y-4">
        {v.result && <ResultSummary r={v.result} what="Listening" />}
        {v.items.map((it) => (
          <div key={it.n} className="card space-y-3">
            <h3 className="font-semibold">Recording {it.n + 1} <span className="text-sm font-normal text-muted" lang="fr">· {it.sectionTitle}</span></h3>
            {it.questions.map((q, qi) => <QuestionCard key={q.id} q={q} n={qi + 1} name={q.id} chosen={answers[q.id] as number | undefined} locked onChoose={() => {}} />)}
            {it.transcript && (
              <details><summary className="cursor-pointer text-sm font-medium">Transcript</summary>
                <ol className="mt-2 space-y-1 text-sm">{it.transcript.map((l, i) => <li key={i}><span className="font-semibold">{l.speaker}:</span> <span lang="fr">{l.fr}</span> <Speak text={l.fr} voice={l.voice} /></li>)}</ol>
              </details>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (!cur) return null;
  const isLast = cur.n === v.count - 1;
  const hasPlayed = played.includes(cur.n);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-saffron-500/60 p-3 text-sm">
        {strict
          ? <p>Read the questions, then play the recording. It plays <strong>once</strong>, with no pause or replay. When you move on you cannot come back.</p>
          : <p>Relaxed mode: you can replay recordings and go back.</p>}
      </div>
      <AudioSourceNote />
      <div className="card space-y-3">
        <p className="text-sm text-muted">Recording {cur.n + 1} of {v.count} · <span lang="fr">{cur.sectionTitle}</span></p>
        {(cur.n === 0 || v.items[cur.n - 1]?.sectionKey !== cur.sectionKey) && <p className="text-sm">{cur.instruction}</p>}
        <p lang="fr" className="font-medium">{cur.context}</p>
        {phase === "playing"
          ? <p className="font-medium" aria-live="polite">🔊 Playing… {playing !== null ? `line ${playing + 1}` : ""}</p>
          : (!hasPlayed || !strict) && <button type="button" className="btn btn-primary" onClick={start}>▶ {hasPlayed ? "Play again" : strict ? "Play the recording (once)" : "Play the recording"}</button>}
        {hasPlayed && strict && phase === "idle" && <p className="text-sm text-muted">The recording has been played.</p>}
        {error && <p role="alert" className="text-sm">{error}</p>}
        {cur.questions.map((q, qi) => <QuestionCard key={q.id} q={q} n={qi + 1} name={q.id} chosen={answers[q.id] as number | undefined} locked={false} onChoose={(j) => choose(q.id, j)} />)}
      </div>
      <div className="flex flex-wrap gap-2">
        {!strict && view > 0 && <button type="button" className="btn btn-secondary" onClick={() => setView(view - 1)}>← Previous</button>}
        {!isLast && (strict
          ? <button type="button" className="btn btn-primary" disabled={!hasPlayed || phase === "playing"} onClick={next}>Next recording →</button>
          : <button type="button" className="btn btn-primary" onClick={() => setView(view + 1)}>Next recording →</button>)}
        {(isLast || !strict) && <ConfirmSubmit label="Submit listening" onSubmit={onSubmit} />}
      </div>
    </div>
  );
}

// ───────────── Writing ─────────────

const countWords = (t: string) => (t.trim().match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

function Writing({ v, act, onSubmit }: { v: WritingV } & Common) {
  const done = !!v.submittedAt;
  const [text, setText] = useState({ a: String(v.answers.a ?? ""), b: String(v.answers.b ?? "") });
  const [saved, setSaved] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef(text);
  latest.current = text;
  const persist = useCallback(async (k: "a" | "b") => {
    setSaved("saving");
    const r = await act({ action: "answer", section: "writing", qid: k, value: latest.current[k] });
    setSaved(r ? "saved" : "error");
  }, [act]);
  const change = (k: "a" | "b", t: string) => {
    setText((x) => ({ ...x, [k]: t }));
    setSaved("unsaved");
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => persist(k), 1200);
  };
  const flushAndSubmit = async () => { for (const k of ["a", "b"] as const) { clearTimeout(timers.current[k]); await persist(k); } onSubmit(); };
  return (
    <div className="space-y-4">
      {!done && <p className="text-sm text-muted" aria-live="polite">Both tasks share the 60 minutes. {saved === "saved" ? "All changes saved." : saved === "saving" ? "Saving…" : saved === "error" ? "Could not save. Check your connection." : "Unsaved changes…"}</p>}
      {(["a", "b"] as const).map((k) => {
        const t = v.tasks[k];
        const wc = countWords(text[k]);
        return (
          <div key={k} className="card space-y-3">
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <Bi t={t.instruction} className="text-sm" />
            <blockquote lang="fr" className="whitespace-pre-wrap rounded-lg border-l-4 border-brand-500 surface-2 p-3">{t.stimulus}</blockquote>
            <label htmlFor={`w-${k}`} className="sr-only">Your text for {t.title}</label>
            <textarea id={`w-${k}`} lang="fr" rows={k === "a" ? 8 : 14} className="input" spellCheck={false} value={text[k]} readOnly={done} onChange={(e) => change(k, e.target.value)} />
            {!done && <AccentBar targetId={`w-${k}`} />}
            <p className={`text-sm ${wc < t.minWords ? "text-muted" : ""}`}>{wc} words · at least {t.minWords}</p>
            {done && <WritingFeedback k={k} act={act} initial={v.feedback[k] ?? null} original={text[k]} />}
          </div>
        );
      })}
      {!done && <ConfirmSubmit label="Submit writing" note={countWords(text.a) < v.tasks.a.minWords || countWords(text.b) < v.tasks.b.minWords ? "At least one text is under the minimum length." : undefined} onSubmit={flushAndSubmit} />}
    </div>
  );
}

function WritingFeedback({ k, act, initial, original }: { k: "a" | "b"; act: Common["act"]; initial: FeedbackEnvelope | null; original: string }) {
  const [fb, setFb] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { providers } = usePrefs();
  if (!original.trim()) return <p className="text-sm text-muted">No text was written for this task.</p>;
  if (fb) return <FeedbackView fb={fb} original={original} />;
  return (
    <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); setFb(await act<FeedbackEnvelope>({ action: "writing_feedback", task: k })); setBusy(false); }}>
      {busy ? "Checking…" : providers.ai.available ? "Get feedback" : "Run the rule-based check (not AI)"}
    </button>
  );
}

// ───────────── Speaking ─────────────

function Speaking({ v, act, offset, strict, reload, sessions }: { v: SpeakingV; sessions: AttemptView["speakingSessions"] } & Common) {
  const done = !!v.submittedAt;
  const [open, setOpen] = useState<"a" | "b" | null>(() => (v.tasks.a.state && !v.tasks.a.state.endedAt ? "a" : v.tasks.b.state && !v.tasks.b.state.endedAt ? "b" : null));
  const begin = async (k: "a" | "b") => { const r = await act({ action: "speak_start", task: k }); if (r) { await reload(); setOpen(k); } };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Section A first, then section B. Each task has its own clock. You can speak (where your browser supports it) or type.</p>
      {(["a", "b"] as const).map((k) => {
        const t = v.tasks[k];
        const sess = sessions[k];
        const locked = k === "b" && !v.tasks.a.state?.endedAt;
        return (
          <div key={k} className="card space-y-3">
            <h2 className="text-lg font-semibold">{t.title} <span className="text-sm font-normal text-muted">· {t.minutes} min</span></h2>
            <Bi t={t.instruction} className="text-sm" />
            {!t.state && !done && <button type="button" className="btn btn-primary" disabled={locked} onClick={() => begin(k)}>{locked ? "Finish section A first" : `Start section ${k.toUpperCase()}`}</button>}
            {!t.state && done && <p className="text-sm text-muted">Not attempted.</p>}
            {t.state && sess && (open === k || t.state.endedAt) && (
              <Conversation id={sess.id} isDemo={sess.isDemo} scenario={sess.scenario} exam
                deadline={strict && !t.state.endedAt ? t.state.deadline : undefined} clockOffsetMs={offset}
                initialTurns={sess.turns as Turn[]} initialReport={sess.report}
                onExit={() => { setOpen(null); reload(); }}
                transport={{
                  turn: async (text, via) => { const r = await act<{ partner: Turn; finished: boolean; note?: string }>({ action: "speak_turn", task: k, text, via }); if (!r) throw new Error("Your turn could not be sent."); return r; },
                  end: async () => { const r = await act<{ report: SpeakingReport | null }>({ action: "speak_end", task: k }); if (!r) throw new Error("Could not end the task."); return r.report; },
                }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
