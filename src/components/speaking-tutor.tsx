"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { Scenario, SpeakingMode, SpeakingReport } from "@/server/speaking";
import { usePrefs } from "./prefs";
import { Bi } from "./bi";
import { Speak, usePlayer, AudioSourceNote } from "./audio";
import { AccentBar } from "./accent-bar";
import { TappableText } from "./tappable";
import { CorrectionItem } from "./writing-editor";

type BiT = { en: string; hi: string };
type Catalog = { topics: { id: string; title: BiT; level: string }[]; presentations: { id: string; title: BiT; level: string }[]; tef: { id: string; title: string }[]; roleplays: { id: string; title: BiT }[] };
export type Turn = { role: "learner" | "partner"; text: string; help?: { en?: string; hi?: string }; recast?: string };

const MODES: { mode: SpeakingMode; en: string; hi: string; desc: string }[] = [
  { mode: "roleplay", en: "Lesson role-play", hi: "पाठ का रोल-प्ले", desc: "Act out the situation from a lesson." },
  { mode: "interview", en: "Answer questions", hi: "सवालों के जवाब", desc: "Your partner asks, you answer with details." },
  { mode: "conversation", en: "Conversation", hi: "बातचीत", desc: "A two-way chat. Your partner sometimes disagrees." },
  { mode: "presentation", en: "Short presentation", hi: "छोटी प्रस्तुति", desc: "Speak for 1–3 minutes, then answer questions." },
  { mode: "tef_a", en: "TEF task A", hi: "TEF भाग A", desc: "Ask about ten questions to get information (5 min)." },
  { mode: "tef_b", en: "TEF task B", hi: "TEF भाग B", desc: "Convince a sceptical friend (10 min)." },
];

type SR = { start: () => void; stop: () => void; abort: () => void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const getSR = (): (new () => SR) | null => (typeof window === "undefined" ? null : ((window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition ?? null));

export function SpeakingTutor({ catalog, initial }: { catalog: Catalog; initial?: { mode: SpeakingMode; ref: string } }) {
  const [mode, setMode] = useState<SpeakingMode>(initial?.mode ?? "interview");
  const options = mode === "roleplay" ? catalog.roleplays.map((r) => ({ id: r.id, label: r.title.en }))
    : mode === "presentation" ? catalog.presentations.map((p) => ({ id: `topic:${p.id}`, label: `${p.title.en} (${p.level})` }))
    : mode === "tef_a" || mode === "tef_b" ? catalog.tef.map((t) => ({ id: `mock:${t.id}`, label: t.title }))
    : catalog.topics.map((t) => ({ id: `topic:${t.id}`, label: `${t.title.en} (${t.level})` }));
  const [refState, setRef] = useState(initial?.ref ?? "");
  const ref = options.some((o) => o.id === refState) ? refState : options[0]?.id ?? "";
  const [session, setSession] = useState<{ id: string; isDemo: boolean; scenario: Scenario } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { providers } = usePrefs();
  const [useAi, setUseAi] = useState(true);

  const start = async () => {
    setError(null);
    try {
      const r = await api<{ session: { id: string; isDemo: boolean }; scenario: Scenario }>("/api/speaking/sessions", { body: { mode, ref, useAi } });
      setSession({ id: r.session.id, isDemo: r.session.isDemo, scenario: r.scenario });
    } catch (e) { setError((e as Error).message); }
  };

  if (session) return <Conversation key={session.id} {...session} onExit={() => setSession(null)} />;
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 font-semibold">Choose a practice mode</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <label key={m.mode} className={`card cursor-pointer ${mode === m.mode ? "border-brand-500 ring-1 ring-brand-500" : ""}`}>
              <input type="radio" name="sp-mode" className="sr-only" checked={mode === m.mode} onChange={() => { setMode(m.mode); setRef(""); }} />
              <span className="block font-medium">{m.en} <span lang="hi" className="deva text-sm text-muted">· {m.hi}</span></span>
              <span className="block text-sm text-muted">{m.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">{mode === "roleplay" ? "Lesson" : mode.startsWith("tef") ? "Practice exam" : "Topic"}
        <select className="input mt-1" value={ref} onChange={(e) => setRef(e.target.value)}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      {options.length === 0 && <p className="text-sm text-muted">No lessons with a role-play are available yet.</p>}
      <div className="rounded-lg surface-2 p-3 text-sm">
        {providers.ai.available
          ? <label className="flex items-center gap-2"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Use the AI partner ({providers.ai.name}). Untick for the scripted partner.</label>
          : <p><strong>Demo mode:</strong> no AI is configured, so you will talk to a <strong>scripted partner (not AI)</strong>. It follows a fixed script and does not understand what you say, except in TEF task A, where it matches keywords in your questions to the facts it knows.</p>}
      </div>
      <button className="btn btn-primary" disabled={!options.length} onClick={start}>Start</button>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

export type ConversationTransport = {
  turn: (text: string, via: "typed" | "speech_browser" | "speech_server") => Promise<{ partner: Turn; finished: boolean; note?: string }>;
  /** null when the task ended with nothing said, so there is nothing to report */
  end: () => Promise<SpeakingReport | null>;
};

/** One conversation. In the exam simulator it gets a server deadline and its own transport, and ends itself when time runs out. */
export function Conversation({ id, isDemo, scenario: s, onExit, transport, deadline, clockOffsetMs = 0, initialTurns, initialReport, exam }: {
  id: string; isDemo: boolean; scenario: Scenario; onExit: () => void;
  transport?: ConversationTransport; deadline?: string; clockOffsetMs?: number; initialTurns?: Turn[]; initialReport?: SpeakingReport | null; exam?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns?.length ? initialTurns : [{ role: "partner", text: s.opening }]);
  const [text, setText] = useState("");
  const [via, setVia] = useState<"typed" | "speech_browser" | "speech_server">("typed");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [report, setReport] = useState<SpeakingReport | null>(initialReport ?? null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  const { play } = usePlayer();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (autoPlay && !initialTurns?.length && !initialReport) play([{ text: s.opening, voice: "f1" }]); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [turns.length, report]);
  useEffect(() => { if ((!s.timeLimitSec && !deadline) || report) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [s.timeLimitSec, deadline, report]);
  const left = deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - (now + clockOffsetMs)) / 1000))
    : s.timeLimitSec ? Math.max(0, s.timeLimitSec - Math.floor((now - started) / 1000)) : null;
  const timeUp = !!exam && left === 0;

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setNote(null);
    setTurns((ts) => [...ts, { role: "learner", text: t }]);
    setText("");
    try {
      const r = transport ? await transport.turn(t, via) : await api<{ partner: Turn; finished: boolean; note?: string }>(`/api/speaking/sessions/${id}/turn`, { body: { text: t, via } });
      setTurns((ts) => {
        const copy = [...ts];
        if (r.partner.recast) copy[copy.length - 1] = { ...copy[copy.length - 1], recast: r.partner.recast };
        return [...copy, r.partner];
      });
      if (r.note) setNote(r.note);
      if (r.finished) setFinished(true);
      if (autoPlay) play([{ text: r.partner.text, voice: "f1" }]);
    } catch (e) { setNote((e as Error).message); setTurns((ts) => ts.slice(0, -1)); setText(t); }
    finally { setBusy(false); setVia("typed"); }
  };
  const end = async () => {
    setBusy(true);
    try {
      const r = transport ? await transport.end() : await api<SpeakingReport>(`/api/speaking/sessions/${id}/end`, { body: {} });
      if (r) setReport(r); else onExit();
    } catch (e) { setNote((e as Error).message); }
    finally { setBusy(false); }
  };
  const ending = useRef(false);
  useEffect(() => { if (timeUp && !report && !ending.current) { ending.current = true; end(); } }, [timeUp, report]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{s.title.en}</h2>
          <span className={`chip ${isDemo ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{isDemo ? "Scripted partner (not AI)" : "AI partner"}</span>
        </div>
        <Bi t={s.setting} className="text-sm" />
        <p className="text-sm"><strong>You:</strong> <Bi as="span" t={s.learnerRole} /> · <strong>Partner:</strong> <Bi as="span" t={s.partnerRole} /></p>
        <ul className="list-disc pl-5 text-sm">{s.goals.map((g, i) => <Bi key={i} as="li" t={g} />)}</ul>
        {s.document && <pre lang="fr" className="whitespace-pre-wrap rounded-lg surface-2 p-3 font-[inherit] text-sm">{s.document}</pre>}
        {left !== null && <p className={`font-mono ${left === 0 ? "text-red-700 dark:text-red-300" : ""}`} role="timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} {left === 0 ? (exam ? "· time is up" : "· time is up (exam rules would stop here)") : "left"}</p>}
      </div>

      <ol className="space-y-2" aria-label="Conversation" aria-live="polite">
        {turns.map((t, i) => <TurnView key={i} t={t} noHelp={exam} />)}
        {busy && !report && <li className="text-sm text-muted">Partner is replying…</li>}
      </ol>
      <div ref={endRef} />
      {note && <p role="status" className="text-sm text-muted">{note}</p>}

      {!report && (
        <div className="card sticky bottom-20 space-y-2">
          <label htmlFor="sp-in" className="sr-only">Your reply in French</label>
          <textarea id="sp-in" lang="fr" rows={2} className="input" value={text} onChange={(e) => { setText(e.target.value); if (via !== "typed" && !e.target.value) setVia("typed"); }} placeholder={timeUp ? "Time is up." : finished ? "The conversation has ended. Get your feedback below." : "Say or type your reply in French"} disabled={finished || timeUp}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <AccentBar targetId="sp-in" />
          <div className="flex flex-wrap items-center gap-2">
            <MicButton disabled={finished || busy || timeUp} onText={(t, v) => { setText((x) => (x ? x + " " : "") + t); setVia(v); }} />
            <button className="btn btn-primary" disabled={!text.trim() || busy || finished || timeUp} onClick={send}>Send</button>
            <button className="btn btn-secondary ml-auto" disabled={busy || (!exam && turns.every((t) => t.role !== "learner"))} onClick={end}>{exam ? "End this task" : "End and get feedback"}</button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <label className="flex items-center gap-1"><input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} /> Read partner replies aloud</label>
            {!exam && <button className="underline" onClick={onExit}>Leave without feedback</button>}
          </div>
          <AudioSourceNote />
        </div>
      )}
      {report && <ReportView r={report} onAgain={onExit} againLabel={exam ? "Continue" : undefined} />}
    </div>
  );
}

/** noHelp: exam rules, so no word look-up, translations or corrections during the task. */
function TurnView({ t, noHelp }: { t: Turn; noHelp?: boolean }) {
  const [help, setHelp] = useState(false);
  if (noHelp) return <li className={t.role === "learner" ? "ml-8 rounded-xl bg-brand-50 p-3 dark:bg-brand-900/40" : "mr-8 rounded-xl surface-2 p-3"}><p lang="fr">{t.text}</p></li>;
  if (t.role === "learner") {
    return (
      <li className="ml-8 rounded-xl bg-brand-50 p-3 dark:bg-brand-900/40">
        <p lang="fr">{t.text}</p>
        {t.recast && <p className="mt-1 text-sm text-muted">Clearer: <span lang="fr" className="font-medium">{t.recast}</span></p>}
      </li>
    );
  }
  return (
    <li className="mr-8 rounded-xl surface-2 p-3">
      <div className="flex items-start gap-2"><div className="flex-1"><TappableText text={t.text} sourceRef="speaking" hint={false} /></div><Speak text={t.text} voice="f1" /></div>
      {t.help && (t.help.en || t.help.hi) && (
        <>
          <button className="mt-1 text-xs underline" onClick={() => setHelp((h) => !h)} aria-expanded={help}>{help ? "Hide translation" : "Show translation"}</button>
          {help && <Bi t={{ en: t.help.en ?? "", hi: t.help.hi ?? "" }} className="text-sm text-muted" />}
        </>
      )}
    </li>
  );
}

/** Speech input: browser recognition when available; otherwise records and sends audio to the server if it has a speech-to-text provider. */
function MicButton({ onText, disabled }: { onText: (t: string, via: "speech_browser" | "speech_server") => void; disabled: boolean }) {
  const { providers, micOptIn } = usePrefs();
  const [state, setState] = useState<"idle" | "listening" | "sending" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const sr = useRef<SR | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  // Detected after mount so the server render and the first client render match.
  const [SRClass, setSRClass] = useState<(new () => SR) | null | undefined>(undefined);
  useEffect(() => setSRClass(() => getSR()), []);
  if (SRClass === undefined) return null;
  const canServer = providers.stt.server;
  if (!SRClass && !canServer) return <span className="text-xs text-muted">Speech input isn&apos;t available in this browser. Type instead (Chrome and Edge support it).</span>;

  const startBrowser = () => {
    const r = new SRClass!();
    r.lang = "fr-FR"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const out = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ").trim(); if (out) onText(out, "speech_browser"); };
    r.onerror = (e) => { setState("error"); setMsg(e.error === "not-allowed" ? "Microphone permission was denied. You can type instead, or allow the microphone in your browser settings." : e.error === "no-speech" ? "No speech heard. Try again closer to the mic." : `Speech recognition error: ${e.error}`); };
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    sr.current = r;
    setMsg(null); setState("listening");
    r.start();
  };
  const startServer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("sending");
        const fd = new FormData(); fd.append("audio", new Blob(chunks, { type: rec.mimeType }));
        const r = await fetch("/api/stt", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.text) { onText(j.text, "speech_server"); setState("idle"); } else { setState("error"); setMsg(j.error ?? "Transcription failed."); }
      };
      mr.current = rec; rec.start(); setMsg(null); setState("listening");
    } catch { setState("error"); setMsg("Microphone permission was denied. You can type instead."); }
  };
  const toggle = () => {
    if (state === "listening") { sr.current?.stop(); if (mr.current?.state === "recording") mr.current.stop(); if (SRClass) setState("idle"); return; }
    if (SRClass) startBrowser(); else startServer();
  };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" className={`btn ${state === "listening" ? "btn-primary animate-pulse" : "btn-secondary"}`} onClick={toggle} disabled={disabled || state === "sending"} aria-pressed={state === "listening"}>
        🎤 {state === "listening" ? "Stop" : state === "sending" ? "Transcribing…" : "Speak"}
      </button>
      {!micOptIn && state === "idle" && <span className="text-xs text-muted">{SRClass ? "Your browser's speech service turns speech into text; check the text before sending." : "Audio is sent to the server for transcription and not kept."}</span>}
      {msg && <span role="alert" className="text-xs">{msg}</span>}
    </span>
  );
}

function ReportView({ r, onAgain, againLabel }: { r: SpeakingReport; onAgain: () => void; againLabel?: string }) {
  const [practice, setPractice] = useState<Record<number, string>>({});
  const f = r.feedback;
  return (
    <section className="card space-y-3" aria-label="Speaking feedback">
      <p className={`chip w-fit ${r.isDemo ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{r.label}</p>
      {r.limitations && <p className="text-xs text-muted">{r.limitations}</p>}
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg surface-2 p-2"><dt className="text-muted">Your turns</dt><dd className="text-lg font-semibold">{r.stats.turns}</dd></div>
        <div className="rounded-lg surface-2 p-2"><dt className="text-muted">Words</dt><dd className="text-lg font-semibold">{r.stats.words}</dd></div>
        <div className="rounded-lg surface-2 p-2"><dt className="text-muted">Questions asked</dt><dd className="text-lg font-semibold">{r.stats.questions}</dd></div>
        <div className="rounded-lg surface-2 p-2"><dt className="text-muted">Connectors</dt><dd className="text-lg font-semibold">{r.stats.connectors.length}</dd></div>
      </dl>
      {f.strengths.length > 0 && <><h3 className="font-semibold">What went well</h3><ul className="list-disc pl-5 text-sm">{f.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      <h3 className="font-semibold">Corrections ({f.corrections.length})</h3>
      {f.corrections.length === 0 && <p className="text-sm">None found{r.isDemo ? " by the rule-based checker, which only knows common patterns" : ""}.</p>}
      <ol className="space-y-3">{f.corrections.map((c, i) => <CorrectionItem key={i} c={c} i={i} practice={practice} setPractice={setPractice} />)}</ol>
      {f.grammarVocab.length > 0 && <><h3 className="font-semibold">Grammar and vocabulary</h3><ul className="list-disc pl-5 text-sm">{f.grammarVocab.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {f.strongerVersions.length > 0 && <><h3 className="font-semibold">Say it more strongly</h3><ul className="space-y-2 text-sm">{f.strongerVersions.map((s, i) => <li key={i}><span lang="fr" className="text-muted line-through">{s.original}</span><br /><span lang="fr" className="font-medium">{s.stronger}</span> <Speak text={s.stronger} /></li>)}</ul></>}
      <div className="rounded-lg surface-2 p-3 text-sm"><p className="font-semibold">Try again</p><p>{f.retry.instruction}</p><ul className="mt-1 list-disc pl-5" lang="fr">{f.retry.prompts.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
      <p className="text-xs text-muted">{f.corrections.some((c) => c.isError) ? "Errors were added to your mistake notebook. " : ""}No pronunciation score is given: the feedback is based on the text of what you said. Tap any word in your partner&apos;s replies to look it up.</p>
      <button className="btn btn-primary" onClick={onAgain}>{againLabel ?? "Practise again"}</button>
    </section>
  );
}
