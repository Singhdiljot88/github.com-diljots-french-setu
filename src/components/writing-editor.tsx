"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { checkAnswer, diffWords, wordCount, type AnswerCheck } from "@/lib/text";
import { ResultLine } from "./exercises";
import type { FeedbackEnvelope } from "@/lib/feedback-schema";
import { AccentBar } from "./accent-bar";
import { Bi, useBiLabel } from "./bi";
import { FrItem } from "./fr-item";

type Explain = { en: string; hi: string };
type LearnAids = { hints: Explain[]; phrases: { fr: string; en: string; hi: string; pron?: string }[]; model?: { fr: string; en: string }; checklist?: Explain[]; outline?: Explain[] };
type Draft = { id: string; text: string; status: "draft" | "submitted"; mode: "learn" | "practice" | "exam"; updatedAt: string; wordCount: number };
type Revision = { id: string; text: string; reason: string; createdAt: string };

const REASON: Record<string, Explain> = { autosave: { en: "autosave", hi: "अपने-आप सहेजा गया" }, manual: { en: "saved by you", hi: "आपने सहेजा" }, submit: { en: "submitted", hi: "जमा किया गया" }, retry: { en: "new version", hi: "नया संस्करण" } };
export const CATEGORY: Record<string, Explain> = {
  grammar: { en: "grammar", hi: "व्याकरण" }, spelling: { en: "spelling", hi: "वर्तनी" }, gender: { en: "gender", hi: "लिंग" }, agreement: { en: "agreement", hi: "मेल (agreement)" },
  tense: { en: "tense", hi: "काल" }, vocabulary: { en: "vocabulary", hi: "शब्द चयन" }, organization: { en: "organisation", hi: "ढाँचा" },
};

/** Hindi for the fixed notices the server attaches to feedback (labels and limitations). Unknown text stays English. */
const NOTICE_HI: [string, string][] = [
  ["Rule-based check (not AI)", "नियम-आधारित जाँच (AI नहीं)"],
  ["AI feedback — check anything that looks wrong; AI can make mistakes.", "AI फ़ीडबैक — जो ग़लत लगे उसे ज़रूर जाँचें; AI से भी ग़लती हो सकती है।"],
  ["AI feedback on your transcript. It cannot hear your accent; check anything that looks wrong.", "आपके लिखित रूप (ट्रांसक्रिप्ट) पर AI फ़ीडबैक। यह आपका उच्चारण नहीं सुन सकता; जो ग़लत लगे उसे जाँच लें।"],
  ["This is a fixed list of common beginner checks, not an AI tutor. It misses many errors and cannot judge meaning or task completion. Add an AI key on the server for full feedback.", "यह शुरुआती स्तर की आम ग़लतियों की एक तय सूची है, AI शिक्षक नहीं। यह कई ग़लतियाँ छोड़ देती है और अर्थ या कार्य पूरा हुआ या नहीं, यह नहीं परख सकती। पूरे फ़ीडबैक के लिए सर्वर पर AI कुंजी जोड़ें।"],
  ["This checks your transcript for a fixed list of common errors. It cannot judge meaning, fluency, task completion or pronunciation.", "यह आपके ट्रांसक्रिप्ट में आम ग़लतियों की एक तय सूची जाँचता है। यह अर्थ, धाराप्रवाह, कार्य पूरा होना या उच्चारण नहीं परख सकता।"],
];
export function noticeBi(en: string): { en: string; hi?: string } {
  const hit = NOTICE_HI.find(([e]) => en === e || en.endsWith(` ${e}`));
  return hit ? { en, hi: hit[1] } : { en };
}

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
  const label = useBiLabel();
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
      <div role="tablist" aria-label={label({ en: "Writing mode", hi: "लेखन मोड" })} className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} type="button" className={`btn btn-sm ${mode === m ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode(m)}>
            {label(m === "learn" ? { en: "Learn (with help)", hi: "सीखें (मदद के साथ)" } : m === "practice" ? { en: "Practice (write first)", hi: "अभ्यास (पहले ख़ुद लिखें)" } : { en: "Exam (no help)", hi: "परीक्षा (कोई मदद नहीं)" })}
          </button>
        ))}
      </div>
      <Bi className="text-xs text-muted" t={
        mode === "learn" ? { en: "Learn mode: outlines, hints, vocabulary and the model answer are available while you write.", hi: "सीखें मोड: लिखते समय ढाँचा, संकेत, शब्दावली और नमूना उत्तर उपलब्ध हैं।" }
          : mode === "practice" ? { en: "Practice mode: write on your own first; hints, feedback and the model answer appear after you submit.", hi: "अभ्यास मोड: पहले ख़ुद लिखें; जमा करने के बाद संकेत, फ़ीडबैक और नमूना उत्तर दिखेंगे।" }
            : { en: "Exam mode: all assistance is disabled until you submit. The timer is kept on the server and continues if you reload.", hi: "परीक्षा मोड: जमा करने तक हर तरह की मदद बंद रहती है। टाइमर सर्वर पर चलता है और पेज दोबारा लोड करने पर भी चलता रहता है।" }
      } />

      {mode === "learn" && p.learn && <LearnPanel aids={p.learn} showModel={showModel} setShowModel={setShowModel} />}

      {restore !== null && (
        <div className="rounded-lg bg-saffron-100 p-2 text-sm text-saffron-700" role="alert">
          {label({ en: "A newer unsaved version was found on this device.", hi: "इस डिवाइस पर एक नया, बिना सहेजा संस्करण मिला।" })} <button type="button" className="underline" onClick={() => { onChange(restore); setRestore(null); }}>{label({ en: "Restore it", hi: "उसे वापस लाएँ" })}</button> {label({ en: "or", hi: "या" })} <button type="button" className="underline" onClick={() => { setRestore(null); if (localKey) localStorage.removeItem(localKey); }}>{label({ en: "discard", hi: "हटा दें" })}</button>.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span aria-live="polite">{label({
          en: `${wc} words ${wc < p.minWords ? `(at least ${p.minWords})` : "✓"}${p.maxWords && wc > p.maxWords ? ` — over ${p.maxWords}` : ""}`,
          hi: `${wc} शब्द ${wc < p.minWords ? `(कम से कम ${p.minWords})` : "✓"}${p.maxWords && wc > p.maxWords ? ` — ${p.maxWords} से ज़्यादा` : ""}`,
        })}</span>
        {remaining !== null && !submitted && <span className={`font-mono ${remaining < 120 ? "text-red-700 dark:text-red-300" : ""}`} role="timer" aria-label={label({ en: "Time remaining", hi: "बचा हुआ समय" })}>⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}
        <span className="text-xs text-muted">{submitted ? label({ en: "Submitted", hi: "जमा किया गया" })
          : saveState === "saving" ? label({ en: "Saving…", hi: "सहेजा जा रहा है…" })
            : saveState === "saved" ? label({ en: "Saved", hi: "सहेजा गया" })
              : saveState === "offline" ? label({ en: "Offline — saved on this device, will retry", hi: "इंटरनेट नहीं है — इस डिवाइस पर सहेजा गया, फिर से कोशिश होगी" })
                : saveState === "error" ? label({ en: "Could not save", hi: "सहेजा नहीं जा सका" }) : ""}</span>
      </div>
      <textarea id={areaId} lang="fr" spellCheck={!exam && mode === "learn"} className="input min-h-48 font-[inherit]" value={text} onChange={(e) => onChange(e.target.value)} readOnly={submitted || !draft}
        aria-label={label({ en: "Your French text", hi: "आपका फ़्रेंच पाठ" })} onBlur={() => persist(text)} autoCorrect="off" autoCapitalize="sentences" />
      {!submitted && <AccentBar targetId={areaId} />}
      <div className="flex flex-wrap gap-2">
        {!submitted && <button type="button" className="btn btn-secondary btn-sm" onClick={() => persist(text, "manual")}>{label({ en: "Save version", hi: "संस्करण सहेजें" })}</button>}
        {!submitted && <button type="button" className="btn btn-primary btn-sm" disabled={wc === 0} onClick={submit}>{mode !== "learn" ? label({ en: "Submit and get feedback", hi: "जमा करें और फ़ीडबैक पाएँ" }) : label({ en: "Submit", hi: "जमा करें" })}</button>}
        {submitted && !feedback && <button type="button" className="btn btn-primary btn-sm" onClick={getFeedback} disabled={fbState === "loading"}>{fbState === "loading" ? label({ en: "Checking your text…", hi: "आपका पाठ जाँचा जा रहा है…" }) : label({ en: "Get feedback", hi: "फ़ीडबैक पाएँ" })}</button>}
        {submitted && <button type="button" className="btn btn-secondary btn-sm" onClick={() => retry()}>{label({ en: "Edit a new version", hi: "नया संस्करण लिखें" })}</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { if (!draft) return; const h = await api<{ revisions: Revision[] }>(`/api/writing/drafts/${draft.id}/history`); setHistory(h.revisions); }}>{label({ en: "Version history", hi: "पिछले संस्करण" })}</button>
      </div>
      {fbError && <p role="alert" className="text-sm text-red-700">{fbError}</p>}
      {history && (
        <div className="rounded-xl surface-2 p-3">
          <Bi className="font-medium" t={{ en: "Version history", hi: "पिछले संस्करण" }} />
          {history.length === 0 && <Bi className="text-sm text-muted" t={{ en: "No saved versions yet. Versions are kept every couple of minutes and on submit.", hi: "अभी कोई सहेजा संस्करण नहीं है। हर कुछ मिनट में और जमा करते समय संस्करण रखे जाते हैं।" }} />}
          <ul className="mt-1 space-y-2">{history.map((h) => (
            <li key={h.id} className="text-sm"><span className="text-muted">{new Date(h.createdAt).toLocaleString()} · {REASON[h.reason] ? label(REASON[h.reason]) : h.reason}</span>
              {h.text ? <p lang="fr" className="line-clamp-2">{h.text}</p> : <Bi className="line-clamp-2" t={{ en: "(empty)", hi: "(खाली)" }} />}
              {!submitted && <button type="button" className="text-xs underline" onClick={() => onChange(h.text)}>{label({ en: "Restore this version", hi: "यह संस्करण वापस लाएँ" })}</button>}
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
  const label = useBiLabel();
  return (
    <div className="space-y-2 rounded-xl surface-2 p-3">
      {afterSubmit && <Bi className="text-sm font-medium" t={{ en: "Now compare with the help that was hidden while you wrote:", hi: "अब उस मदद से तुलना करें जो लिखते समय छिपी थी:" }} />}
      {aids.outline && <><Bi className="text-sm font-semibold" t={{ en: "Suggested outline", hi: "सुझाया गया ढाँचा" }} /><ol className="list-decimal pl-5 text-sm">{aids.outline.map((h, i) => <Bi key={i} as="li" t={h} />)}</ol></>}
      <Bi className="text-sm font-semibold" t={{ en: "Hints", hi: "संकेत" }} />
      <ul className="list-disc pl-5 text-sm">{aids.hints.map((h, i) => <Bi key={i} as="li" t={h} />)}</ul>
      <Bi className="text-sm font-semibold" t={{ en: "Useful phrases", hi: "काम के वाक्यांश" }} />
      <ul className="divide-y divide-[var(--border)]">{aids.phrases.map((ph, i) => <li key={i}><FrItem item={ph} compact /></li>)}</ul>
      {aids.checklist && <><Bi className="text-sm font-semibold" t={{ en: "Checklist", hi: "जाँच-सूची" }} /><ul className="text-sm">{aids.checklist.map((c, i) => <li key={i}>☐ <Bi as="span" t={c} /></li>)}</ul></>}
      {aids.model && (showModel
        ? <div className="rounded-lg border border-app p-2"><p className="text-xs uppercase text-muted">{label({ en: "Model answer (one possible version)", hi: "नमूना उत्तर (एक संभव रूप)" })}</p><p lang="fr" className="whitespace-pre-wrap">{aids.model.fr}</p><p className="text-sm text-muted">{aids.model.en}</p></div>
        : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModel(true)}>{label({ en: "Show a model answer", hi: "नमूना उत्तर दिखाएँ" })}</button>)}
    </div>
  );
}

export function FeedbackView({ fb, original, onRetry }: { fb: FeedbackEnvelope; original: string; onRetry?: (t: string) => void }) {
  const f = fb.feedback;
  const errors = f.corrections.filter((c) => c.isError);
  const style = f.corrections.filter((c) => !c.isError);
  const [practice, setPractice] = useState<Record<number, string>>({});
  const label = useBiLabel();
  return (
    <section className="space-y-3 rounded-xl border border-brand-500/40 p-3" aria-label={label({ en: "Feedback", hi: "फ़ीडबैक" })}>
      <p className={`chip ${fb.isDemo ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{label(noticeBi(fb.label))}</p>
      {fb.limitations && <Bi className="text-xs text-muted" t={noticeBi(fb.limitations)} />}
      <Bi t={f.summary} />
      {f.strengths.length > 0 && <><Bi className="font-semibold" t={{ en: "What works", hi: "क्या अच्छा है" }} /><ul className="list-disc pl-5 text-sm">{f.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {f.taskNotes.length > 0 && <ul className="text-sm text-muted">{f.taskNotes.map((s, i) => <li key={i}>• {s}</li>)}</ul>}
      <Bi className="font-semibold" t={{ en: `Corrections (${errors.length})`, hi: `सुधार (${errors.length})` }} />
      {errors.length === 0 && <Bi className="text-sm" t={fb.isDemo
        ? { en: "No definite errors were found by the rule-based checker (it only knows common patterns, so some errors can slip through).", hi: "नियम-आधारित जाँच को कोई पक्की ग़लती नहीं मिली (यह केवल आम पैटर्न जानती है, इसलिए कुछ ग़लतियाँ छूट सकती हैं)।" }
        : { en: "No definite errors were found.", hi: "कोई पक्की ग़लती नहीं मिली।" }} />}
      <ol className="space-y-3">{errors.map((c, i) => <CorrectionItem key={i} c={c} i={i} practice={practice} setPractice={setPractice} />)}</ol>
      {style.length > 0 && <><Bi className="font-semibold" t={{ en: "Optional style improvements", hi: "शैली में वैकल्पिक सुधार" }} /><Bi className="text-xs text-muted" t={{ en: "These are not mistakes — just more natural or richer ways to say it.", hi: "ये ग़लतियाँ नहीं हैं — बस इसे कहने के ज़्यादा स्वाभाविक या समृद्ध तरीक़े हैं।" }} /><ol className="space-y-3">{style.map((c, i) => <CorrectionItem key={i} c={c} i={100 + i} practice={practice} setPractice={setPractice} />)}</ol></>}
      <div>
        <Bi className="font-semibold" t={{ en: "Your text, corrected at your level", hi: "आपका पाठ, आपके स्तर के हिसाब से सुधारा गया" }} />
        <p lang="fr" className="whitespace-pre-wrap rounded-lg surface-2 p-2">{diffWords(original, f.correctedText).map((s, i) => s.type === "same" ? <span key={i}>{s.text}</span> : s.type === "add" ? <mark key={i} className="add">{s.text}</mark> : <mark key={i} className="del">{s.text}</mark>)}</p>
      </div>
      {f.advancedVersion && <details><summary className="cursor-pointer font-semibold">{label({ en: "A more advanced version (optional)", hi: "एक ज़्यादा उन्नत रूप (वैकल्पिक)" })}</summary><p lang="fr" className="mt-1 whitespace-pre-wrap">{f.advancedVersion}</p></details>}
      {onRetry && <button type="button" className="btn btn-primary btn-sm" onClick={() => onRetry(original)}>{label({ en: "Retry: rewrite your text using these corrections", hi: "फिर से कोशिश करें: इन सुधारों के साथ अपना पाठ दोबारा लिखें" })}</button>}
    </section>
  );
}

export function CorrectionItem({ c, i, practice, setPractice }: { c: FeedbackEnvelope["feedback"]["corrections"][number]; i: number; practice: Record<number, string>; setPractice: (f: (p: Record<number, string>) => Record<number, string>) => void }) {
  const [checked, setChecked] = useState<AnswerCheck | null>(null);
  const label = useBiLabel();
  return (
    <li className="rounded-lg surface-2 p-2 text-sm">
      <p><span className="chip bg-[var(--surface)] mr-2">{CATEGORY[c.category] ? label(CATEGORY[c.category]) : c.category}</span><mark className="del" lang="fr">{c.original}</mark> → <mark className="add" lang="fr">{c.corrected}</mark></p>
      <Bi t={c.explanation} className="mt-1" />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">{label({ en: "Practice:", hi: "अभ्यास:" })}</span><span lang="fr">{c.practice.prompt}</span>
        <input className="input max-w-60 min-h-0 py-1" lang="fr" aria-label={label({ en: "Practice answer", hi: "अभ्यास का उत्तर" })} value={practice[i] ?? ""} onChange={(e) => setPractice((p) => ({ ...p, [i]: e.target.value }))} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setChecked(checkAnswer(practice[i] ?? "", c.practice.answer))}>{label({ en: "Check", hi: "उत्तर जाँचें" })}</button>
        {checked && <ResultLine r={checked} />}
      </div>
    </li>
  );
}
