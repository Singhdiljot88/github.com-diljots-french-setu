"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { Scenario, SpeakingMode, SpeakingReport } from "@/server/speaking";
import { usePrefs } from "./prefs";
import { Bi, useBiLabel } from "./bi";
import { Speak, usePlayer, AudioSourceNote, stopAll } from "./audio";
import { ServerSpeechRecognition } from "@/lib/server-speech";
import { AccentBar } from "./accent-bar";
import { TappableText } from "./tappable";
import { CorrectionItem, noticeBi } from "./writing-editor";

type BiT = { en: string; hi: string };
type Catalog = { topics: { id: string; title: BiT; level: string }[]; presentations: { id: string; title: BiT; level: string }[]; tef: { id: string; title: string }[]; roleplays: { id: string; title: BiT }[] };
export type Turn = { role: "learner" | "partner"; text: string; help?: { en?: string; hi?: string }; recast?: string };

const MODES: { mode: SpeakingMode; en: string; hi: string; desc: BiT }[] = [
  { mode: "roleplay", en: "Lesson role-play", hi: "पाठ का रोल-प्ले", desc: { en: "Act out the situation from a lesson.", hi: "किसी पाठ की स्थिति को निभाकर देखिए।" } },
  { mode: "interview", en: "Answer questions", hi: "सवालों के जवाब", desc: { en: "Your partner asks, you answer with details.", hi: "आपका साथी पूछता है, आप विस्तार से जवाब देते हैं।" } },
  { mode: "conversation", en: "Conversation", hi: "बातचीत", desc: { en: "A two-way chat. Your partner sometimes disagrees.", hi: "दोनों तरफ़ से बातचीत। आपका साथी कभी-कभी असहमत भी होता है।" } },
  { mode: "presentation", en: "Short presentation", hi: "छोटी प्रस्तुति", desc: { en: "Speak for 1–3 minutes, then answer questions.", hi: "1–3 मिनट बोलिए, फिर सवालों के जवाब दीजिए।" } },
  { mode: "tef_a", en: "TEF task A", hi: "TEF भाग A", desc: { en: "Ask about ten questions to get information (5 min).", hi: "जानकारी पाने के लिए लगभग दस सवाल पूछिए (5 मिनट)।" } },
  { mode: "tef_b", en: "TEF task B", hi: "TEF भाग B", desc: { en: "Convince a sceptical friend (10 min).", hi: "शक करने वाले एक दोस्त को मनाइए (10 मिनट)।" } },
];
const SCRIPTED_NOTE = "The scripted partner answered instead.";
const noteBi = (n: string): { en: string; hi?: string } => (n.endsWith(SCRIPTED_NOTE) ? { en: n, hi: "AI साथी अभी जवाब नहीं दे सका, इसलिए स्क्रिप्ट वाले साथी ने जवाब दिया।" } : { en: n });
const mockTitle = (t: string): BiT => ({ en: t, hi: t.replace(/Practice exam (\d+)/, "अभ्यास परीक्षा $1") });

type SR = { start: () => void; stop: () => void; abort: () => void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const getSR = (): (new () => SR) | null => (typeof window === "undefined" ? null : ((window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition ?? null));

export function SpeakingTutor({ catalog, initial }: { catalog: Catalog; initial?: { mode: SpeakingMode; ref: string } }) {
  const [mode, setMode] = useState<SpeakingMode>(initial?.mode ?? "interview");
  const label = useBiLabel();
  const withLevel = (t: BiT, level: string) => label({ en: `${t.en} (${level})`, hi: `${t.hi} (${level})` });
  const options = mode === "roleplay" ? catalog.roleplays.map((r) => ({ id: r.id, label: label(r.title) }))
    : mode === "presentation" ? catalog.presentations.map((p) => ({ id: `topic:${p.id}`, label: withLevel(p.title, p.level) }))
    : mode === "tef_a" || mode === "tef_b" ? catalog.tef.map((t) => ({ id: `mock:${t.id}`, label: label(mockTitle(t.title)) }))
    : catalog.topics.map((t) => ({ id: `topic:${t.id}`, label: withLevel(t.title, t.level) }));
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
        <legend className="mb-2 font-semibold">{label({ en: "Choose a practice mode", hi: "अभ्यास का तरीक़ा चुनिए" })}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <label key={m.mode} className={`card cursor-pointer ${mode === m.mode ? "border-brand-500 ring-1 ring-brand-500" : ""}`}>
              <input type="radio" name="sp-mode" className="sr-only" checked={mode === m.mode} onChange={() => { setMode(m.mode); setRef(""); }} />
              <Bi as="span" className="block font-medium" t={{ en: m.en, hi: m.hi }} />
              <Bi as="span" className="block text-sm text-muted" t={m.desc} />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">{label(mode === "roleplay" ? { en: "Lesson", hi: "पाठ" } : mode.startsWith("tef") ? { en: "Practice exam", hi: "अभ्यास परीक्षा" } : { en: "Topic", hi: "विषय" })}
        <select className="input mt-1" value={ref} onChange={(e) => setRef(e.target.value)}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      {options.length === 0 && <Bi className="text-sm text-muted" t={{ en: "No lessons with a role-play are available yet.", hi: "अभी रोल-प्ले वाला कोई पाठ उपलब्ध नहीं है।" }} />}
      <div className="rounded-lg surface-2 p-3 text-sm">
        {providers.ai.available
          ? <label className="flex items-center gap-2"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> <Bi as="span" t={{ en: `Use the AI partner (${providers.ai.name}). Untick for the scripted partner.`, hi: `AI साथी (${providers.ai.name}) इस्तेमाल करें। स्क्रिप्ट वाले साथी के लिए निशान हटा दें।` }} /></label>
          : <Bi t={{ en: "Demo mode: no AI is configured, so you will talk to a scripted partner (not AI). It follows a fixed script and does not understand what you say, except in TEF task A, where it matches keywords in your questions to the facts it knows.", hi: "डेमो मोड: कोई AI सेट नहीं है, इसलिए आप एक स्क्रिप्ट वाले साथी (AI नहीं) से बात करेंगे। यह एक तय स्क्रिप्ट पर चलता है और आपकी बात नहीं समझता, सिवाय TEF भाग A के, जहाँ यह आपके सवालों के मुख्य शब्दों को अपनी जानकारी से मिलाता है।" }} />}
      </div>
      <button className="btn btn-primary" disabled={!options.length} onClick={start}>{label({ en: "Start", hi: "शुरू करें" })}</button>
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
  const [showDetails, setShowDetails] = useState(false);
  const { play } = usePlayer();
  const endRef = useRef<HTMLDivElement>(null);
  const label = useBiLabel();

  useEffect(() => { if (autoPlay && !initialTurns?.length && !initialReport) play([{ text: s.opening, voice: "f1" }]); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Scroll to new turns, but not on first render, so the task instructions at the top stay visible.
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const n = turns.length + (report ? 1 : 0);
    if (seen.current !== null && n > seen.current) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    seen.current = n;
  }, [turns.length, report]);
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
    <div className="flex flex-col max-h-[calc(100dvh-7rem)] space-y-3">
      <div className="card space-y-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Bi as="h2" className="font-semibold" t={s.title} />
          <span className={`chip ${isDemo ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{isDemo ? label({ en: "Scripted partner (not AI)", hi: "स्क्रिप्ट वाला साथी (AI नहीं)" }) : label({ en: "AI partner", hi: "AI साथी" })}</span>
        </div>
        <Bi t={s.setting} className="text-sm" />
        <button type="button" className="text-xs underline text-muted" onClick={() => setShowDetails((d) => !d)}>
          {showDetails ? label({ en: "Hide details", hi: "विवरण छिपाएँ" }) : label({ en: "Show goals & roles", hi: "लक्ष्य और भूमिकाएँ देखें" })}
        </button>
        {showDetails && (
          <>
            <p className="text-sm"><strong>{label({ en: "You:", hi: "आप:" })}</strong> <Bi as="span" t={s.learnerRole} /> · <strong>{label({ en: "Partner:", hi: "साथी:" })}</strong> <Bi as="span" t={s.partnerRole} /></p>
            <ul className="list-disc pl-5 text-sm">{s.goals.map((g, i) => <Bi key={i} as="li" t={g} />)}</ul>
            {s.document && <pre lang="fr" className="whitespace-pre-wrap rounded-lg surface-2 p-3 font-[inherit] text-sm">{s.document}</pre>}
          </>
        )}
        {left !== null && <p className={`font-mono ${left === 0 ? "text-red-700 dark:text-red-300" : ""}`} role="timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} {left === 0 ? `· ${exam ? label({ en: "time is up", hi: "समय ख़त्म" }) : label({ en: "time is up (exam rules would stop here)", hi: "समय ख़त्म (परीक्षा में यहीं रुकना होता)" })}` : label({ en: "left", hi: "बाक़ी" })}</p>}
      </div>

      <ol className="space-y-2 flex-1 overflow-y-auto min-h-0 pr-1" aria-label={label({ en: "Conversation", hi: "बातचीत" })} aria-live="polite">
        {turns.map((t, i) => <TurnView key={i} t={t} noHelp={exam} />)}
        {busy && !report && <li className="text-sm text-muted">{label({ en: "Partner is replying…", hi: "साथी जवाब दे रहा है…" })}</li>}
        <div ref={endRef} />
      </ol>
      {note && <p role="status" className="text-sm text-muted shrink-0">{label(noteBi(note))}</p>}

      {!report && (
        <div className="card shrink-0 space-y-2">
          <label htmlFor="sp-in" className="sr-only">{label({ en: "Your reply in French", hi: "फ़्रेंच में आपका जवाब" })}</label>
          <textarea id="sp-in" lang="fr" rows={2} className="input" value={text} onChange={(e) => { setText(e.target.value); if (via !== "typed" && !e.target.value) setVia("typed"); }} placeholder={label(timeUp ? { en: "Time is up.", hi: "समय ख़त्म हो गया।" } : finished ? { en: "The conversation has ended. Get your feedback below.", hi: "बातचीत ख़त्म हो गई। नीचे अपना फ़ीडबैक पाएँ।" } : { en: "Say or type your reply in French", hi: "अपना जवाब फ़्रेंच में बोलें या टाइप करें" })} disabled={finished || timeUp}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <AccentBar targetId="sp-in" />
          <div className="flex flex-wrap items-center gap-2">
            <MicButton disabled={finished || busy || timeUp} onText={(t, v) => { setText((x) => (x ? x + " " : "") + t); setVia(v); }} />
            <button className="btn btn-primary" disabled={!text.trim() || busy || finished || timeUp} onClick={send}>{label({ en: "Send", hi: "भेजें" })}</button>
            <button className="btn btn-secondary ml-auto" disabled={busy || (!exam && turns.every((t) => t.role !== "learner"))} onClick={end}>{exam ? label({ en: "End this task", hi: "यह कार्य ख़त्म करें" }) : label({ en: "End and get feedback", hi: "ख़त्म करें और फ़ीडबैक पाएँ" })}</button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <label className="flex items-center gap-1"><input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} /> {label({ en: "Read aloud", hi: "बोलकर सुनाएँ" })}</label>
            {!exam && <button className="underline" onClick={onExit}>{label({ en: "Leave", hi: "बाहर जाएँ" })}</button>}
          </div>
          <AudioSourceNote />
        </div>
      )}
      {report && <ReportView r={report} onAgain={onExit} againLabel={exam ? label({ en: "Continue", hi: "जारी रखें" }) : undefined} />}
    </div>
  );
}

/** noHelp: exam rules, so no word look-up, translations or corrections during the task. */
function TurnView({ t, noHelp }: { t: Turn; noHelp?: boolean }) {
  const [help, setHelp] = useState(false);
  const label = useBiLabel();
  if (noHelp) return <li className={t.role === "learner" ? "ml-8 rounded-xl bg-brand-50 p-3 dark:bg-brand-900/40" : "mr-8 rounded-xl surface-2 p-3"}><p lang="fr">{t.text}</p></li>;
  if (t.role === "learner") {
    return (
      <li className="ml-8 rounded-xl bg-brand-50 p-3 dark:bg-brand-900/40">
        <p lang="fr">{t.text}</p>
        {t.recast && <p className="mt-1 text-sm text-muted">{label({ en: "Clearer:", hi: "ज़्यादा साफ़:" })} <span lang="fr" className="font-medium">{t.recast}</span></p>}
      </li>
    );
  }
  return (
    <li className="mr-8 rounded-xl surface-2 p-3">
      <div className="flex items-start gap-2"><div className="flex-1"><TappableText text={t.text} sourceRef="speaking" hint={false} /></div><Speak text={t.text} voice="f1" /></div>
      {t.help && (t.help.en || t.help.hi) && (
        <>
          <button className="mt-1 text-xs underline" onClick={() => setHelp((h) => !h)} aria-expanded={help}>{help ? label({ en: "Hide translation", hi: "अनुवाद छिपाएँ" }) : label({ en: "Show translation", hi: "अनुवाद देखें" })}</button>
          {help && <Bi t={{ en: t.help.en ?? "", hi: t.help.hi ?? "" }} className="text-sm text-muted" />}
        </>
      )}
    </li>
  );
}

function MicButton({ onText, disabled }: { onText: (t: string, via: "speech_browser" | "speech_server") => void; disabled: boolean }) {
  const { providers, micOptIn } = usePrefs();
  const [state, setState] = useState<"idle" | "listening" | "sending" | "error">("idle");
  const [msg, setMsg] = useState<BiT | null>(null);
  const label = useBiLabel();
  const sr = useRef<SR | null>(null);
  const [SRClass, setSRClass] = useState<(new () => SR) | null | undefined>(undefined);
  useEffect(() => setSRClass(() => getSR()), []);
  useEffect(() => () => { sr.current?.abort(); }, []);
  if (SRClass === undefined) return null;
  const canServer = providers.stt.server;
  if (!SRClass && !canServer) return <Bi as="span" className="text-xs text-muted" t={{ en: "Speech input isn't available in this browser. You can type your reply instead (Chrome and Edge support speech input).", hi: "इस ब्राउज़र में बोलकर लिखने की सुविधा नहीं है। आप अपना जवाब टाइप कर सकते हैं (Chrome और Edge में यह सुविधा मिलती है)।" }} />;
  const useServer = canServer;

  const start = () => {
    stopAll();
    const r: SR & { onprocessing?: (() => void) | null } = useServer ? (new ServerSpeechRecognition() as unknown as SR) : new SRClass!();
    r.lang = "fr-FR"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const out = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ").trim(); if (out) onText(out, useServer ? "speech_server" : "speech_browser"); };
    r.onerror = (e) => {
      setState("error");
      setMsg(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? { en: "The browser hasn't been allowed to use the microphone. Allow the microphone for this site in your browser settings, then try again. You can also type your reply.", hi: "ब्राउज़र को माइक्रोफ़ोन इस्तेमाल करने की अनुमति नहीं मिली है। ब्राउज़र की सेटिंग्स में इस साइट के लिए माइक्रोफ़ोन की अनुमति दें, फिर दोबारा कोशिश करें। आप अपना जवाब टाइप भी कर सकते हैं।" }
        : e.error === "no-speech"
          ? { en: "The microphone didn't pick up any speech. Check that it's switched on and not being used by another app, then try again, a little closer to the mic.", hi: "माइक्रोफ़ोन में कोई आवाज़ नहीं आई। देख लें कि वह चालू है और कोई दूसरा ऐप उसे इस्तेमाल नहीं कर रहा, फिर उसके थोड़ा पास आकर दोबारा कोशिश करें।" }
          : { en: `Speech recognition stopped (${e.error}). Please try again or type your reply.`, hi: "बोली पहचानने की सुविधा रुक गई। कृपया दोबारा कोशिश करें या टाइप करें।" });
    };
    r.onend = () => setState((s) => (s === "listening" || s === "sending" ? "idle" : s));
    r.onprocessing = () => setState("sending");
    sr.current = r; setMsg(null); setState("listening");
    try { r.start(); } catch { setState("error"); setMsg({ en: "Speech recognition couldn't start. Please try again or type your reply.", hi: "बोली पहचानने की सुविधा शुरू नहीं हो सकी। दोबारा कोशिश करें या टाइप करें।" }); }
  };
  return (
    <>
      <button type="button" className={`btn ${state === "listening" ? "mic-live" : "btn-secondary"}`} disabled={disabled || state === "sending"} onClick={() => (state === "listening" ? sr.current?.stop() : start())} aria-label={label({ en: state === "listening" ? "Stop" : "Speak", hi: state === "listening" ? "रोकें" : "बोलें" })}>
        {state === "listening" ? "■" : state === "sending" ? "⏳" : "🎤"} {label({ en: state === "listening" ? "Stop" : "Speak", hi: state === "listening" ? "रोकें" : "बोलें" })}
      </button>
      {msg && <span className="text-xs text-rose-700 dark:text-rose-300">{label(msg)}</span>}
    </>
  );
}

function ReportView({ r, onAgain, againLabel }: { r: SpeakingReport; onAgain: () => void; againLabel?: string }) {
  const [practice, setPractice] = useState<Record<number, string>>({});
  const label = useBiLabel();
  const f = r.feedback;
  return (
    <section className="card space-y-3" aria-labelledby="sp-report">
      <h2 id="sp-report" className="font-semibold">{label({ en: "Feedback", hi: "फ़ीडबैक" })}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-muted">{label({ en: "Turns", hi: "बारी" })}</dt><dd className="text-lg font-semibold">{r.stats.turns}</dd></div>
        <div><dt className="text-muted">{label({ en: "Words", hi: "शब्द" })}</dt><dd className="text-lg font-semibold">{r.stats.words}</dd></div>
        <div><dt className="text-muted">{label({ en: "Questions", hi: "सवाल" })}</dt><dd className="text-lg font-semibold">{r.stats.questions}</dd></div>
        <div><dt className="text-muted">{label({ en: "Minutes", hi: "मिनट" })}</dt><dd className="text-lg font-semibold">{r.stats.minutes}</dd></div>
      </dl>
      {f.strengths.length > 0 && <><Bi as="h3" className="font-semibold" t={{ en: "What went well", hi: "क्या अच्छा रहा" }} /><ul className="list-disc pl-5 text-sm">{f.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      <Bi as="h3" className="font-semibold" t={{ en: `Corrections (${f.corrections.length})`, hi: `सुधार (${f.corrections.length})` }} />
      {f.corrections.length === 0 && <Bi className="text-sm" t={r.isDemo
        ? { en: "None found by the rule-based checker, which only knows common patterns.", hi: "नियम-आधारित जाँच को कोई ग़लती नहीं मिली; यह केवल आम पैटर्न जानती है।" }
        : { en: "None found.", hi: "कोई ग़लती नहीं मिली।" }} />}
      <ol className="space-y-3">{f.corrections.map((c, i) => <CorrectionItem key={i} c={c} i={i} practice={practice} setPractice={setPractice} />)}</ol>
      {f.grammarVocab.length > 0 && <><Bi as="h3" className="font-semibold" t={{ en: "Grammar and vocabulary", hi: "व्याकरण और शब्दावली" }} /><ul className="list-disc pl-5 text-sm">{f.grammarVocab.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {f.strongerVersions.length > 0 && <><Bi as="h3" className="font-semibold" t={{ en: "Say it more strongly", hi: "इसे और असरदार ढंग से कहें" }} /><ul className="space-y-2 text-sm">{f.strongerVersions.map((s, i) => <li key={i}><span lang="fr" className="text-muted line-through">{s.original}</span><br /><span lang="fr" className="font-medium">{s.stronger}</span> <Speak text={s.stronger} /></li>)}</ul></>}
      <div className="rounded-lg surface-2 p-3 text-sm"><Bi className="font-semibold" t={{ en: "Try again", hi: "फिर से कोशिश करें" }} /><p>{f.retry.instruction}</p><ul className="mt-1 list-disc pl-5" lang="fr">{f.retry.prompts.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
      <Bi className="text-xs text-muted" t={{
        en: `${f.corrections.some((c) => c.isError) ? "Errors were added to your mistake notebook. " : ""}No pronunciation score is given: the feedback is based on the text of what you said. Tap any word in your partner's replies to look it up.`,
        hi: `${f.corrections.some((c) => c.isError) ? "ग़लतियाँ आपकी ग़लतियों की कॉपी में जोड़ दी गई हैं। " : ""}उच्चारण के लिए कोई अंक नहीं दिए जाते: फ़ीडबैक आपकी कही बात के लिखित रूप पर आधारित है। साथी के जवाबों में किसी भी शब्द पर टैप करके उसका अर्थ देखें।`,
      }} />
      <button className="btn btn-primary" onClick={onAgain}>{againLabel ?? label({ en: "Practise again", hi: "फिर से अभ्यास करें" })}</button>
    </section>
  );
}
