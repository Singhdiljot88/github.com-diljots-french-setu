"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Speak, stopAll } from "./audio";
import { ServerSpeechRecognition, browserRecognizer } from "@/lib/server-speech";
import { Bi, useBiLabel } from "./bi";
import { usePrefs } from "./prefs";
import { SaveWordButton } from "./save-word";

type BiT = { en: string; hi: string };
type Result = {
  detectedInput: string; understood: string; french: string; pron: string; english: string; register: "informal" | "formal" | "neutral";
  alternative?: { french: string; pron: string; note: BiT };
  words: { fr: string; pron: string; hi: string; en: string; gender: "m" | "f" | "none"; lemma: string }[];
  wordOrder: BiT; hindiTraps: BiT[]; tip: BiT; provider: string;
};

const EXAMPLES = ["मुझे एक कॉफ़ी चाहिए", "Aap kahan rehte ho?", "मैं कनाडा में काम करता हूँ", "Kal mera exam hai", "बाथरूम कहाँ है?", "Mujhe French seekhni hai"];
const REGISTER: Record<Result["register"], BiT> = {
  informal: { en: "Informal (tu)", hi: "अनौपचारिक (tu, जैसे तुम)" },
  formal: { en: "Formal (vous)", hi: "औपचारिक (vous, जैसे आप)" },
  neutral: { en: "Neutral", hi: "सामान्य" },
};
const GENDER: Record<string, BiT> = { m: { en: "masc.", hi: "पुल्लिंग" }, f: { en: "fem.", hi: "स्त्रीलिंग" } };

export function HindiToFrench() {
  const { providers } = usePrefs();
  const L = useBiLabel();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [rec, setRec] = useState<"idle" | "listening" | "sending">("idle");

  const go = async (t = text) => {
    const q = t.trim();
    if (!q) return;
    setBusy(true); setErr(null);
    try { setRes(await api<Result>("/api/hindi-bridge", { body: { text: q } })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  // Server recognition (Speko) when configured; otherwise Chrome/Edge/Safari's own recognizer in Hindi (hi-IN).
  type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string; message?: string }) => void) | null; onend: (() => void) | null; onprocessing?: (() => void) | null };
  const [BrowserRec, setBrowserRec] = useState<(new () => Rec) | null>(null);
  useEffect(() => setBrowserRec(() => browserRecognizer<Rec>()), []);
  const recRef = useRef<Rec | null>(null);
  useEffect(() => () => { recRef.current?.abort(); }, []);
  const canSpeak = providers.stt.server || !!BrowserRec;

  const mic = () => {
    if (rec === "listening") { recRef.current?.stop(); return; }
    stopAll();
    const r: Rec = providers.stt.server ? (new ServerSpeechRecognition() as unknown as Rec) : new BrowserRec!();
    r.lang = "hi-IN"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const t = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ").trim(); if (t) { setText(t); go(t); } };
    r.onerror = (e) => setErr(e.error === "not-allowed" || e.error === "service-not-allowed"
      ? "The microphone isn't allowed. Allow it for this site in your browser settings, or type instead. · माइक्रोफ़ोन की अनुमति नहीं है। ब्राउज़र की सेटिंग्स में अनुमति दें, या टाइप करें।"
      : e.error === "no-speech" ? "No speech was heard. Try again a little closer to the mic. · कोई आवाज़ सुनाई नहीं दी। माइक के पास आकर दोबारा बोलें।"
      : e.message ?? "Your speech couldn't be turned into text. Please try again or type. · आपकी आवाज़ लिखी नहीं जा सकी। दोबारा कोशिश करें या टाइप करें।");
    r.onprocessing = () => setRec("sending");
    r.onend = () => setRec("idle");
    recRef.current = r; setErr(null); setRec("listening");
    try { r.start(); } catch { setRec("idle"); setErr("The microphone couldn't start. Please try again or type. · माइक्रोफ़ोन शुरू नहीं हुआ। दोबारा कोशिश करें या टाइप करें।"); }
  };

  if (!providers.ai.available) {
    return <Bi className="card" t={{ en: "This needs the AI tutor, which isn't switched on for this app yet.", hi: "इसके लिए AI ट्यूटर चाहिए, जो इस ऐप में अभी चालू नहीं है।" }} />;
  }

  return (
    <div className="space-y-4">
      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label htmlFor="hb-input" className="block font-semibold">
          <Bi as="span" t={{ en: "Type or say it in Hindi, Hinglish or English", hi: "हिंदी, हिंग्लिश या अंग्रेज़ी में लिखें या बोलें" }} />
        </label>
        <textarea id="hb-input" lang="hi" className="input deva min-h-24 w-full" maxLength={600} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="जैसे: मुझे एक कॉफ़ी चाहिए · Aap kaise ho?" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? L({ en: "Translating…", hi: "अनुवाद हो रहा है…" }) : L({ en: "Say it in French", hi: "फ़्रेंच में बताओ" })}
          </button>
          {canSpeak && (
            <button type="button" className={`btn ${rec === "listening" ? "btn-primary mic-live" : "btn-secondary"}`} onClick={mic} disabled={busy || rec === "sending"} aria-pressed={rec === "listening"}>
              🎤 {rec === "listening" ? L({ en: "Stop", hi: "रोकें" }) : rec === "sending" ? L({ en: "Transcribing…", hi: "लिखा जा रहा है…" }) : L({ en: "Speak Hindi", hi: "हिंदी में बोलें" })}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2" aria-label={L({ en: "Examples", hi: "उदाहरण" })}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip deva hover:bg-[var(--surface-2)]" onClick={() => { setText(ex); go(ex); }} disabled={busy}>{ex}</button>
          ))}
        </div>
        {err && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{err}</p>}
      </form>

      {res && (
        <section className="space-y-4" aria-live="polite" aria-label={L({ en: "French", hi: "फ़्रेंच" })}>
          <div className="card space-y-2">
            <p lang="hi" className="deva text-sm text-muted">{res.understood}</p>
            <p lang="fr" className="text-2xl font-bold">{res.french}</p>
            <p lang="hi" className="deva text-lg">🗣️ {res.pron}</p>
            <p className="text-sm text-muted">{res.english}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Speak text={res.french} size="md" />
              <span className="chip"><Bi as="span" t={REGISTER[res.register]} /></span>
            </div>
          </div>

          {res.alternative && (
            <div className="card space-y-1">
              <Bi as="h3" className="font-semibold" t={{ en: "Also possible", hi: "ऐसे भी कह सकते हैं" }} />
              <p lang="fr" className="text-lg font-semibold">{res.alternative.french}</p>
              <p lang="hi" className="deva">🗣️ {res.alternative.pron}</p>
              <Bi className="text-sm text-muted" t={res.alternative.note} />
              <Speak text={res.alternative.french} />
            </div>
          )}

          {res.words.length > 0 && (
            <div className="card">
              <Bi as="h3" className="mb-2 font-semibold" t={{ en: "Word by word", hi: "शब्द-दर-शब्द" }} />
              <ul className="divide-y divide-[var(--border)]">
                {res.words.map((w, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span lang="fr" className="font-semibold">{w.fr}</span>
                    <span lang="hi" className="deva text-muted">{w.pron}</span>
                    <span lang="hi" className="deva">= {w.hi}</span>
                    {GENDER[w.gender] && <span className="chip text-xs"><Bi as="span" t={GENDER[w.gender]} /></span>}
                    <span className="ml-auto flex items-center gap-1">
                      <Speak text={w.fr} showSlow={false} />
                      <SaveWordButton word={{ fr: w.lemma || w.fr, en: w.en, hi: w.hi, gender: w.gender === "none" ? undefined : w.gender }} source="custom" sourceRef="hindi-bridge" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card space-y-1">
            <Bi as="h3" className="font-semibold" t={{ en: "Word order: Hindi vs French", hi: "शब्दों का क्रम: हिंदी बनाम फ़्रेंच" }} />
            <Bi t={res.wordOrder} />
          </div>

          {res.hindiTraps.length > 0 && (
            <div className="card space-y-2">
              <Bi as="h3" className="font-semibold" t={{ en: "Watch out (common for Hindi speakers)", hi: "ध्यान दें (हिंदी बोलने वालों की आम ग़लतियाँ)" }} />
              <ul className="list-disc space-y-1 pl-5">{res.hindiTraps.map((t, i) => <Bi key={i} as="li" t={t} />)}</ul>
            </div>
          )}

          <div className="card space-y-1">
            <Bi as="h3" className="font-semibold" t={{ en: "Memory trick", hi: "याद रखने की तरकीब" }} />
            <Bi t={res.tip} />
          </div>

          <Bi className="text-xs text-muted" t={{ en: "AI answer: check anything that looks wrong. Pronunciation in Devanagari is approximate; listen to the audio.", hi: "AI का जवाब: जो ग़लत लगे उसे जाँच लें। देवनागरी में उच्चारण अनुमानित है; ऑडियो ज़रूर सुनें।" }} />
        </section>
      )}
    </div>
  );
}
