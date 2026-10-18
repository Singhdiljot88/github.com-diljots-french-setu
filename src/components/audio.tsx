"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefs } from "./prefs";

export type VoiceKey = "f1" | "m1" | "f2" | "m2" | "narrator";
export type AudioLine = { text: string; voice?: VoiceKey };

const SLOW_RATE = 0.7;
const PITCH: Record<VoiceKey, number> = { f1: 1.12, f2: 1.22, m1: 0.88, m2: 0.8, narrator: 1 };

/** Picks French voices available on this device. */
function frenchVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const all = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  const score = (v: SpeechSynthesisVoice) => (v.lang === "fr-FR" ? 0 : v.lang === "fr-CA" ? 1 : 2) + (v.localService ? 0 : 0.5) - (/natural|neural|premium|enhanced|google/i.test(v.name) ? 1 : 0);
  return all.sort((a, b) => score(a) - score(b));
}

type EngineState = { kind: "server" | "device" | "none"; label: string; voices: SpeechSynthesisVoice[] };

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
  if (providers.tts.server) return { kind: "server", label: `Synthetic French voice (${providers.tts.name})`, voices };
  if (!ready) return { kind: "device", label: "Loading voices…", voices };
  if (voices.length) return { kind: "device", label: `Device French voice: ${voices[0].name} (synthetic)`, voices };
  return { kind: "none", label: "No French voice found on this device", voices };
}

let currentAudio: HTMLAudioElement | null = null;

export function stopAll() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}

async function speakOne(engine: EngineState, line: AudioLine, slow: boolean, voiceIndex: Map<VoiceKey, number>, signal: { cancelled: boolean }) {
  if (signal.cancelled) return;
  const voice = line.voice ?? "narrator";
  if (engine.kind === "server") {
    const url = `/api/tts?${new URLSearchParams({ text: line.text, voice, slow: slow ? "1" : "0" })}`;
    const ok = await new Promise<boolean>((resolve) => {
      const a = new Audio(url);
      currentAudio = a;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.play().catch(() => resolve(false));
    });
    if (ok || signal.cancelled) return;
    // Server voice failed: fall back to the device voice for this line.
    if (!engine.voices.length) throw new Error("The server voice failed and this device has no French voice.");
  }
  if (!("speechSynthesis" in window)) throw new Error("This browser cannot play synthetic speech.");
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(line.text);
    u.lang = engine.voices[0]?.lang ?? "fr-FR";
    if (engine.voices.length) {
      if (!voiceIndex.has(voice)) voiceIndex.set(voice, voiceIndex.size % engine.voices.length);
      u.voice = engine.voices[voiceIndex.get(voice)!];
    }
    u.rate = slow ? SLOW_RATE : 1;
    u.pitch = engine.voices.length > 1 ? 1 : PITCH[voice];
    u.onend = () => resolve();
    u.onerror = () => resolve();
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
  const { play, stop, playing, engine } = usePlayer();
  const busy = playing !== null;
  const cls = size === "sm" ? "btn btn-secondary btn-sm" : "btn btn-secondary";
  return (
    <span className="inline-flex gap-1 align-middle">
      <button type="button" className={cls} onClick={() => (busy ? stop() : play([{ text, voice }]))} aria-label={busy ? "Stop audio" : `Play audio: ${label ?? text}`} title={engine.label} disabled={engine.kind === "none" && !("speechSynthesis" in (globalThis as object))}>
        <span aria-hidden>{busy ? "■" : "▶"}</span>{size === "md" && <span>{busy ? "Stop" : "Listen"}</span>}
      </button>
      {showSlow && (
        <button type="button" className={cls} onClick={() => play([{ text, voice }], { slow: true })} aria-label={`Play slowly: ${label ?? text}`} title="Slow pedagogical playback">
          <span aria-hidden>🐢</span>{size === "md" && <span>Slow</span>}
        </button>
      )}
    </span>
  );
}

export function AudioSourceNote() {
  const engine = useAudioEngine();
  return (
    <p className="text-xs text-muted" role="note">
      🔊 {engine.label}.{" "}
      {engine.kind === "none"
        ? "Install a French text-to-speech voice in your device settings (Language → Text-to-speech → add French) or ask your administrator to enable server voices. Text transcripts remain available."
        : "This is synthetic speech, not a recording of a native speaker."}
    </p>
  );
}
