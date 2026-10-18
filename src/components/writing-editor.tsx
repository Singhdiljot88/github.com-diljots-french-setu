"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { checkAnswer, diffWords, wordCount, type AnswerCheck } from "@/lib/text";
import { ResultLine } from "./exercises";
import type { FeedbackEnvelope } from "@/lib/feedback-schema";
import { AccentBar } from "./accent-bar";
import { Bi } from "./bi";
import { FrItem } from "./fr-item";

type Explain = { en: string; hi: string };
type LearnAids = { hints: Explain[]; phrases: { fr: string; en: string; hi: string; pron?: string }[]; model?: { fr: string; en: string }; checklist?: Explain[]; outline?: Explain[] };
type Draft = { id: string; text: string; status: "draft" | "submitted"; mode: "learn" | "practice" | "exam"; updatedAt: string; wordCount: number };
type Revision = { id: string; text: string; reason: string; createdAt: string };

export type WritingEditorProps = {
  taskType: string; taskRef: string; minWords: number; maxWords?: number; prompt: string;
  learn?: LearnAids; defaultMode?: "learn" | "practice" | "exam"; allowedModes?: ("learn" | "practice" | "exam")[]; timeLimitSec?: number; onSubmitted?: (draftId: string) => void;
};

export function WritingEditor(p: WritingEditorProps) {
  const modes = p.allowedModes ?? ["learn", "practice", "exam"];
  const [mode, setMode] = useState<"learn" | "practice" | "exam">(p.defaultMode ?? "practice");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline" | "error">("idle");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [restore, setRestore] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEnvelope | null>(null);
  const [fbState, setFbState] = useState<"idle" | "loading" | "error">("idle");
  const [fbError, setFbError] = useState<string | null>(null);
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [showModel, setShowModel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaId = `w-${p.taskRef.replace(/[^a-z0-9]/gi, "-")}-${mode}`;
  const localKey = draft ? `fs-draft-${draft.id}` : null;
  const submitted = draft?.status === "submitted";
  const exam = mode === "exam";
  const assisted = mode === "learn" || (mode === "practice" && submitted) || (exam && submitted);

  const load = useCallback(async (m: typeof mode) => {
    setFeedback(null); setHistory(null); setShowModel(false); setRestore(null);
    const r = await api<{ draft: Draft; deadline: string | null; serverNow: string }>("/api/writing/drafts", { body: { taskType: p.taskType, taskRef: p.taskRef, mode: m, timeLimitSec: m === "exam" ? p.timeLimitSec ?? null : null } });
    setDraft(r.draft); setText(r.draft.text);
    setSkew(Date.parse(r.serverNow) - Date.now());
    setDeadline(r.deadline ? Date.parse(r.deadline) : null);
    try {
      const local = localStorage.getItem(`fs-draft-${r.draft.id}`);
      if (local) {
        const { text: lt, at } = JSON.parse(local) as { text: string; at: number };
        if (lt !== r.draft.text && at > Date.parse(r.draft.updatedAt) && r.draft.status === "draft") setRestore(lt);
      }
    } catch { /* storage unavailable */ }
  }, [p.taskType, p.taskRef, p.timeLimitSec]);

  useEffect(() => { load(mode).catch(() => setSaveState("error")); }, [mode, load]);
  useEffect(() => { if (!deadline) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [deadline]);

  const remaining = deadline ? Math.max(0, Math.round((deadline - (now + skew)) / 1000)) : null;

  const persist = useCallback(async (t: string, reason: "autosave" | "manual" = "autosave") => {
    if (!draft || submitted) return;
    setSaveState("saving");
    try {
      await api(`/api/writing/drafts/${draft.id}`, { method: "PATCH", body: { text: t, reason } });
      setSaveState("saved");
      try { localStorage.removeItem(`fs-draft-${draft.id}`); } catch { /* ignore */ }
    } catch (e) {
      setSaveState((e as { status?: number }).status === 409 ? "error" : "offline");
      if ((e as { status?: number }).status === 409) load(mode);
    }
  }, [draft, submitted, load, mode]);

  const onChange = (t: string) => {
    setText(t);
    if (localKey) try { localStorage.setItem(localKey, JSON.stringify({ text: t, at: Date.now() })); } catch { /* ignore */ }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(t), 1200);
  };

  const submit = useCallback(async () => {
    if (!draft) return;
    if (timer.current) clearTimeout(timer.current);
    await api(`/api/writing/drafts/${draft.id}/submit`, { body: { text } });
    await load(mode);
    p.onSubmitted?.(draft.id);
  }, [draft, text, load, mode, p]);

  useEffect(() => { if (remaining === 0 && draft && !submitted) submit(); }, [remaining, draft, submitted, submit]);

  const getFeedback = async () => {
    if (!draft) return;
    setFbState("loading"); setFbError(null);
    try { setFeedback(await api<FeedbackEnvelope>(`/api/writing/drafts/${draft.id}/feedback`, { body: { prompt: p.prompt, minWords: p.minWords } })); setFbState("idle"); }
    catch (e) { setFbError((e as Error).message); setFbState("error"); }
  };

  const retry = async (startText?: string) => {
    if (!draft) return;
    const r = await api<{ draft: Draft }>(`/api/writing/drafts/${draft.id}/retry`, { body: { text: startText } });
    setDraft(r.draft); setText(r.draft.text); setFeedback(null); setDeadline(null);
    if (mode === "exam") setMode("practice");
  };

  const wc = wordCount(text);
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Writing mode" className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} type="button" className={`btn btn-sm ${mode === m ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode(m)}>
            {m === "learn" ? "Learn (with help)" : m === "practice" ? "Practice (write first)" : "Exam (no help)"}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        {mode === "learn" && "Learn mode: outlines, hints, vocabulary and the model answer are available while you write."}
        {mode === "practice" && "Practice mode: write on your own first; hints, feedback and the model answer appear after you submit."}
        {mode === "exam" && "Exam mode: all assistance is disabled until you submit. The timer is kept on the server and continues if you reload."}
      </p>

      {mode === "learn" && p.learn && <LearnPanel aids={p.learn} showModel={showModel} setShowModel={setShowModel} />}

      {restore !== null && (
        <div className="rounded-lg bg-saffron-100 p-2 text-sm text-saffron-700" role="alert">
          A newer unsaved version was found on this device. <button type="button" className="underline" onClick={() => { onChange(restore); setRestore(null); }}>Restore it</button> or <button type="button" className="underline" onClick={() => { setRestore(null); if (localKey) localStorage.removeItem(localKey); }}>discard</button>.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span aria-live="polite">{wc} words {wc < p.minWords ? `(at least ${p.minWords})` : "✓"}{p.maxWords && wc > p.maxWords ? ` — over ${p.maxWords}` : ""}</span>
        {remaining !== null && !submitted && <span className={`font-mono ${remaining < 120 ? "text-red-700 dark:text-red-300" : ""}`} role="timer" aria-label="Time remaining">⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}
        <span className="text-xs text-muted">{submitted ? "Submitted" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "offline" ? "Offline — saved on this device, will retry" : saveState === "error" ? "Could not save" : ""}</span>
      </div>
      <textarea id={areaId} lang="fr" spellCheck={!exam && mode === "learn"} className="input min-h-48 font-[inherit]" value={text} onChange={(e) => onChange(e.target.value)} readOnly={submitted || !draft}
        aria-label="Your French text" onBlur={() => persist(text)} autoCorrect="off" autoCapitalize="sentences" />
      {!submitted && <AccentBar targetId={areaId} />}
      <div className="flex flex-wrap gap-2">
        {!submitted && <button type="button" className="btn btn-secondary btn-sm" onClick={() => persist(text, "manual")}>Save version</button>}
        {!submitted && <button type="button" className="btn btn-primary btn-sm" disabled={wc === 0} onClick={submit}>Submit{mode !== "learn" ? " and get feedback" : ""}</button>}
        {submitted && !feedback && <button type="button" className="btn btn-primary btn-sm" onClick={getFeedback} disabled={fbState === "loading"}>{fbState === "loading" ? "Checking your text…" : "Get feedback"}</button>}
        {submitted && <button type="button" className="btn btn-secondary btn-sm" onClick={() => retry()}>Edit a new version</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { if (!draft) return; const h = await api<{ revisions: Revision[] }>(`/api/writing/drafts/${draft.id}/history`); setHistory(h.revisions); }}>Version history</button>
      </div>
      {fbError && <p role="alert" className="text-sm text-red-700">{fbError}</p>}
      {history && (
        <div className="rounded-xl surface-2 p-3">
          <p className="font-medium">Version history</p>
          {history.length === 0 && <p className="text-sm text-muted">No saved versions yet. Versions are kept every couple of minutes and on submit.</p>}
          <ul className="mt-1 space-y-2">{history.map((h) => (
            <li key={h.id} className="text-sm"><span className="text-muted">{new Date(h.createdAt).toLocaleString()} · {h.reason}</span>
              <p lang="fr" className="line-clamp-2">{h.text || "(empty)"}</p>
              {!submitted && <button type="button" className="text-xs underline" onClick={() => onChange(h.text)}>Restore this version</button>}
            </li>
          ))}</ul>
        </div>
      )}
      {submitted && mode !== "learn" && p.learn && <LearnPanel aids={p.learn} showModel={showModel} setShowModel={setShowModel} afterSubmit />}
      {feedback && <FeedbackView fb={feedback} original={text} onRetry={(t) => retry(t)} />}
      {assisted ? null : null}
    </div>
  );
}

function LearnPanel({ aids, showModel, setShowModel, afterSubmit }: { aids: LearnAids; showModel: boolean; setShowModel: (b: boolean) => void; afterSubmit?: boolean }) {
  return (
    <div className="space-y-2 rounded-xl surface-2 p-3">
      {afterSubmit && <p className="text-sm font-medium">Now compare with the help that was hidden while you wrote:</p>}
      {aids.outline && <><p className="text-sm font-semibold">Suggested outline</p><ol className="list-decimal pl-5 text-sm">{aids.outline.map((h, i) => <Bi key={i} as="li" t={h} />)}</ol></>}
      <p className="text-sm font-semibold">Hints</p>
      <ul className="list-disc pl-5 text-sm">{aids.hints.map((h, i) => <Bi key={i} as="li" t={h} />)}</ul>
      <p className="text-sm font-semibold">Useful phrases</p>
      <ul className="divide-y divide-[var(--border)]">{aids.phrases.map((ph, i) => <li key={i}><FrItem item={ph} compact /></li>)}</ul>
      {aids.checklist && <><p className="text-sm font-semibold">Checklist</p><ul className="text-sm">{aids.checklist.map((c, i) => <li key={i}>☐ <Bi as="span" t={c} /></li>)}</ul></>}
      {aids.model && (showModel
        ? <div className="rounded-lg border border-app p-2"><p className="text-xs uppercase text-muted">Model answer (one possible version)</p><p lang="fr" className="whitespace-pre-wrap">{aids.model.fr}</p><p className="text-sm text-muted">{aids.model.en}</p></div>
        : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModel(true)}>Show a model answer</button>)}
    </div>
  );
}

export function FeedbackView({ fb, original, onRetry }: { fb: FeedbackEnvelope; original: string; onRetry?: (t: string) => void }) {
  const f = fb.feedback;
  const errors = f.corrections.filter((c) => c.isError);
  const style = f.corrections.filter((c) => !c.isError);
  const [practice, setPractice] = useState<Record<number, string>>({});
  return (
    <section className="space-y-3 rounded-xl border border-brand-500/40 p-3" aria-label="Feedback">
      <p className={`chip ${fb.isDemo ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{fb.label}</p>
      {fb.limitations && <p className="text-xs text-muted">{fb.limitations}</p>}
      <Bi t={f.summary} />
      {f.strengths.length > 0 && <><p className="font-semibold">What works</p><ul className="list-disc pl-5 text-sm">{f.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {f.taskNotes.length > 0 && <ul className="text-sm text-muted">{f.taskNotes.map((s, i) => <li key={i}>• {s}</li>)}</ul>}
      <p className="font-semibold">Corrections ({errors.length})</p>
      {errors.length === 0 && <p className="text-sm">No definite errors were found{fb.isDemo ? " by the rule-based checker (it only knows common patterns, so some errors can slip through)" : ""}.</p>}
      <ol className="space-y-3">{errors.map((c, i) => <CorrectionItem key={i} c={c} i={i} practice={practice} setPractice={setPractice} />)}</ol>
      {style.length > 0 && <><p className="font-semibold">Optional style improvements</p><p className="text-xs text-muted">These are not mistakes — just more natural or richer ways to say it.</p><ol className="space-y-3">{style.map((c, i) => <CorrectionItem key={i} c={c} i={100 + i} practice={practice} setPractice={setPractice} />)}</ol></>}
      <div>
        <p className="font-semibold">Your text, corrected at your level</p>
        <p lang="fr" className="whitespace-pre-wrap rounded-lg surface-2 p-2">{diffWords(original, f.correctedText).map((s, i) => s.type === "same" ? <span key={i}>{s.text}</span> : s.type === "add" ? <mark key={i} className="add">{s.text}</mark> : <mark key={i} className="del">{s.text}</mark>)}</p>
      </div>
      {f.advancedVersion && <details><summary className="cursor-pointer font-semibold">A more advanced version (optional)</summary><p lang="fr" className="mt-1 whitespace-pre-wrap">{f.advancedVersion}</p></details>}
      {onRetry && <button type="button" className="btn btn-primary btn-sm" onClick={() => onRetry(original)}>Retry: rewrite your text using these corrections</button>}
    </section>
  );
}

export function CorrectionItem({ c, i, practice, setPractice }: { c: FeedbackEnvelope["feedback"]["corrections"][number]; i: number; practice: Record<number, string>; setPractice: (f: (p: Record<number, string>) => Record<number, string>) => void }) {
  const [checked, setChecked] = useState<AnswerCheck | null>(null);
  return (
    <li className="rounded-lg surface-2 p-2 text-sm">
      <p><span className="chip bg-[var(--surface)] mr-2">{c.category}</span><mark className="del" lang="fr">{c.original}</mark> → <mark className="add" lang="fr">{c.corrected}</mark></p>
      <Bi t={c.explanation} className="mt-1" />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">Practice:</span><span lang="fr">{c.practice.prompt}</span>
        <input className="input max-w-60 min-h-0 py-1" lang="fr" aria-label="Practice answer" value={practice[i] ?? ""} onChange={(e) => setPractice((p) => ({ ...p, [i]: e.target.value }))} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setChecked(checkAnswer(practice[i] ?? "", c.practice.answer))}>Check</button>
        {checked && <ResultLine r={checked} />}
      </div>
    </li>
  );
}
