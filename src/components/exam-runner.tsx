"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { AttemptView } from "@/server/exam";
import type { SpeakingReport } from "@/server/speaking";
import type { FeedbackEnvelope } from "@/lib/feedback-schema";
import { TEF_CANADA, GRACE_SECONDS, type SectionKey } from "@/content/tef-config";
import { usePlayer, AudioSourceNote, AudioError, Speak, type VoiceKey } from "./audio";
import { Bi, useBiLabel } from "./bi";
import { AccentBar } from "./accent-bar";
import { FeedbackView } from "./writing-editor";
import { Conversation, type Turn } from "./speaking-tutor";
import { usePrefs } from "./prefs";

type BiT = { en: string; hi: string };
type Q = { id: string; q: { fr?: string; en: string; hi?: string }; options: string[]; kind?: string; answer?: number; explanation?: BiT; evidence?: string };
type Base = { startedAt: string | null; deadline: string | null; submittedAt: string | null; autoSubmitted: boolean; answers: Record<string, number | string> };
type Result = { correct: number; total: number; byKind: Record<string, { correct: number; total: number }>; bySection: { key: string; title: string; correct: number; total: number }[] };
type ReadingV = Base & { parts: { key: string; title: string; instruction: string; items: { document: { genre: string; title: string; text: string }; questions: Q[] }[] }[]; result: Result | null };
type ListeningV = Base & { position: number; played: number[]; count: number; items: { n: number; sectionKey: string; sectionTitle: string; instruction: string; context: string; questions: Q[]; transcript?: { speaker: string; voice: VoiceKey; fr: string }[] }[]; result: Result | null };
type WTask = { title: string; titleHi: string; minWords: number; instruction: BiT; stimulus: string };
type WritingV = Base & { tasks: { a: WTask; b: WTask }; words: { a: number; b: number }; feedback: Record<string, FeedbackEnvelope> };
type STask = { title: string; titleHi: string; minutes: number; instruction: BiT; document: string; state: { sessionId: string; startedAt: string; deadline: string; endedAt?: string } | null };
type SpeakingV = Base & { tasks: { a: STask; b: STask } };

const KIND_LABEL: Record<string, BiT> = {
  literal: { en: "Finding stated details", hi: "सीधे लिखी जानकारी ढूँढना" },
  inference: { en: "Inference", hi: "अनुमान लगाना" },
  vocabulary: { en: "Vocabulary in context", hi: "संदर्भ में शब्दावली" },
  grammar: { en: "Grammar", hi: "व्याकरण" },
  gist: { en: "Main idea", hi: "मुख्य विचार" },
  other: { en: "Other", hi: "अन्य" },
};
const kindLabel = (k: string): BiT => KIND_LABEL[k] ?? { en: k, hi: k };
const DISCLAIMER_HI: Record<string, string> = {
  "Original practice material written for French Setu. Not official TEF material, not recalled or leaked exam content. Results are raw practice scores, not TEF scores, CEFR levels or NCLC levels.":
    "French Setu के लिए लिखी गई मौलिक अभ्यास सामग्री। यह TEF की आधिकारिक सामग्री नहीं है, और न ही याद करके दोहराई गई या लीक हुई परीक्षा सामग्री। परिणाम केवल अभ्यास के कच्चे अंक हैं, TEF अंक, CEFR स्तर या NCLC स्तर नहीं।",
};
const titleHi = (t: string) => t.replace(/^Practice exam (\d+)$/, "अभ्यास परीक्षा $1");
const secName = (k: SectionKey): BiT => ({ en: TEF_CANADA.sections[k].en, hi: TEF_CANADA.sections[k].hi });
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function useClock(offsetMs: number) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offsetMs), 1000); return () => clearInterval(t); }, [offsetMs]);
  return now;
}

/** Like Bi, for text that contains links or emphasis. */
function BiRich({ en, hi, className = "" }: { en: ReactNode; hi: ReactNode; className?: string }) {
  const { explanationLang } = usePrefs();
  return (
    <div className={className}>
      {explanationLang !== "hi" && <p lang="en">{en}</p>}
      {explanationLang !== "en" && <p lang="hi" className={`deva ${explanationLang === "both" ? "text-muted mt-0.5" : ""}`}>{hi}</p>}
    </div>
  );
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

  const L = useBiLabel();
  const sec = <T,>(k: SectionKey) => v.sections[k] as T;
  const anyOpen = v.sectionKeys.some((k) => { const s = sec<Base>(k); return s.startedAt && !s.submittedAt; });

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/exam" className="text-sm underline">← {L({ en: "Practice exams", hi: "अभ्यास परीक्षाएँ" })}</Link>
        <h1 className="text-2xl font-bold">{L({ en: v.title, hi: titleHi(v.title) })} <span className="text-base font-normal text-muted">· {L({ en: "TEF Canada format", hi: "TEF Canada प्रारूप" })}</span></h1>
        <Bi t={{ en: v.disclaimer, hi: DISCLAIMER_HI[v.disclaimer] }} className="text-sm text-muted" />
        <p className="text-sm"><span className={`chip ${v.strict ? "bg-saffron-100 text-saffron-700" : "surface-2"}`}>{v.strict ? L({ en: "Exam rules: timers enforced on the server", hi: "परीक्षा नियम: टाइमर सर्वर पर लागू होते हैं" }) : L({ en: "Relaxed: timers are shown but not enforced", hi: "लचीला मोड: टाइमर दिखते हैं, पर लागू नहीं होते" })}</span></p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-500 p-2 text-sm">{error}</p>}

      <nav aria-label={L({ en: "Sections", hi: "खंड" })} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {v.sectionKeys.map((k) => {
          const s = sec<Base & { result?: Result | null }>(k);
          const status = s.submittedAt
            ? (s.autoSubmitted ? { en: "Submitted when time ran out", hi: "समय ख़त्म होने पर जमा हुआ" } : { en: "Submitted", hi: "जमा हो गया" })
            : s.startedAt ? { en: "In progress", hi: "जारी है" } : { en: "Not started", hi: "शुरू नहीं हुआ" };
          return (
            <button key={k} type="button" onClick={() => setActive(k)} aria-current={active === k}
              className={`card text-left ${active === k ? "border-brand-500 ring-1 ring-brand-500" : ""}`}>
              <span className="block font-medium"><Bi as="span" t={secName(k)} /> <span lang="fr" className="text-sm text-muted">· {TEF_CANADA.sections[k].title}</span></span>
              <span className="block text-sm text-muted">{L({ en: `${TEF_CANADA.sections[k].minutes} min`, hi: `${TEF_CANADA.sections[k].minutes} मिनट` })} · {L(status)}</span>
              {s.result && <span className="block text-sm font-semibold">{L({ en: `${s.result.correct} / ${s.result.total} correct`, hi: `${s.result.total} में से ${s.result.correct} सही` })}</span>}
            </button>
          );
        })}
      </nav>

      {v.status === "completed" && (
        <div className="card text-sm">
          <Bi t={{ en: "All sections are done.", hi: "सभी खंड पूरे हो गए।" }} className="font-semibold" />
          <BiRich
            en={<>Scores here are raw practice counts on original material. They are not TEF scores and there is no reliable way to turn them into a TEF score, CEFR level or NCLC level, so none is shown. Wrong answers were added to your <Link href="/mistakes" className="underline">mistake notebook</Link>.</>}
            hi={<>यहाँ दिए गए अंक मौलिक सामग्री पर अभ्यास की कच्ची गिनती हैं। ये TEF अंक नहीं हैं, और इन्हें TEF अंक, CEFR स्तर या NCLC स्तर में बदलने का कोई भरोसेमंद तरीक़ा नहीं है, इसलिए कोई भी नहीं दिखाया गया है। ग़लत उत्तर आपकी <Link href="/mistakes" className="underline">ग़लतियों की कॉपी</Link> में जोड़ दिए गए हैं।</>} />
        </div>
      )}

      {active && (() => {
        const s = sec<Base>(active);
        if (!s.startedAt) return <StartCard k={active} strict={v.strict} blocked={anyOpen} onStart={() => start(active)} />;
        const common = { act, reload, offset, strict: v.strict, onSubmit: () => submit(active) };
        return (
          <section aria-label={L(secName(active))} className="space-y-4">
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
  const L = useBiLabel();
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold"><Bi as="span" t={{ en: c.en, hi: c.hi }} /> · <span lang="fr">{c.title}</span></h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {c.rules.map((r, i) => <li key={i}><Bi as="span" t={{ en: r.text, hi: r.hi }} /> <span className="text-xs text-muted">({L(r.source === "official" ? { en: "official handbook", hi: "आधिकारिक पुस्तिका" } : { en: "prep guides, not in the official handbook", hi: "तैयारी गाइड, आधिकारिक पुस्तिका में नहीं" })})</span></li>)}
      </ul>
      {strict
        ? <Bi className="text-sm" t={{ en: "Once you start, the clock runs on the server. Closing or reloading the page does not pause it, and the section is submitted automatically when time runs out.", hi: "शुरू करते ही घड़ी सर्वर पर चलने लगती है। पेज बंद करने या दोबारा लोड करने से यह नहीं रुकती, और समय ख़त्म होने पर खंड अपने आप जमा हो जाता है।" }} />
        : <Bi className="text-sm" t={{ en: "Relaxed mode: the clock is only a guide and nothing is submitted for you.", hi: "लचीला मोड: घड़ी केवल अंदाज़े के लिए है और कुछ भी अपने आप जमा नहीं होता।" }} />}
      {blocked && <Bi className="text-sm text-muted" t={{ en: "Finish the section that is in progress first.", hi: "पहले वह खंड पूरा करें जो अभी जारी है।" }} />}
      <button type="button" className="btn btn-primary" disabled={blocked} onClick={onStart}>{L({ en: `Start ${c.en.toLowerCase()}`, hi: `${c.hi} खंड शुरू करें` })}</button>
    </div>
  );
}

function SectionTimer({ deadline, offset, enforced, onExpire }: { deadline: string; offset: number; enforced: boolean; onExpire: () => void }) {
  const now = useClock(offset);
  const L = useBiLabel();
  const left = Math.ceil((new Date(deadline).getTime() - now) / 1000);
  const fired = useRef(false);
  useEffect(() => { if (enforced && left <= 0 && !fired.current) { fired.current = true; onExpire(); } }, [left, enforced, onExpire]);
  const warn = left <= 300;
  return (
    <div role="timer" aria-live="off" className={`sticky top-16 z-10 rounded-xl border p-2 text-sm ${left <= 0 ? "border-red-500 bg-red-50 dark:bg-red-950" : warn ? "border-saffron-500 surface" : "border-app surface"}`}>
      <span className="font-mono text-lg font-semibold">{left > 0 ? fmt(left) : "0:00"}</span>{" "}
      <span className="text-muted">{L(left > 0 ? { en: "left", hi: "बाक़ी" } : enforced ? { en: "time is up, submitting…", hi: "समय ख़त्म, जमा किया जा रहा है…" } : { en: "past the exam time", hi: "परीक्षा का समय निकल चुका है" })}</span>
      {warn && left > 0 && <span className="sr-only" aria-live="polite">{L({ en: `${Math.ceil(left / 60)} minutes left`, hi: `${Math.ceil(left / 60)} मिनट बाक़ी` })}</span>}
    </div>
  );
}

type Common = { act: <T>(b: Record<string, unknown>) => Promise<T | null>; reload: () => Promise<void>; offset: number; strict: boolean; onSubmit: () => void };

function ConfirmSubmit({ label, note, onSubmit }: { label: BiT; note?: BiT; onSubmit: () => void }) {
  const [ask, setAsk] = useState(false);
  const L = useBiLabel();
  if (!ask) return <button type="button" className="btn btn-primary" onClick={() => setAsk(true)}>{L(label)}</button>;
  return (
    <div className="card space-y-2 border-saffron-500">
      <Bi className="text-sm" t={{ en: `Submit this section? You cannot change your answers afterwards.${note ? ` ${note.en}` : ""}`, hi: `क्या यह खंड जमा करें? इसके बाद आप अपने उत्तर नहीं बदल पाएँगे।${note ? ` ${note.hi}` : ""}` }} />
      <div className="flex gap-2"><button type="button" className="btn btn-primary" onClick={onSubmit}>{L({ en: "Yes, submit", hi: "हाँ, जमा करें" })}</button><button type="button" className="btn btn-secondary" onClick={() => setAsk(false)}>{L({ en: "Keep working", hi: "काम जारी रखें" })}</button></div>
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
  const L = useBiLabel();
  return (
    <fieldset className="rounded-xl border border-app p-3">
      <legend className="px-1 font-medium">{n}. {q.q.fr && <span lang="fr" className="block">{q.q.fr}</span>}<Bi as="span" t={{ en: q.q.en, hi: q.q.hi }} className={q.q.fr ? "text-sm text-muted" : ""} /></legend>
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
          <p className="font-medium">{L(chosen === q.answer ? { en: "Correct", hi: "सही" } : chosen === undefined ? { en: "No answer", hi: "कोई उत्तर नहीं" } : { en: "Not quite", hi: "सही नहीं" })}{q.kind ? ` · ${L(kindLabel(q.kind))}` : ""}</p>
          {q.explanation && <Bi t={q.explanation} />}
          {q.evidence && <p className="mt-1">{L({ en: "Evidence:", hi: "प्रमाण:" })} <q lang="fr">{q.evidence}</q></p>}
        </div>
      )}
    </fieldset>
  );
}

function ResultSummary({ r, what }: { r: Result; what: BiT }) {
  const L = useBiLabel();
  return (
    <div className="card space-y-2">
      <Bi className="text-lg font-semibold" t={{ en: `${what.en}: ${r.correct} / ${r.total} correct`, hi: `${what.hi}: ${r.total} में से ${r.correct} सही` }} />
      <Bi className="text-xs text-muted" t={{ en: "Raw practice count. Not a TEF score, CEFR level or NCLC level.", hi: "अभ्यास की कच्ची गिनती। यह TEF अंक, CEFR स्तर या NCLC स्तर नहीं है।" }} />
      <div className="grid gap-3 sm:grid-cols-2">
        <table className="text-sm"><caption className="text-left font-medium">{L({ en: "By part", hi: "भाग के अनुसार" })}</caption><tbody>{r.bySection.map((b) => <tr key={b.key}><td className="pr-2">{b.title}</td><td className="text-right font-mono">{b.correct}/{b.total}</td></tr>)}</tbody></table>
        <table className="text-sm"><caption className="text-left font-medium">{L({ en: "By question type", hi: "प्रश्न के प्रकार के अनुसार" })}</caption><tbody>{Object.entries(r.byKind).map(([k, b]) => <tr key={k}><td className="pr-2">{L(kindLabel(k))}</td><td className="text-right font-mono">{b.correct}/{b.total}</td></tr>)}</tbody></table>
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
  const L = useBiLabel();
  let n = 0;
  return (
    <div className="space-y-4">
      {done && v.result && <ResultSummary r={v.result} what={secName("reading")} />}
      {!done && <p className="text-sm text-muted" aria-live="polite">{L({ en: `${answered} of ${all.length} answered. Your answers are saved as you choose them.`, hi: `${all.length} में से ${answered} प्रश्नों के उत्तर दिए गए। उत्तर चुनते ही सहेज लिए जाते हैं।` })}</p>}
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
      {!done && <ConfirmSubmit label={{ en: "Submit reading", hi: "पढ़ना खंड जमा करें" }} note={answered < all.length ? { en: `${all.length - answered} questions have no answer.`, hi: `${all.length - answered} प्रश्नों का कोई उत्तर नहीं दिया गया है।` } : undefined} onSubmit={onSubmit} />}
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
  const L = useBiLabel();

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
        {v.result && <ResultSummary r={v.result} what={secName("listening")} />}
        {v.items.map((it) => (
          <div key={it.n} className="card space-y-3">
            <h3 className="font-semibold">{L({ en: `Recording ${it.n + 1}`, hi: `रिकॉर्डिंग ${it.n + 1}` })} <span className="text-sm font-normal text-muted" lang="fr">· {it.sectionTitle}</span></h3>
            {it.questions.map((q, qi) => <QuestionCard key={q.id} q={q} n={qi + 1} name={q.id} chosen={answers[q.id] as number | undefined} locked onChoose={() => {}} />)}
            {it.transcript && (
              <details><summary className="cursor-pointer text-sm font-medium">{L({ en: "Transcript", hi: "लिखित पाठ" })}</summary>
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
          ? <BiRich en={<>Read the questions, then play the recording. It plays <strong>once</strong>, with no pause or replay. When you move on you cannot come back.</>}
              hi={<>पहले प्रश्न पढ़ें, फिर रिकॉर्डिंग चलाएँ। यह <strong>केवल एक बार</strong> चलती है, बिना रुके और बिना दोबारा चले। आगे बढ़ने के बाद आप वापस नहीं आ सकते।</>} />
          : <Bi t={{ en: "Relaxed mode: you can replay recordings and go back.", hi: "लचीला मोड: आप रिकॉर्डिंग दोबारा सुन सकते हैं और पीछे जा सकते हैं।" }} />}
      </div>
      <AudioSourceNote />
      <div className="card space-y-3">
        <p className="text-sm text-muted">{L({ en: `Recording ${cur.n + 1} of ${v.count}`, hi: `${v.count} में से रिकॉर्डिंग ${cur.n + 1}` })} · <span lang="fr">{cur.sectionTitle}</span></p>
        {(cur.n === 0 || v.items[cur.n - 1]?.sectionKey !== cur.sectionKey) && <p className="text-sm">{cur.instruction}</p>}
        <p lang="fr" className="font-medium">{cur.context}</p>
        {phase === "playing"
          ? <p className="font-medium" aria-live="polite">🔊 {L({ en: "Playing…", hi: "चल रही है…" })} {playing !== null ? L({ en: `line ${playing + 1}`, hi: `पंक्ति ${playing + 1}` }) : ""}</p>
          : (!hasPlayed || !strict) && <button type="button" className="btn btn-primary" onClick={start}>▶ {L(hasPlayed ? { en: "Play again", hi: "फिर से सुनें" } : strict ? { en: "Play the recording (once)", hi: "रिकॉर्डिंग सुनें (एक बार)" } : { en: "Play the recording", hi: "रिकॉर्डिंग सुनें" })}</button>}
        {hasPlayed && strict && phase === "idle" && <Bi className="text-sm text-muted" t={{ en: "The recording has been played.", hi: "रिकॉर्डिंग चल चुकी है।" }} />}
        <AudioError error={error} />
        {cur.questions.map((q, qi) => <QuestionCard key={q.id} q={q} n={qi + 1} name={q.id} chosen={answers[q.id] as number | undefined} locked={false} onChoose={(j) => choose(q.id, j)} />)}
      </div>
      <div className="flex flex-wrap gap-2">
        {!strict && view > 0 && <button type="button" className="btn btn-secondary" onClick={() => setView(view - 1)}>← {L({ en: "Previous", hi: "पीछे" })}</button>}
        {!isLast && (strict
          ? <button type="button" className="btn btn-primary" disabled={!hasPlayed || phase === "playing"} onClick={next}>{L({ en: "Next recording", hi: "अगली रिकॉर्डिंग" })} →</button>
          : <button type="button" className="btn btn-primary" onClick={() => setView(view + 1)}>{L({ en: "Next recording", hi: "अगली रिकॉर्डिंग" })} →</button>)}
        {(isLast || !strict) && <ConfirmSubmit label={{ en: "Submit listening", hi: "सुनना खंड जमा करें" }} onSubmit={onSubmit} />}
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
  const L = useBiLabel();
  const savedLabel: BiT = saved === "saved" ? { en: "All changes saved.", hi: "सभी बदलाव सहेज लिए गए।" } : saved === "saving" ? { en: "Saving…", hi: "सहेजा जा रहा है…" } : saved === "error" ? { en: "Could not save. Check your connection.", hi: "सहेजा नहीं जा सका। अपना इंटरनेट कनेक्शन जाँचें।" } : { en: "Unsaved changes…", hi: "कुछ बदलाव अभी सहेजे नहीं गए…" };
  return (
    <div className="space-y-4">
      {!done && <p className="text-sm text-muted" aria-live="polite">{L({ en: `Both tasks share the 60 minutes. ${savedLabel.en}`, hi: `दोनों कामों के लिए कुल 60 मिनट हैं। ${savedLabel.hi}` })}</p>}
      {(["a", "b"] as const).map((k) => {
        const t = v.tasks[k];
        const wc = countWords(text[k]);
        return (
          <div key={k} className="card space-y-3">
            <Bi as="h2" className="text-lg font-semibold" t={{ en: t.title, hi: t.titleHi }} />
            <Bi t={t.instruction} className="text-sm" />
            <blockquote lang="fr" className="whitespace-pre-wrap rounded-lg border-l-4 border-brand-500 surface-2 p-3">{t.stimulus}</blockquote>
            <label htmlFor={`w-${k}`} className="sr-only">{L({ en: `Your text for ${t.title}`, hi: `${t.titleHi} के लिए आपका पाठ` })}</label>
            <textarea id={`w-${k}`} lang="fr" rows={k === "a" ? 8 : 14} className="input" spellCheck={false} value={text[k]} readOnly={done} onChange={(e) => change(k, e.target.value)} />
            {!done && <AccentBar targetId={`w-${k}`} />}
            <p className={`text-sm ${wc < t.minWords ? "text-muted" : ""}`}>{L({ en: `${wc} words · at least ${t.minWords}`, hi: `${wc} शब्द · कम से कम ${t.minWords}` })}</p>
            {done && <WritingFeedback k={k} act={act} initial={v.feedback[k] ?? null} original={text[k]} />}
          </div>
        );
      })}
      {!done && <ConfirmSubmit label={{ en: "Submit writing", hi: "लिखना खंड जमा करें" }} note={countWords(text.a) < v.tasks.a.minWords || countWords(text.b) < v.tasks.b.minWords ? { en: "At least one text is under the minimum length.", hi: "कम से कम एक पाठ तय न्यूनतम लंबाई से छोटा है।" } : undefined} onSubmit={flushAndSubmit} />}
    </div>
  );
}

function WritingFeedback({ k, act, initial, original }: { k: "a" | "b"; act: Common["act"]; initial: FeedbackEnvelope | null; original: string }) {
  const [fb, setFb] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { providers } = usePrefs();
  const L = useBiLabel();
  if (!original.trim()) return <Bi className="text-sm text-muted" t={{ en: "No text was written for this task.", hi: "इस काम के लिए कुछ नहीं लिखा गया।" }} />;
  if (fb) return <FeedbackView fb={fb} original={original} />;
  return (
    <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); setFb(await act<FeedbackEnvelope>({ action: "writing_feedback", task: k })); setBusy(false); }}>
      {L(busy ? { en: "Checking…", hi: "जाँच हो रही है…" } : providers.ai.available ? { en: "Get feedback", hi: "फ़ीडबैक पाएँ" } : { en: "Run the rule-based check (not AI)", hi: "नियम-आधारित जाँच चलाएँ (AI नहीं)" })}
    </button>
  );
}

// ───────────── Speaking ─────────────

function Speaking({ v, act, offset, strict, reload, sessions }: { v: SpeakingV; sessions: AttemptView["speakingSessions"] } & Common) {
  const done = !!v.submittedAt;
  const [open, setOpen] = useState<"a" | "b" | null>(() => (v.tasks.a.state && !v.tasks.a.state.endedAt ? "a" : v.tasks.b.state && !v.tasks.b.state.endedAt ? "b" : null));
  const begin = async (k: "a" | "b") => { const r = await act({ action: "speak_start", task: k }); if (r) { await reload(); setOpen(k); } };
  const L = useBiLabel();
  return (
    <div className="space-y-4">
      <Bi className="text-sm text-muted" t={{ en: "Section A first, then section B. Each task has its own clock. You can speak (where your browser supports it) or type.", hi: "पहले खंड A, फिर खंड B। हर काम की अपनी घड़ी है। आप बोल सकते हैं (जहाँ आपका ब्राउज़र इसका समर्थन करता है) या टाइप कर सकते हैं।" }} />
      {(["a", "b"] as const).map((k) => {
        const t = v.tasks[k];
        const sess = sessions[k];
        const locked = k === "b" && !v.tasks.a.state?.endedAt;
        return (
          <div key={k} className="card space-y-3">
            <h2 className="text-lg font-semibold"><Bi as="span" t={{ en: t.title, hi: t.titleHi }} /> <span className="text-sm font-normal text-muted">· {L({ en: `${t.minutes} min`, hi: `${t.minutes} मिनट` })}</span></h2>
            <Bi t={t.instruction} className="text-sm" />
            {!t.state && !done && <button type="button" className="btn btn-primary" disabled={locked} onClick={() => begin(k)}>{L(locked ? { en: "Finish section A first", hi: "पहले खंड A पूरा करें" } : { en: `Start section ${k.toUpperCase()}`, hi: `खंड ${k.toUpperCase()} शुरू करें` })}</button>}
            {!t.state && done && <Bi className="text-sm text-muted" t={{ en: "Not attempted.", hi: "यह काम नहीं किया गया।" }} />}
            {t.state && sess && (open === k || t.state.endedAt) && (
              <Conversation id={sess.id} isDemo={sess.isDemo} scenario={sess.scenario} exam
                deadline={strict && !t.state.endedAt ? t.state.deadline : undefined} clockOffsetMs={offset}
                initialTurns={sess.turns as Turn[]} initialReport={sess.report}
                onExit={() => { setOpen(null); reload(); }}
                transport={{
                  turn: async (text, via) => { const r = await act<{ partner: Turn; finished: boolean; note?: string }>({ action: "speak_turn", task: k, text, via }); if (!r) throw new Error(L({ en: "Your turn could not be sent.", hi: "आपकी बात भेजी नहीं जा सकी।" })); return r; },
                  end: async () => { const r = await act<{ report: SpeakingReport | null }>({ action: "speak_end", task: k }); if (!r) throw new Error(L({ en: "Could not end the task.", hi: "यह काम ख़त्म नहीं किया जा सका।" })); return r.report; },
                }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
