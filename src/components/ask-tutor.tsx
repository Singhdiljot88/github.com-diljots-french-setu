"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { ServerSpeechRecognition, browserRecognizer } from "@/lib/server-speech";
import { Speak, stopAll } from "./audio";
import { Bi, useBiLabel } from "./bi";
import { usePrefs } from "./prefs";

type Answer = { answer: { en: string; hi: string }; examples: { fr: string; pron: string; hi: string; en?: string }[]; followUps: string[]; outOfScope: boolean };
type QA = { q: string; a: Answer };
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; onprocessing?: (() => void) | null };

const STARTERS = [
  "इस पाठ का व्याकरण आसान भाषा में समझाइए",
  "हिंदी बोलने वाले यहाँ क्या ग़लती करते हैं?",
  "इस पाठ के 3 सबसे ज़रूरी वाक्य बताइए",
  "इस पाठ से एक छोटा रोल-प्ले बनाइए",
  "मुझे इस पाठ के शब्दों से अभ्यास कराइए"
];

/**
 * "Ask the tutor": one button that opens a small chat about this lesson. Ask in Hindi, Hinglish or
 * English, by typing or speaking. Follow-up questions keep the last few turns as context.
 */
export function AskTutor({ day }: { day: number }) {
  const { providers } = usePrefs();
  const L = useBiLabel();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chat, setChat] = useState<QA[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [mic, setMic] = useState<"idle" | "listening" | "sending">("idle");
  const [BrowserRec, setBrowserRec] = useState<(new () => Rec) | null>(null);
  const recRef = useRef<Rec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => setBrowserRec(() => browserRecognizer<Rec>()), []);
  useEffect(() => () => { recRef.current?.abort(); }, []);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [chat.length, pending, open]);

  if (!providers.ai.available) {
    return (
      <details className="card text-sm">
        <summary className="cursor-pointer font-medium">🙋 <Bi as="span" t={{ en: "Ask the tutor", hi: "टीचर से पूछें" }} /></summary>
        <Bi className="mt-2 text-muted" t={{ en: "The AI tutor needs an AI key on the server (Speko, Anthropic or OpenAI). Until then, use the grammar box, the dictionary and the mistake notebook.", hi: "AI टीचर के लिए सर्वर पर AI कुंजी चाहिए (Speko, Anthropic या OpenAI)। तब तक व्याकरण बॉक्स, शब्दकोश और ग़लतियों की कॉपी इस्तेमाल करें।" }} />
      </details>
    );
  }

  const ask = async (text = q) => {
    const t = text.trim();
    if (t.length < 2 || busy) return;
    setBusy(true); setErr(null); setPending(t); setQ("");
    try {
      const history = chat.slice(-3).map((c) => ({ q: c.q, a: c.a.answer.hi || c.a.answer.en }));
      const a = await api<Answer>(`/api/lesson/${day}/ask`, { body: { question: t, history } });
      setChat((h) => [...h, { q: t, a: { ...a, followUps: a.followUps ?? [] } }].slice(-8));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong. Please try again. · कुछ गड़बड़ हुई, दोबारा कोशिश करें।");
      setQ(t);
    } finally { setBusy(false); setPending(null); }
  };

  const canSpeak = providers.stt.server || !!BrowserRec;
  const speak = () => {
    if (mic === "listening") { recRef.current?.stop(); return; }
    stopAll();
    const r: Rec = providers.stt.server ? (new ServerSpeechRecognition() as unknown as Rec) : new BrowserRec!();
    r.lang = "hi-IN"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const t = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ").trim(); if (t) void ask(t); };
    r.onerror = (e) => setErr(e.error === "not-allowed" ? "Allow the microphone for this site, or type. · इस साइट को माइक की अनुमति दें, या टाइप करें।" : e.error === "no-speech" ? "Nothing was heard. Try again. · कुछ सुनाई नहीं दिया, दोबारा बोलें।" : "Your speech couldn't be turned into text. Please type. · आवाज लिखी नहीं जा सकी, टाइप करें।");
    r.onprocessing = () => setMic("sending");
    r.onend = () => setMic("idle");
    recRef.current = r; setErr(null); setMic("listening");
    try { r.start(); } catch { setMic("idle"); }
  };

  const clearChat = () => {
    setChat([]);
    setQ("");
    setErr(null);
    setPending(null);
  };

  // Closed: a small floating button, so the tutor is one tap away anywhere in the lesson without taking space.
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 py-3 pl-3 pr-4 font-semibold text-white shadow-lg transition-transform hover:scale-105 print:hidden lg:bottom-8 lg:right-8">
        <span aria-hidden className="text-xl">🙋</span><Bi as="span" t={{ en: "Ask", hi: "पूछें" }} />
      </button>
    );
  }

  const last = chat[chat.length - 1];
  return (
    <section role="dialog" aria-modal="false" className="card fixed inset-x-2 bottom-20 z-40 flex max-h-[78vh] flex-col space-y-3 !shadow-2xl animate-fade-up print:hidden sm:left-auto sm:right-4 sm:w-[26rem] lg:bottom-6 lg:right-6" aria-labelledby={`ask-h-${day}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`ask-h-${day}`} className="font-semibold">🙋 <Bi as="span" t={{ en: "Ask the tutor", hi: "टीचर से पूछें" }} /></h2>
        <div className="flex gap-1">
          {chat.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearChat} aria-label={L({ en: "Clear chat", hi: "चैट साफ़ करें" })}>🗑</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label={L({ en: "Close the tutor", hi: "टीचर बंद करें" })}>✕</button>
        </div>
      </div>

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {chat.length === 0 && !pending && (
          <li className="space-y-2">
            <Bi className="text-sm text-muted" t={{ en: "Try one of these, or write your own:", hi: "इनमें से कोई चुनिए, या अपना सवाल लिखिए:" }} />
            <div className="flex flex-col items-start gap-2">
              {STARTERS.map((s) => <button key={s} type="button" lang="hi" className="deva rounded-2xl rounded-bl-sm surface-2 px-3 py-2 text-left text-sm hover:ring-1 hover:ring-brand-400" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
            </div>
          </li>
        )}
        {chat.map((c, i) => (
          <li key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-sm text-white">{c.q}</p>
            <AnswerBubble a={c.a} />
          </li>
        ))}
        {pending && (
          <li className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-sm text-white">{pending}</p>
            <p className="w-fit rounded-2xl rounded-bl-sm surface-2 px-3 py-2 text-sm text-muted"><span className="inline-flex gap-1" aria-label={L({ en: "Thinking", hi: "सोच रहे हैं" })}><span className="animate-bounce">•</span><span className="animate-bounce [animation-delay:120ms]">•</span><span className="animate-bounce [animation-delay:240ms]">•</span></span></p>
          </li>
        )}
        <div ref={endRef} />
      </ol>

      {last && !busy && last.a.followUps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {last.a.followUps.map((f) => <button key={f} type="button" lang="hi" className="toggle-chip deva" onClick={() => ask(f)}>{f}</button>)}
          <button type="button" className="toggle-chip" onClick={() => ask("और आसान भाषा में समझाइए")}><Bi as="span" t={{ en: "Simpler please", hi: "और आसान" }} /></button>
        </div>
      )}

      {err && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{err}</p>}

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <label htmlFor={`ask-${day}`} className="sr-only">{L({ en: "Your question", hi: "आपका सवाल" })}</label>
        <textarea id={`ask-${day}`} lang="hi" rows={1} className="input deva min-h-11 flex-1 resize-none" maxLength={500} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }}
          placeholder={chat.length ? L({ en: "Ask a follow-up…", hi: "आगे पूछिए…" }) : "जैसे: je m'appelle में m' क्यों है?"} />
        {canSpeak && <button type="button" className={`btn ${mic === "listening" ? "mic-live" : "btn-secondary"} !px-3`} onClick={speak} disabled={busy || mic === "sending"} aria-label={L({ en: mic === "listening" ? "Stop and ask" : "Ask by voice (Hindi)", hi: mic === "listening" ? "रोकें और पूछें" : "बोलकर पूछें (हिंदी)" })}>{mic === "sending" ? "⏳" : "🎤"}</button>}
        <button type="submit" className="btn btn-primary !px-4" disabled={busy || q.trim().length < 2} aria-label={L({ en: "Ask", hi: "पूछें" })}>➤</button>
      </form>
      <Bi className="text-xs text-muted" t={{ en: "AI answers can be wrong: check anything that looks off. Pronunciation in Devanagari is approximate.", hi: "AI के जवाब ग़लत हो सकते हैं: जो अजीब लगे उसे जाँच लें। देवनागरी में उच्चारण लगभग है।" }} />
    </section>
  );
}

function AnswerBubble({ a }: { a: Answer }) {
  const [showEn, setShowEn] = useState(false);
  const [copied, setCopied] = useState(false);
  const { explanationLang } = usePrefs();
  const main = explanationLang === "en" ? a.answer.en : a.answer.hi || a.answer.en;
  const other = explanationLang === "en" ? a.answer.hi : a.answer.en;

  const copyAnswer = async () => {
    const text = [main, ...a.examples.map((x) => x.fr)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm surface-2 p-3 text-sm relative">
      <div className="flex justify-between items-start gap-2">
        <p lang={explanationLang === "en" ? "en" : "hi"} className={explanationLang === "en" ? "" : "deva flex-1"}>{main}</p>
        <button type="button" className="text-xs opacity-60 hover:opacity-100 shrink-0" onClick={copyAnswer} title="Copy">
          {copied ? "✓" : "📋"}
        </button>
      </div>
      {other && other !== main && (
        <>
          <button type="button" className="text-xs underline text-muted" onClick={() => setShowEn((s) => !s)}>{explanationLang === "en" ? (showEn ? "हिंदी छिपाएँ" : "हिंदी में देखें") : (showEn ? "Hide English" : "Show in English")}</button>
          {showEn && <p lang={explanationLang === "en" ? "hi" : "en"} className={`text-muted ${explanationLang === "en" ? "deva" : ""}`}>{other}</p>}
        </>
      )}
      {a.examples.length > 0 && (
        <ul className="space-y-2 border-t border-app pt-2">
          {a.examples.map((x, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span lang="fr" className="block font-semibold">{x.fr}</span>
                {x.pron && <span lang="hi" className="deva block text-saffron-700 dark:text-saffron-300">{x.pron}</span>}
                <span lang="hi" className="deva block text-muted">{x.hi}{x.en ? <span lang="en"> · {x.en}</span> : null}</span>
              </span>
              <Speak text={x.fr} showSlow />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
