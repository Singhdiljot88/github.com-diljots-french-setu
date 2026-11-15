"use client";

type Alt = { transcript: string; confidence: number };
type Results = ArrayLike<ArrayLike<Alt> & { isFinal: boolean }>;

/** Longest recording sent for transcription. Stops automatically so a forgotten mic never runs on. */
export const MAX_RECORDING_MS = 30_000;

/**
 * Same shape as the browser's SpeechRecognition, backed by the microphone + the server's /api/stt
 * (Speko). Used where the built-in recognizer is missing or unreliable (Safari on iPhone aborts).
 * Recording runs until stop() is called (or 30 s pass), then the audio is transcribed once and discarded.
 */
export class ServerSpeechRecognition {
  lang = "fr-FR"; interimResults = false; maxAlternatives = 1; continuous = false;
  onresult: ((e: { results: Results; resultIndex: number }) => void) | null = null;
  onerror: ((e: { error: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  /** Fired when recording has stopped and the audio is being transcribed. */
  onprocessing: (() => void) | null = null;
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private wantStop = false;
  private aborted = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ended = false;

  private end() { if (this.ended) return; this.ended = true; if (this.timer) clearTimeout(this.timer); this.stream?.getTracks().forEach((t) => t.stop()); this.onend?.(); }

  start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      queueMicrotask(() => { this.onerror?.({ error: "audio-capture" }); this.end(); });
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((stream) => {
      this.stream = stream;
      // stop() or abort() pressed while the permission prompt was open.
      if (this.aborted) { this.end(); return; }
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (this.aborted) { this.end(); return; }
        const blob = new Blob(chunks, { type: rec.mimeType || chunks[0]?.type || "audio/webm" });
        if (blob.size < 1200) { this.onerror?.({ error: "no-speech" }); this.end(); return; }
        this.onprocessing?.();
        try {
          const fd = new FormData(); fd.append("audio", blob);
          const lang = this.lang.toLowerCase().startsWith("hi") ? "hi" : "fr";
          const r = await fetch(`/api/stt?lang=${lang}`, { method: "POST", body: fd });
          const j = await r.json().catch(() => ({})) as { text?: string; error?: string };
          if (!r.ok) this.onerror?.({ error: "network", message: j.error });
          else if (!j.text?.trim()) this.onerror?.({ error: "no-speech" });
          else {
            const alt = Object.assign([{ transcript: j.text.trim(), confidence: 1 }], { isFinal: true });
            this.onresult?.({ results: [alt], resultIndex: 0 });
          }
        } catch { this.onerror?.({ error: "network" }); }
        this.end();
      };
      this.rec = rec;
      rec.start(250);
      this.timer = setTimeout(() => this.stop(), MAX_RECORDING_MS);
      if (this.wantStop) this.stop();
    }).catch((e: Error) => {
      this.onerror?.({ error: e.name === "NotAllowedError" || e.name === "SecurityError" ? "not-allowed" : "audio-capture" });
      this.end();
    });
  }

  stop() {
    this.wantStop = true;
    if (this.rec?.state === "recording") this.rec.stop();
  }

  /** Stops without transcribing. */
  abort() {
    this.aborted = true;
    if (this.rec?.state === "recording") this.rec.stop();
    else if (this.stream) this.end();
  }
}

/** The browser's own recognizer, if it has one (Chrome, Edge, Safari 14.1+). */
export function browserRecognizer<T>(): (new () => T) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => T; webkitSpeechRecognition?: new () => T };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
