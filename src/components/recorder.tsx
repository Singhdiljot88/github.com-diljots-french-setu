"use client";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "./prefs";
import { usePlayer, type VoiceKey } from "./audio";

export type RecorderState = "idle" | "explain" | "requesting" | "denied" | "unsupported" | "recording" | "recorded" | "error";

/**
 * Records the learner's voice for self-comparison. Audio stays in this tab
 * (object URL) unless the learner opted in to keeping recordings.
 */
export function Recorder({ model, voice, refKey, onRecorded, compact = false }: { model?: string; voice?: VoiceKey; refKey: string; onRecorded?: (blob: Blob) => void; compact?: boolean }) {
  const { micOptIn, keepRecordings } = usePrefs();
  const [state, setState] = useState<RecorderState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [saved, setSaved] = useState<"no" | "saving" | "yes" | "error">("no");
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { play } = usePlayer();

  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); if (url) URL.revokeObjectURL(url); if (timer.current) clearInterval(timer.current); }, [url]);

  const start = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setState("unsupported"); return; }
    if (!micOptIn && state !== "explain") { setState("explain"); return; }
    setState("requesting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      setState((e as DOMException).name === "NotAllowedError" || (e as DOMException).name === "SecurityError" ? "denied" : "error");
      return;
    }
    const mr = new MediaRecorder(stream.current);
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    mr.onstop = () => {
      const b = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      stream.current?.getTracks().forEach((t) => t.stop());
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(b)); setBlob(b); setSaved("no");
      setState("recorded");
      onRecorded?.(b);
    };
    rec.current = mr;
    mr.start();
    setSecs(0);
    timer.current = setInterval(() => setSecs((s) => { if (s >= 59) { mr.state === "recording" && mr.stop(); } return s + 1; }), 1000);
    setState("recording");
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); rec.current?.state === "recording" && rec.current.stop(); };
  const discard = () => { if (url) URL.revokeObjectURL(url); setUrl(null); setBlob(null); setState("idle"); };
  const keep = async () => {
    if (!blob) return;
    setSaved("saving");
    const fd = new FormData(); fd.append("audio", blob); fd.append("ref", refKey); fd.append("kind", "practice");
    const r = await fetch("/api/recordings", { method: "POST", body: fd });
    setSaved(r.ok ? "yes" : "error");
  };

  return (
    <div className={`space-y-2 ${compact ? "" : "rounded-xl surface-2 p-3"}`}>
      {state === "explain" && (
        <div className="rounded-lg border border-app bg-[var(--surface)] p-3 text-sm" role="dialog" aria-label="About the microphone">
          <p className="font-medium">Before you record</p>
          <p>Your browser will ask to use the microphone. The recording stays in this tab for you to replay and compare. It is not uploaded unless you press “Keep in my account” or ask for transcription.</p>
          <p lang="hi" className="deva text-muted">ब्राउज़र माइक्रोफ़ोन की अनुमति माँगेगा। रिकॉर्डिंग सिर्फ़ इसी टैब में रहती है।</p>
          <div className="mt-2 flex gap-2"><button type="button" className="btn btn-primary btn-sm" onClick={start}>Allow and record</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setState("idle")}>Not now</button></div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {model && <button type="button" className="btn btn-secondary btn-sm" onClick={() => play([{ text: model, voice }])}>▶ Model</button>}
        {state !== "recording"
          ? <button type="button" className="btn btn-primary btn-sm" onClick={start} disabled={state === "requesting"}>● {state === "recorded" ? "Record again" : "Record"}</button>
          : <button type="button" className="btn btn-primary btn-sm" onClick={stop}>■ Stop ({secs}s)</button>}
        {url && <audio controls src={url} className="h-9 max-w-full" aria-label="Your recording" />}
        {url && model && <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await play([{ text: model, voice }]); const a = new Audio(url); await a.play(); }}>⇄ Compare</button>}
        {url && <button type="button" className="btn btn-ghost btn-sm" onClick={discard}>Delete</button>}
        {url && keepRecordings && saved !== "yes" && <button type="button" className="btn btn-ghost btn-sm" onClick={keep} disabled={saved === "saving"}>Keep in my account</button>}
        {saved === "yes" && <span className="text-xs text-muted">Saved. Manage recordings in Settings.</span>}
      </div>
      {state === "recording" && <p className="text-sm" aria-live="polite">Recording… speak now.</p>}
      {state === "denied" && <p role="alert" className="text-sm">Microphone access was blocked. To record, allow the microphone for this site in your browser settings (usually the lock icon in the address bar). You can still listen, repeat aloud and compare yourself without recording.</p>}
      {state === "unsupported" && <p role="alert" className="text-sm">This browser cannot record audio. Try a recent Chrome, Edge, Firefox or Safari. You can still repeat aloud after the model.</p>}
      {state === "error" && <p role="alert" className="text-sm">No microphone was found or it could not start. Check that one is connected.</p>}
      {state === "recorded" && !compact && <p className="text-xs text-muted">Self-comparison only: listen for vowel quality, nasal vowels, the French r and rhythm. This is not an automatic pronunciation score.</p>}
    </div>
  );
}
