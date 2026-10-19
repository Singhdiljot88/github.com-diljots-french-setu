"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { matchPhrase, statusFor, STATUS_LABEL, type PhraseMatch } from "@/lib/speech-match";
import { Speak } from "./audio";
import { Pron } from "./fr-item";
import { Bi, useBiLabel } from "./bi";

export type SayItem = { day: number; fr: string; en: string; hi: string; pron?: string };

type BiT = { en: string; hi: string };
type Alt = { transcript: string };
type SR = { start: () => void; stop: () => void; lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<Alt> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const getSR = (): (new () => SR) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Say a phrase and see which words a French speech recognizer understood. Free: it uses the browser's own
 * recognizer (or text from the learner's phone voice keyboard). It measures recognition, never accent.
 */
export function SayIt({ items, today }: { items: SayItem[]; today: number }) {
  const days = useMemo(() => [...new Set(items.map((i) => i.day))].sort((a, b) => b - a), [items]);
  const [day, setDay] = useState(days.includes(today) ? today : days[0]);
  const [sr, setSr] = useState<(new () => SR) | null | undefined>(undefined);
  useEffect(() => setSr(() => getSR()), []);
  const label = useBiLabel();
  const list = items.filter((i) => i.day === day);
  return (
    <div className="space-y-4">
      <div className="rounded-xl surface-2 p-3 text-sm space-y-1">
        <Bi t={{ en: "How this works. Say a phrase. A French speech recognizer writes down what it heard, and we compare that with the phrase word by word. If a word comes out right, the recognizer understood that sound clearly. This is not an accent score.", hi: "यह कैसे काम करता है: कोई वाक्यांश बोलें। फ़्रेंच बोली पहचानने वाला सिस्टम जो सुनता है उसे लिख देता है, और हम उसे वाक्यांश से शब्द-दर-शब्द मिलाते हैं। अगर कोई शब्द सही आता है, तो सिस्टम ने वह ध्वनि साफ़ समझी। यह आपके उच्चारण के लिए कोई अंक नहीं है।" }} />
        {sr === null && <Bi t={{ en: "Your browser has no built-in speech recognition (Chrome and Edge have it). You can still use your phone's voice keyboard set to French: tap the box under a phrase, speak, then press Check.", hi: "आपके ब्राउज़र में बोली पहचानने की सुविधा नहीं है (Chrome और Edge में है)। फिर भी आप फ़ोन का वॉइस कीबोर्ड फ़्रेंच पर सेट करके इस्तेमाल कर सकते हैं: वाक्यांश के नीचे वाले बॉक्स पर टैप करें, बोलें, फिर “उत्तर जाँचें” दबाएँ।" }} />}
        {sr && <Bi className="text-xs text-muted" t={{ en: "The browser's recognizer sends your audio to its own service (Google for Chrome, Microsoft for Edge) to turn it into text. French Setu only stores the text.", hi: "ब्राउज़र आपकी आवाज़ को लिखित रूप में बदलने के लिए उसे अपनी सेवा (Chrome के लिए Google, Edge के लिए Microsoft) पर भेजता है। French Setu सिर्फ़ लिखा हुआ पाठ रखता है।" }} />}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">{label({ en: "Phrases from", hi: "वाक्यांश कहाँ से" })}
          <select className="input mt-1 w-auto" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {days.map((d) => <option key={d} value={d}>{label({ en: `Day ${d}${d === today ? " (today)" : ""}`, hi: `दिन ${d}${d === today ? " (आज)" : ""}` })}</option>)}
          </select>
        </label>
        <Link href="/pronunciation/report" className="btn btn-secondary btn-sm">{label({ en: "Printable practice report", hi: "प्रिंट करने लायक़ अभ्यास रिपोर्ट" })} →</Link>
      </div>
      <ol className="space-y-3">{list.map((it) => <SayCard key={`${it.day}:${it.fr}`} it={it} sr={sr ?? null} />)}</ol>
    </div>
  );
}

function SayCard({ it, sr }: { it: SayItem; sr: (new () => SR) | null }) {
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const [msg, setMsg] = useState<BiT | null>(null);
  const label = useBiLabel();
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ transcript: string; m: PhraseMatch } | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const rec = useRef<SR | null>(null);

  const record = async (transcript: string, via: "speech_browser" | "typed_keyboard") => {
    const m = matchPhrase(it.fr, transcript);
    setResult({ transcript, m });
    setBest((b) => Math.max(b ?? 0, m.heard));
    try {
      await api("/api/attempts", { body: {
        day: it.day, kind: "say_phrase", itemRef: `say:${it.day}:${it.fr}`.slice(0, 200), skill: "pronunciation", score: m.total ? m.heard / m.total : 0,
        response: { fr: it.fr, en: it.en, hi: it.hi, pron: it.pron ?? null, transcript: transcript.slice(0, 500), via, heard: m.heard, total: m.total, missed: m.words.filter((w) => !w.heard).map((w) => w.word) },
      } });
    } catch { setMsg({ en: "This attempt couldn't be saved. It is shown here but will not be in your report.", hi: "यह प्रयास सहेजा नहीं जा सका। यह यहाँ दिख रहा है, पर आपकी रिपोर्ट में नहीं आएगा।" }); }
  };

  const listen = () => {
    if (!sr) return;
    const r = new sr();
    r.lang = "fr-FR"; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
    r.onresult = (e) => {
      // Of the recognizer's guesses, keep the one closest to the phrase: that is what it could have understood.
      const alts = Array.from({ length: e.results[0]?.length ?? 0 }, (_, i) => e.results[0][i].transcript.trim()).filter(Boolean);
      if (!alts.length) return;
      const pick = alts.map((a) => ({ a, h: matchPhrase(it.fr, a).heard })).sort((x, y) => y.h - x.h)[0].a;
      record(pick, "speech_browser");
    };
    r.onerror = (e) => {
      setState("error");
      setMsg(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? { en: "The browser hasn't been allowed to use the microphone. Allow the microphone for this site in your browser settings and try again, or use your phone's voice keyboard in the box below.", hi: "ब्राउज़र को माइक्रोफ़ोन इस्तेमाल करने की अनुमति नहीं मिली है। ब्राउज़र की सेटिंग्स में इस साइट के लिए माइक्रोफ़ोन की अनुमति दें और दोबारा कोशिश करें, या नीचे वाले बॉक्स में फ़ोन का वॉइस कीबोर्ड इस्तेमाल करें।" }
        : e.error === "no-speech"
          ? { en: "The microphone didn't pick up any speech. Check that it's switched on and not being used by another app, then try again a little closer to it.", hi: "माइक्रोफ़ोन में कोई आवाज़ नहीं आई। देख लें कि वह चालू है और कोई दूसरा ऐप उसे इस्तेमाल नहीं कर रहा, फिर उसके थोड़ा पास आकर दोबारा कोशिश करें।" }
          : e.error === "audio-capture"
            ? { en: "No working microphone was found. Check that one is connected and not being used by another app, then try again.", hi: "कोई चालू माइक्रोफ़ोन नहीं मिला। देख लें कि माइक जुड़ा है और कोई दूसरा ऐप उसे इस्तेमाल नहीं कर रहा, फिर दोबारा कोशिश करें।" }
            : e.error === "network"
              ? { en: "The browser's speech service couldn't be reached. Check your internet connection and try again, or use your voice keyboard in the box below.", hi: "ब्राउज़र की स्पीच सेवा से जुड़ नहीं पाए। अपना इंटरनेट कनेक्शन जाँचें और दोबारा कोशिश करें, या नीचे वाले बॉक्स में वॉइस कीबोर्ड इस्तेमाल करें।" }
              : { en: `Speech recognition stopped (${e.error}). Please try again.`, hi: "बोली पहचानने की सुविधा रुक गई। कृपया दोबारा कोशिश करें।" });
    };
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.current = r; setMsg(null); setState("listening");
    try { r.start(); } catch { setState("error"); setMsg({ en: "Speech recognition couldn't start. Please try again in a moment, or use your voice keyboard in the box below.", hi: "बोली पहचानने की सुविधा शुरू नहीं हो सकी। थोड़ी देर में दोबारा कोशिश करें, या नीचे वाले बॉक्स में वॉइस कीबोर्ड इस्तेमाल करें।" }); }
  };

  const st = result ? statusFor(result.m.heard, result.m.total) : null;
  return (
    <li className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p lang="fr" className="text-lg font-medium">{it.fr}</p>
          <Bi className="text-sm text-muted" t={{ en: it.en, hi: it.hi }} />
          <Pron pron={it.pron} day={it.day} />
        </div>
        <Speak text={it.fr} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sr && (state === "listening"
          ? <button type="button" className="btn btn-primary btn-sm animate-pulse" onClick={() => rec.current?.stop()}>■ {label({ en: "Listening… tap to stop", hi: "सुन रहे हैं… रोकने के लिए टैप करें" })}</button>
          : <button type="button" className="btn btn-primary btn-sm" onClick={listen}>🎤 {label({ en: "Say it", hi: "बोलें" })}</button>)}
        {best !== null && <span className="text-xs text-muted">{label({ en: `Best this session: ${best} of ${result?.m.total} words`, hi: `इस बार का सबसे अच्छा: ${result?.m.total} में से ${best} शब्द` })}</span>}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { record(typed.trim(), "typed_keyboard"); setTyped(""); } }}>
        <label className="sr-only" htmlFor={`kb-${it.day}-${it.fr}`}>{label({ en: "Text from your voice keyboard", hi: "आपके वॉइस कीबोर्ड से लिखा पाठ" })}</label>
        <input id={`kb-${it.day}-${it.fr}`} lang="fr" className="input flex-1 min-w-48" placeholder={label(sr ? { en: "…or paste what your voice keyboard typed", hi: "…या वॉइस कीबोर्ड ने जो लिखा उसे यहाँ चिपकाएँ" } : { en: "Speak with your voice keyboard here", hi: "यहाँ वॉइस कीबोर्ड से बोलें" })} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        <button className="btn btn-secondary btn-sm" disabled={!typed.trim()}>{label({ en: "Check", hi: "उत्तर जाँचें" })}</button>
      </form>
      {msg && <p role="alert" className="text-sm">{label(msg)}</p>}
      {result && st && (
        <div className="rounded-lg surface-2 p-2 text-sm" aria-live="polite">
          <p>{label({ en: "Heard:", hi: "सुना गया:" })} <q lang="fr">{result.transcript}</q></p>
          <p className="mt-1" lang="fr">{result.m.words.map((w, i) => <span key={i} className={`mr-1 rounded px-1 ${w.heard ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100" : "bg-red-100 text-red-900 line-through decoration-1 dark:bg-red-900/40 dark:text-red-100"}`}>{w.word}</span>)}</p>
          <p className="mt-1">{STATUS_LABEL[st].icon} {label({
            en: `${result.m.heard} of ${result.m.total} words recognised.${st !== "all" ? " Listen to the model again, then try once more." : ""}`,
            hi: `${result.m.total} में से ${result.m.heard} शब्द पहचाने गए।${st !== "all" ? " नमूना फिर से सुनें, फिर एक बार और कोशिश करें।" : ""}`,
          })}</p>
        </div>
      )}
    </li>
  );
}
