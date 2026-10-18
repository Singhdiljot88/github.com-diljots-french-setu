"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { matchPhrase, statusFor, STATUS_LABEL, type PhraseMatch } from "@/lib/speech-match";
import { Speak } from "./audio";
import { Pron } from "./fr-item";

export type SayItem = { day: number; fr: string; en: string; hi: string; pron?: string };

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
  const list = items.filter((i) => i.day === day);
  return (
    <div className="space-y-4">
      <div className="rounded-xl surface-2 p-3 text-sm space-y-1">
        <p><strong>How this works.</strong> Say a phrase. A French speech recognizer writes down what it heard, and we compare that with the phrase word by word. If a word comes out right, the recognizer understood that sound clearly. This is not an accent score.</p>
        {sr === null && <p>Your browser has no built-in speech recognition (Chrome and Edge have it). You can still use your phone&apos;s voice keyboard set to French: tap the box under a phrase, speak, then press Check.</p>}
        {sr && <p className="text-xs text-muted">The browser&apos;s recognizer sends your audio to its own service (Google for Chrome, Microsoft for Edge) to turn it into text. French Setu only stores the text.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Phrases from
          <select className="input mt-1 w-auto" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {days.map((d) => <option key={d} value={d}>Day {d}{d === today ? " (today)" : ""}</option>)}
          </select>
        </label>
        <Link href="/pronunciation/report" className="btn btn-secondary btn-sm">Printable practice report →</Link>
      </div>
      <ol className="space-y-3">{list.map((it) => <SayCard key={`${it.day}:${it.fr}`} it={it} sr={sr ?? null} />)}</ol>
    </div>
  );
}

function SayCard({ it, sr }: { it: SayItem; sr: (new () => SR) | null }) {
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
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
    } catch { setMsg("Could not save this attempt. It is shown here but will not be in your report."); }
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
    r.onerror = (e) => { setState("error"); setMsg(e.error === "not-allowed" ? "Microphone permission was denied. Allow it in the browser, or use your phone's voice keyboard in the box below." : e.error === "no-speech" ? "Nothing was heard. Try again a little closer to the microphone." : e.error === "network" ? "The browser's speech service could not be reached. Use your voice keyboard in the box below." : `Speech recognition stopped (${e.error}).`); };
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.current = r; setMsg(null); setState("listening");
    try { r.start(); } catch { setState("error"); setMsg("Speech recognition could not start."); }
  };

  const st = result ? statusFor(result.m.heard, result.m.total) : null;
  return (
    <li className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p lang="fr" className="text-lg font-medium">{it.fr}</p>
          <p className="text-sm text-muted">{it.en} · <span lang="hi" className="deva">{it.hi}</span></p>
          <Pron pron={it.pron} day={it.day} />
        </div>
        <Speak text={it.fr} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sr && (state === "listening"
          ? <button type="button" className="btn btn-primary btn-sm animate-pulse" onClick={() => rec.current?.stop()}>■ Listening… tap to stop</button>
          : <button type="button" className="btn btn-primary btn-sm" onClick={listen}>🎤 Say it</button>)}
        {best !== null && <span className="text-xs text-muted">Best this session: {best} of {result?.m.total} words</span>}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { record(typed.trim(), "typed_keyboard"); setTyped(""); } }}>
        <label className="sr-only" htmlFor={`kb-${it.day}-${it.fr}`}>Text from your voice keyboard</label>
        <input id={`kb-${it.day}-${it.fr}`} lang="fr" className="input flex-1 min-w-48" placeholder={sr ? "…or paste what your voice keyboard typed" : "Speak with your voice keyboard here"} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        <button className="btn btn-secondary btn-sm" disabled={!typed.trim()}>Check</button>
      </form>
      {msg && <p role="alert" className="text-sm">{msg}</p>}
      {result && st && (
        <div className="rounded-lg surface-2 p-2 text-sm" aria-live="polite">
          <p>Heard: <q lang="fr">{result.transcript}</q></p>
          <p className="mt-1" lang="fr">{result.m.words.map((w, i) => <span key={i} className={`mr-1 rounded px-1 ${w.heard ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100" : "bg-red-100 text-red-900 line-through decoration-1 dark:bg-red-900/40 dark:text-red-100"}`}>{w.word}</span>)}</p>
          <p className="mt-1">{STATUS_LABEL[st].icon} {result.m.heard} of {result.m.total} words recognised.{st !== "all" && " Listen to the model again, then try once more."}</p>
        </div>
      )}
    </li>
  );
}
