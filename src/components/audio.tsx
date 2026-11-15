"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefs } from "./prefs";
import { Bi, useBiLabel } from "./bi";

export type VoiceKey = "f1" | "m1" | "f2" | "m2" | "narrator";
export type AudioLine = { text: string; voice?: VoiceKey };

const SLOW_RATE = 0.7;

/** Picks French voices available on this device. */
function frenchVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  // Android Chrome reports some voices as "fr_FR", so normalise the separator before comparing.
  const lang = (v: SpeechSynthesisVoice) => (v.lang ?? "").replace("_", "-").toLowerCase();
  const all = window.speechSynthesis.getVoices().filter((v) => lang(v).startsWith("fr"));
  const score = (v: SpeechSynthesisVoice) => (lang(v) === "fr-fr" ? 0 : lang(v) === "fr-ca" ? 1 : 2) + (v.localService ? 0 : 0.5) - (/natural|neural|premium|enhanced|google/i.test(v.name) ? 1 : 0);
  return all.sort((a, b) => score(a) - score(b));
}

type EngineState = { kind: "server" | "device" | "none"; label: string; labelHi: string; voices: SpeechSynthesisVoice[] };

export function useAudioEngine(): EngineState {
  const { providers } = usePrefs();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { setReady(true); return; }
    const update = () => { setVoices(frenchVoices()); setReady(true); };
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    const t = setTimeout(update, 1200);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", update); clearTimeout(t); };
  }, []);
  if (providers.tts.server) return { kind: "server", label: `Synthetic French voice (${providers.tts.name})`, labelHi: `कंप्यूटर से बनी फ़्रेंच आवाज़ (${providers.tts.name})`, voices };
  if (!ready) return { kind: "device", label: "Loading voices…", labelHi: "आवाज़ें लोड हो रही हैं…", voices };
  if (voices.length) return { kind: "device", label: `Device French voice: ${voices[0].name} (synthetic)`, labelHi: `डिवाइस की फ़्रेंच आवाज़: ${voices[0].name} (कंप्यूटर से बनी)`, voices };
  return { kind: "none", label: "No French voice found on this device", labelHi: "इस डिवाइस पर कोई फ़्रेंच आवाज़ नहीं मिली", voices };
}

let currentAudio: HTMLAudioElement | null = null;
/** Called when playback is cut short, so a waiting play() promise always settles. */
let settleCurrent: (() => void) | null = null;

/**
 * Phones (iOS Safari above all) only allow sound that starts inside a tap. Audio that starts later,
 * after a fetch or a React effect, is blocked. So on the first tap anywhere we "unlock" both engines:
 * one shared <audio> element that is reused for every server clip, and speechSynthesis.
 */
let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
function unlockAudio() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  try {
    sharedAudio ??= new Audio();
    sharedAudio.src = SILENT_WAV;
    sharedAudio.play().catch(() => { /* still unlocked enough for most browsers */ });
  } catch { /* no audio element support */ }
  try {
    if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(""); u.volume = 0; window.speechSynthesis.speak(u); }
  } catch { /* no speech synthesis */ }
}
if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchend"] as const) window.addEventListener(ev, unlockAudio, { once: true, capture: true, passive: true });
}
function audioElement(): HTMLAudioElement { return (sharedAudio ??= new Audio()); }

const ERR = {
  serverAndDevice: { en: "The server voice failed and this device has no French voice.", hi: "सर्वर की आवाज़ नहीं चल पाई और इस डिवाइस पर कोई फ़्रेंच आवाज़ नहीं है।" },
  noSynth: { en: "This browser cannot play synthetic speech.", hi: "यह ब्राउज़र कंप्यूटर से बनी आवाज़ नहीं चला सकता।" },
  noVoice: { en: "No French voice is available on this device. Add a French text-to-speech voice in your device settings, then reload this page.", hi: "इस डिवाइस पर कोई फ़्रेंच आवाज़ उपलब्ध नहीं है। डिवाइस की सेटिंग्स में फ़्रेंच टेक्स्ट-टू-स्पीच आवाज़ जोड़ें, फिर यह पेज दोबारा लोड करें।" },
  playback: { en: "The French audio could not play. Check your device's French voice and sound settings, then try again.", hi: "फ़्रेंच आवाज़ नहीं चल पाई। अपने डिवाइस में फ़्रेंच आवाज़ और ध्वनि की सेटिंग्स जाँचें, फिर दोबारा कोशिश करें।" },
} as const;
/** Hindi for an audio error message; unknown messages get a general Hindi explanation. */
const errorBi = (en: string) => ({ en, hi: Object.values(ERR).find((e) => e.en === en)?.hi ?? ERR.playback.hi });

export function stopAll() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const s = settleCurrent; settleCurrent = null; s?.();
}

async function speakOne(engine: EngineState, line: AudioLine, slow: boolean, voiceIndex: Map<VoiceKey, number>, signal: { cancelled: boolean }) {
  if (signal.cancelled) return;
  const voice = line.voice ?? "narrator";
  if (engine.kind === "server") {
    // Slow playback is done in the browser (pitch kept), because not every server voice honours a speed setting.
    const url = `/api/tts?${new URLSearchParams({ text: line.text, voice, slow: "0", v: "2" })}`;
    const ok = await new Promise<boolean>((resolve) => {
      const a = audioElement() as HTMLAudioElement & { webkitPreservesPitch?: boolean };
      let done = false;
      const finish = (v: boolean) => { if (done) return; done = true; settleCurrent = null; a.onended = a.onerror = null; resolve(v); };
      a.onended = () => finish(true);
      a.onerror = () => finish(false);
      settleCurrent = () => finish(true);
      a.src = url;
      a.preservesPitch = true; a.webkitPreservesPitch = true;
      a.defaultPlaybackRate = a.playbackRate = slow ? SLOW_RATE : 1;
      currentAudio = a;
      a.play().catch(() => finish(false));
    });
    if (ok || signal.cancelled) return;
    // Server voice failed: fall back to the device voice for this line.
    if (!engine.voices.length) throw new Error(ERR.serverAndDevice.en);
  }
  if (!("speechSynthesis" in window)) throw new Error(ERR.noSynth.en);
  // The browser's default voice is often English. Never let it read French as a pronunciation model.
  if (!engine.voices.length) throw new Error(ERR.noVoice.en);
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(line.text);
    // Chrome sometimes never fires onend (and stalls a whole dialogue). A watchdog based on the
    // length of the text keeps the sequence moving. Chrome also cuts off utterances after ~15 s
    // unless the engine is nudged, so we resume it periodically.
    let settled = false;
    const expectedMs = Math.max(2500, line.text.length * (slow ? 140 : 95)) + 2000;
    const keepAlive = setInterval(() => { if (!/Android/i.test(navigator.userAgent) && window.speechSynthesis.speaking && !window.speechSynthesis.paused) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); } }, 10_000);
    const watchdog = setTimeout(() => settle(), expectedMs);
    function settle(err?: Error) {
      if (settled) return;
      settled = true; clearTimeout(watchdog); clearInterval(keepAlive); settleCurrent = null;
      if (err) reject(err); else resolve();
    }
    settleCurrent = () => settle();
    if (!voiceIndex.has(voice)) voiceIndex.set(voice, voiceIndex.size % engine.voices.length);
    u.voice = engine.voices[voiceIndex.get(voice)!];
    u.lang = u.voice.lang.replace("_", "-");
    u.rate = slow ? SLOW_RATE : 1;
    // Natural pitch: changing it to imitate different speakers distorts the model sound.
    u.pitch = 1;
    u.onend = () => settle();
    u.onerror = (e) => {
      if (signal.cancelled || e.error === "canceled" || e.error === "interrupted") settle();
      else settle(new Error(ERR.playback.en));
    };
    // A stuck queue (common after the tab was in the background) swallows new utterances.
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.speak(u);
  });
  await new Promise((r) => setTimeout(r, 250));
}

export function usePlayer() {
  const engine = useAudioEngine();
  const [playing, setPlaying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signal = useRef({ cancelled: false });
  useEffect(() => () => { signal.current.cancelled = true; stopAll(); }, []);

  const play = useCallback(async (lines: AudioLine[], opts: { slow?: boolean; onLine?: (i: number) => void } = {}) => {
    stopAll();
    signal.current.cancelled = true;
    const s = { cancelled: false };
    signal.current = s;
    setError(null);
    const vi = new Map<VoiceKey, number>();
    try {
      for (let i = 0; i < lines.length; i++) {
        if (s.cancelled) break;
        setPlaying(i);
        opts.onLine?.(i);
        await speakOne(engine, lines[i], !!opts.slow, vi, s);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (!s.cancelled) setPlaying(null);
    }
    return !s.cancelled;
  }, [engine]);

  const stop = useCallback(() => { signal.current.cancelled = true; stopAll(); setPlaying(null); }, []);
  return { engine, play, stop, playing, error };
}

/** Small play button for a word or sentence, with optional slow playback. */
export function Speak({ text, voice, label, showSlow = true, size = "sm" }: { text: string; voice?: VoiceKey; label?: string; showSlow?: boolean; size?: "sm" | "md" }) {
  const { play, stop, playing, engine, error } = usePlayer();
  const L = useBiLabel();
  const busy = playing !== null;
  const cls = size === "sm" ? "btn btn-secondary btn-sm" : "btn btn-secondary";
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      <button type="button" className={cls} onClick={() => (busy ? stop() : play([{ text, voice }]))} aria-label={busy ? L({ en: "Stop audio", hi: "आवाज़ रोकें" }) : L({ en: `Play audio: ${label ?? text}`, hi: `सुनें: ${label ?? text}` })} title={L({ en: engine.label, hi: engine.labelHi })}>
        <span aria-hidden>{busy ? "■" : "▶"}</span>{size === "md" && <span>{busy ? L({ en: "Stop", hi: "रोकें" }) : L({ en: "Listen", hi: "सुनें" })}</span>}
      </button>
      {showSlow && (
        <button type="button" className={cls} onClick={() => play([{ text, voice }], { slow: true })} aria-label={L({ en: `Play slowly: ${label ?? text}`, hi: `धीरे सुनें: ${label ?? text}` })} title={L({ en: "Slow pedagogical playback", hi: "सीखने के लिए धीमी गति से सुनें" })}>
          <span aria-hidden>🐢</span>{size === "md" && <span>{L({ en: "Slow", hi: "धीमा" })}</span>}
        </button>
      )}
      {error && <span role="alert" className="basis-full text-sm text-red-700 dark:text-red-300"><Bi as="span" t={errorBi(error)} /></span>}
    </span>
  );
}

/** One short line about where the audio comes from; the details open on request. */
export function AudioSourceNote() {
  const engine = useAudioEngine();
  const none = engine.kind === "none";
  return (
    <details className={`text-xs ${none ? "rounded-lg bg-rose-50 p-2 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" : "text-muted"}`} role="note">
      <summary className="cursor-pointer list-none">
        🔊 <Bi as="span" t={none ? { en: "No French voice on this device: tap to fix", hi: "इस डिवाइस पर फ़्रेंच आवाज़ नहीं है: ठीक करने के लिए टैप करें" } : { en: "Computer voice · about audio", hi: "कंप्यूटर की आवाज़ · ऑडियो के बारे में" }} /> <span aria-hidden>ⓘ</span>
      </summary>
      <Bi as="p" className="mt-1" t={none
        ? { en: `${engine.label}. Install a French text-to-speech voice in your device settings (Language → Text-to-speech → add French) or ask your administrator to enable server voices. Text transcripts remain available.`, hi: `${engine.labelHi}। डिवाइस की सेटिंग्स में फ़्रेंच टेक्स्ट-टू-स्पीच आवाज़ जोड़ें (भाषा → टेक्स्ट-टू-स्पीच → फ़्रेंच जोड़ें), या अपने एडमिनिस्ट्रेटर से सर्वर की आवाज़ें चालू करने को कहें। लिखा हुआ पाठ फिर भी उपलब्ध रहेगा।` }
        : { en: `${engine.label}. This is synthetic speech, not a recording of a native speaker.`, hi: `${engine.labelHi}। यह कंप्यूटर से बनी आवाज़ है, किसी फ़्रेंच भाषी व्यक्ति की रिकॉर्डिंग नहीं।` }} />
    </details>
  );
}

/** Shows why French audio could not play, in English and Hindi. */
export function AudioError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="text-sm text-red-700 dark:text-red-300"><Bi as="span" t={errorBi(error)} /></p>;
}
