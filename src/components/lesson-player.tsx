"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ClientLesson } from "@/server/lesson-view";
import { api } from "@/lib/api-client";
import { ReportProblem } from "./report-problem";
import { BLOCK_LABELS, BLOCK_ORDER, type BlockKey } from "@/lib/schedule";
import { Bi } from "./bi";
import { FrItem, Pron } from "./fr-item";
import { AudioSourceNote, Speak, usePlayer } from "./audio";
import { Dictation, GapFill, McqLive, ResultLine } from "./exercises";
import { Recorder } from "./recorder";
import { TappableText } from "./tappable";
import { WritingEditor } from "./writing-editor";
import { AccentBar } from "./accent-bar";
import type { AnswerCheck } from "@/lib/text";

type Props = { lesson: ClientLesson; activities: Record<string, boolean>; minutes: Record<BlockKey, number>; share: number; reviewStatus: string; dueCount: number };

const take = <T,>(arr: T[], share: number, min = 2) => (share >= 1 ? arr : arr.slice(0, Math.max(min, Math.ceil(arr.length * share))));

export function LessonPlayer({ lesson: d, activities: initial, minutes, share, reviewStatus, dueCount }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>(initial);
  const [completed, setCompleted] = useState(BLOCK_ORDER.every((b) => initial[b]));
  const lastMark = useRef(Date.now());

  const mark = async (block: BlockKey) => {
    const elapsed = (Date.now() - lastMark.current) / 60000;
    const m = Math.round(Math.min(elapsed, Math.max(minutes[block], 5) * 1.5) * 10) / 10;
    lastMark.current = Date.now();
    const r = await api<{ activities: Record<string, boolean>; completed: boolean }>(`/api/lesson/${d.day}/block`, { body: { block, minutes: m } });
    setDone(r.activities);
    setCompleted(r.completed);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted">Day {d.day} · Phase {d.phase}{d.light && " · Lighter review day"}{d.checkpoint && " · Checkpoint"}</p>
        <h1 className="text-2xl font-bold" lang="fr">{d.title.fr}</h1>
        <p className="text-lg">{d.title.en} <span lang="hi" className="deva text-muted">· {d.title.hi}</span></p>
        <div className="card surface-2">
          <p className="text-sm font-semibold">Today you will be able to</p>
          <Bi t={d.objective} />
          <p className="mt-2 text-sm font-semibold">Before this lesson</p>
          <Bi t={d.prerequisites.summary} className="text-sm" />
          {d.prerequisites.days.length > 0 && <p className="text-sm">Builds on {d.prerequisites.days.map((x, i) => <span key={x}>{i > 0 && ", "}<Link className="underline" href={`/lesson/${x}`}>Day {x}</Link></span>)}</p>}
          <p className="mt-2 text-sm text-muted">Estimated time: {Object.values(minutes).reduce((a, b) => a + b, 0)} minutes{share < 1 && ` (shorter version: about ${Math.round(share * 100)}% of exercises)`}.</p>
        </div>
        {d.mock && <p className="card border-brand-500/50">This is a mock exam day. After the warm-up below, go to <Link className="font-semibold underline" href={`/exam?mock=${d.mock.id}&part=${d.mock.part}`}>TEF practice → {d.mock.id.replace("mock-", "Practice exam ")}</Link>{d.mock.part === "review" ? " to review your results." : "."}</p>}
        <ContentStatus status={reviewStatus} day={d.day} />
        <nav aria-label="Lesson sections" className="flex flex-wrap gap-2">
          {BLOCK_ORDER.map((b) => <a key={b} href={`#${b}`} className={`chip border ${done[b] ? "border-brand-500 bg-brand-100 text-brand-900" : "border-app"}`}>{done[b] ? "✓ " : ""}{BLOCK_LABELS[b].en}</a>)}
        </nav>
      </header>

      <Section id="review" minutes={minutes.review} done={done.review} onDone={() => mark("review")}>
        <p className="text-sm">You have <strong>{dueCount}</strong> cards due in your spaced review. <Link className="underline" href="/review">Open review</Link>, then come back.</p>
        <p className="mt-3 text-sm font-medium">Quick recall from earlier days — say the meaning before revealing it:</p>
        <ul className="mt-1 grid gap-2 sm:grid-cols-2">{d.review.items.map((it, i) => <RecallItem key={i} item={it} day={d.day} />)}</ul>
      </Section>

      <Section id="learn" minutes={minutes.learn} done={done.learn} onDone={() => mark("learn")} doneNote="Marking this done adds today's words and phrases to your spaced review.">
        <h3 className="font-semibold">Vocabulary</h3>
        <ul className="divide-y divide-[var(--border)]">{d.vocabulary.map((v, i) => <li key={i}><FrItem item={v} day={d.day} /></li>)}</ul>
        <h3 className="mt-4 font-semibold">Reusable phrases</h3>
        <ul className="divide-y divide-[var(--border)]">{d.phrases.map((v, i) => <li key={i}><FrItem item={v} day={d.day} /></li>)}</ul>
        <div className="mt-4 rounded-xl border border-brand-500/40 p-4">
          <h3 className="font-semibold"><Bi as="span" t={d.grammar.title} /></h3>
          <Bi t={d.grammar.explanation} className="mt-2" />
          {d.grammar.comparison && <div className="mt-3 rounded-lg surface-2 p-3"><p className="text-xs font-semibold uppercase text-muted">Compare with English and Hindi</p><Bi t={d.grammar.comparison} /></div>}
          <ul className="mt-3 divide-y divide-[var(--border)]">{d.grammar.examples.map((v, i) => <li key={i}><FrItem item={v} day={d.day} save={false} /></li>)}</ul>
          <p className="mt-3 text-xs font-semibold uppercase text-muted">Watch out</p>
          <ul className="list-disc space-y-1 pl-5">{d.grammar.pitfalls.map((p, i) => <Bi key={i} as="li" t={p} />)}</ul>
        </div>
        <div className="mt-4 rounded-xl surface-2 p-4">
          <h3 className="font-semibold">Pronunciation focus: {d.pronunciation.focus}</h3>
          <Bi t={d.pronunciation.tip} className="mt-1" />
          <ul className="mt-2 divide-y divide-[var(--border)]">{d.pronunciation.words.map((v, i) => <li key={i}><FrItem item={v} day={d.day} save={false} /></li>)}</ul>
          <Link href="/pronunciation" className="mt-2 inline-block text-sm underline">More drills in the pronunciation lab</Link>
        </div>
      </Section>

      <Section id="listening" minutes={minutes.listening} done={done.listening} onDone={() => mark("listening")}>
        <ListeningBlock d={d} share={share} />
      </Section>

      <Section id="speaking" minutes={minutes.speaking} done={done.speaking} onDone={() => mark("speaking")}>
        <Bi t={d.speaking.instructions} />
        {d.speaking.focusSound && <p className="mt-1 text-sm">Focus sound: <strong>{d.speaking.focusSound}</strong></p>}
        <ol className="mt-3 space-y-4">
          {take(d.speaking.prompts, share, 3).map((p, i) => (
            <li key={i} className="space-y-1">
              <FrItem item={p} day={d.day} save={false} compact />
              <Recorder model={p.model ?? p.fr.replace(/…|\.\.\./g, "")} refKey={`day:${d.day}:speaking:${i}`} compact />
            </li>
          ))}
        </ol>
        <Bi t={d.speaking.tip} className="mt-3 rounded-lg surface-2 p-3 text-sm" />
        {d.speaking.scenario && (
          <div className="mt-3 rounded-xl border border-app p-3">
            <p className="font-semibold">Role-play</p>
            <Bi t={d.speaking.scenario.setting} className="text-sm" />
            <p className="mt-1 text-sm"><strong>You:</strong> <Bi as="span" t={d.speaking.scenario.learnerRole} /></p>
            <p className="text-sm"><strong>Partner:</strong> <Bi as="span" t={d.speaking.scenario.partnerRole} /></p>
            <Link className="btn btn-primary btn-sm mt-2" href={`/speaking?scenario=day:${d.day}`}>Practise this with the speaking tutor</Link>
          </div>
        )}
      </Section>

      <Section id="reading" minutes={minutes.reading} done={done.reading} onDone={() => mark("reading")}>
        <ReadingBlock d={d} share={share} />
      </Section>

      <Section id="writing" minutes={minutes.writing} done={done.writing} onDone={() => mark("writing")}>
        <Bi t={d.writing.prompt} className="font-medium" />
        <p className="text-sm text-muted">At least {d.writing.minWords} words{d.writing.maxWords ? `, at most ${d.writing.maxWords}` : ""}.</p>
        <WritingEditor taskType={d.writing.type} taskRef={`day:${d.day}`} minWords={d.writing.minWords} maxWords={d.writing.maxWords} prompt={d.writing.prompt.fr ?? d.writing.prompt.en}
          learn={{ hints: d.writing.hints, phrases: d.writing.usefulPhrases, model: d.writing.model, checklist: d.writing.checklist }} defaultMode="practice" />
      </Section>

      <Section id="assessment" minutes={minutes.assessment} done={done.assessment} onDone={() => mark("assessment")} requireNote="Submit the check first.">
        <AssessmentBlock d={d} onSubmitted={() => !done.assessment && mark("assessment")} />
      </Section>

      {completed && (
        <div className="card border-brand-500 bg-brand-50 text-center dark:bg-brand-900/30" role="status">
          <p className="text-xl font-bold">Day {d.day} complete 🎉</p>
          <p className="text-sm">Lesson completion is recorded separately from mastery — your answers today feed your skill progress.</p>
          {d.day < 120 && <Link href="/today" className="btn btn-primary mt-3">Back to Today</Link>}
          {d.checkpoint && <Link href={`/progress?checkpoint=${d.day}`} className="btn btn-secondary mt-3 ml-2">See checkpoint report</Link>}
        </div>
      )}
    </div>
  );
}

function ContentStatus({ status, day }: { status: string; day: number }) {
  const label = status === "reviewed" ? "Reviewed by an editor" : status === "in_review" ? "In editorial review" : "AI-drafted lesson — not yet reviewed by a human expert";
  return (
    <div className="text-xs text-muted">
      <span className="chip surface-2">{label}</span>{" "}
      <ReportProblem target={`day:${day}`} />
    </div>
  );
}

function Section({ id, minutes, done, onDone, children, doneNote, requireNote }: { id: BlockKey; minutes: number; done?: boolean; onDone: () => Promise<void> | void; children: React.ReactNode; doneNote?: string; requireNote?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <section id={id} className="card scroll-mt-20" aria-labelledby={`${id}-h`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-h`} className="text-lg font-semibold"><Bi as="span" t={BLOCK_LABELS[id]} /></h2>
        <span className="text-sm text-muted">{minutes > 0 ? `${minutes} min` : "optional today"}{done && " · ✓ done"}</span>
      </div>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-app pt-3">
        {done ? <span className="text-sm font-medium text-brand-700 dark:text-brand-200">✓ Completed</span> : (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onDone(); } finally { setBusy(false); } }}>Mark {BLOCK_LABELS[id].en.toLowerCase()} done</button>
        )}
        {doneNote && !done && <span className="text-xs text-muted">{doneNote}</span>}
        {requireNote && !done && <span className="text-xs text-muted">{requireNote}</span>}
      </div>
    </section>
  );
}

function RecallItem({ item, day }: { item: { fr: string; en: string; hi: string; pron?: string }; day: number }) {
  const [shown, setShown] = useState(false);
  return (
    <li className="rounded-lg border border-app p-2">
      <div className="flex items-center gap-2"><span lang="fr" className="fr">{item.fr}</span><Speak text={item.fr} showSlow={false} /></div>
      {shown ? <p className="text-sm">{item.en} · <span lang="hi" className="deva">{item.hi}</span> <Pron pron={item.pron} day={day} /></p>
        : <button type="button" className="text-sm underline" onClick={() => setShown(true)}>Reveal meaning</button>}
    </li>
  );
}

export function ListeningBlock({ d, share }: { d: ClientLesson; share: number }) {
  const L = d.listening;
  const { play, stop, playing, error } = usePlayer();
  const [answered, setAnswered] = useState(0);
  const [showScript, setShowScript] = useState(false);
  const qs = take(L.questions, share, 3);
  const lines = L.lines.map((l) => ({ text: l.fr, voice: l.voice }));
  const canReveal = answered >= qs.length;
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium" lang="fr">{L.title.fr} <span className="text-muted">· {L.title.en}</span></p>
        <Bi t={L.context} className="text-sm text-muted" />
        <p className="mt-1 text-xs"><span className={`chip ${L.mode === "pedagogical" ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{L.mode === "pedagogical" ? "Teaching speed: deliberately slow and clear" : "Natural speed"}</span></p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => (playing !== null ? stop() : play(lines))}>{playing !== null ? "■ Stop" : "▶ Play the audio"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => play(lines, { slow: true })}>🐢 Play slowly</button>
        {playing !== null && <span className="self-center text-sm text-muted" aria-live="polite">Line {playing + 1} of {lines.length}</span>}
      </div>
      {error && <p role="alert" className="text-sm">{error}</p>}
      <AudioSourceNote />
      <p className="text-sm">Listen first, answer the questions, then reveal the transcript.</p>
      <div className="space-y-3">
        {qs.map((q, i) => <McqLive key={i} q={q} index={i} name={`l-${d.day}-${i}`} section="listening" endpoint={`/api/lesson/${d.day}/answer`} onAnswered={() => setAnswered((n) => n + 1)} />)}
      </div>
      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowScript((s) => !s)} disabled={!canReveal} aria-expanded={showScript}>{showScript ? "Hide transcript" : canReveal ? "Show transcript and translation" : `Transcript unlocks after the questions (${answered}/${qs.length})`}</button>
        {showScript && (
          <ol className="mt-2 space-y-2">
            {L.lines.map((l, i) => (
              <li key={i} className={`rounded-lg p-2 ${playing === i ? "bg-brand-50 dark:bg-brand-900/40" : ""}`}>
                <p><span className="text-sm font-semibold">{l.speaker}:</span> <span lang="fr">{l.fr}</span> <Speak text={l.fr} voice={l.voice} /></p>
                <p className="text-sm text-muted">{l.en} · <span lang="hi" className="deva">{l.hi}</span></p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div><h3 className="font-semibold">Dictation</h3><p className="text-sm text-muted">Listen and write exactly what you hear.</p><Dictation sentences={L.dictation} day={d.day} /></div>
      <div><h3 className="font-semibold">Missing words</h3><p className="text-sm text-muted">Fill the gaps from the dialogue.</p><GapFill text={L.gapFill.text} answers={L.gapFill.answers} day={d.day} /></div>
    </div>
  );
}

export function ReadingBlock({ d, share }: { d: ClientLesson; share: number }) {
  const R = d.reading;
  const [answered, setAnswered] = useState(0);
  const [showT, setShowT] = useState(false);
  const qs = take(R.questions, share, 3);
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted">{R.genre}</p>
      <div className="rounded-xl surface-2 p-4"><p className="mb-2 font-semibold" lang="fr">{R.title}</p><TappableText text={R.text} sourceRef={`day:${d.day}:reading`} /></div>
      {qs.map((q, i) => <McqLive key={i} q={q} index={i} name={`r-${d.day}-${i}`} section="reading" endpoint={`/api/lesson/${d.day}/answer`} onAnswered={() => setAnswered((n) => n + 1)} />)}
      <button type="button" className="btn btn-secondary btn-sm" disabled={answered < qs.length} onClick={() => setShowT((s) => !s)}>{answered < qs.length ? `Translation unlocks after the questions (${answered}/${qs.length})` : showT ? "Hide translation" : "Show translation"}</button>
      {showT && <div className="grid gap-3 sm:grid-cols-2"><p className="whitespace-pre-wrap text-sm">{R.translation.en}</p><p lang="hi" className="deva whitespace-pre-wrap text-sm">{R.translation.hi}</p></div>}
    </div>
  );
}

type AResult = { score: number; results: (AnswerCheck & { explanation: { en: string; hi: string } })[] };

function AssessmentBlock({ d, onSubmitted }: { d: ClientLesson; onSubmitted: () => void }) {
  const [resp, setResp] = useState<(string | number | null)[]>(d.assessment.map(() => null));
  const [res, setRes] = useState<AResult | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (i: number, v: string | number) => setResp((r) => r.map((x, j) => (j === i ? v : x)));
  const submit = async () => {
    setBusy(true);
    try { const r = await api<AResult>(`/api/lesson/${d.day}/assessment`, { body: { responses: resp } }); setRes(r); onSubmitted(); } finally { setBusy(false); }
  };
  useEffect(() => { if (res) document.getElementById("assessment-result")?.focus(); }, [res]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Answer everything first; answers and explanations appear after you submit.</p>
      {d.assessment.map((q, i) => (
        <fieldset key={i} className="rounded-xl border border-app p-3">
          <legend className="px-1 font-medium">{i + 1}. <Bi as="span" t={q.prompt} /></legend>
          {q.type === "mcq" && <div className="mt-2 grid gap-2">{q.options.map((o, j) => (
            <label key={j} className={`flex cursor-pointer gap-2 rounded-lg border p-2 ${resp[i] === j ? "border-brand-500" : "border-app"}`}><input type="radio" name={`a-${i}`} checked={resp[i] === j} disabled={!!res} onChange={() => set(i, j)} /><span lang="fr">{o}</span></label>
          ))}</div>}
          {q.type === "fill" && <><p lang="fr" className="mt-2">{q.sentence.replace("___", "_____")}</p><input lang="fr" className="input mt-1" aria-label="Your answer" value={(resp[i] as string) ?? ""} disabled={!!res} onChange={(e) => set(i, e.target.value)} /></>}
          {q.type === "translate" && <><p className="mt-2">{q.source.en} <span lang="hi" className="deva text-muted">· {q.source.hi}</span></p><input lang="fr" className="input mt-1" aria-label="Your French translation" value={(resp[i] as string) ?? ""} disabled={!!res} onChange={(e) => set(i, e.target.value)} /></>}
          {q.type === "reorder" && <Reorder words={q.words} disabled={!!res} onChange={(v) => set(i, v)} />}
          {res && (
            <div className="mt-2 rounded-lg surface-2 p-2 text-sm">
              <ResultLine r={res.results[i]} />
              <Bi t={res.results[i].explanation} />
            </div>
          )}
        </fieldset>
      ))}
      {(d.assessment.some((q) => q.type !== "mcq")) && !res && <AccentBar />}
      {!res ? <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Checking…" : "Submit answers"}</button> : (
        <div id="assessment-result" tabIndex={-1} className="rounded-xl bg-brand-50 p-3 dark:bg-brand-900/30" role="status">
          <p className="font-semibold">Score: {Math.round(res.score * 100)}%</p>
          <p className="text-sm">Mistakes were added to your mistake notebook as practice exercises. {res.score < 0.6 ? "Consider re-reading the grammar box and retrying tomorrow — that's normal." : "Well done."}</p>
          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => { setRes(null); setResp(d.assessment.map(() => null)); }}>Try again</button>
        </div>
      )}
    </div>
  );
}

function Reorder({ words, disabled, onChange }: { words: string[]; disabled: boolean; onChange: (v: string) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const update = (p: number[]) => { setPicked(p); onChange(p.map((i) => words[i]).join(" ").replace(/\s+([?!.,])/g, " $1").replace(/ \./g, ".").replace(/ ,/g, ",")); };
  return (
    <div className="mt-2 space-y-2">
      <p className="min-h-10 rounded-lg border border-dashed border-app p-2" lang="fr" aria-live="polite">{picked.map((i) => words[i]).join(" ") || <span className="text-muted">Tap the words in order</span>}</p>
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => <button key={i} type="button" lang="fr" disabled={disabled || picked.includes(i)} className="btn btn-secondary btn-sm" onClick={() => update([...picked, i])}>{w}</button>)}
        {picked.length > 0 && !disabled && <button type="button" className="btn btn-ghost btn-sm" onClick={() => update([])}>Clear</button>}
      </div>
    </div>
  );
}
