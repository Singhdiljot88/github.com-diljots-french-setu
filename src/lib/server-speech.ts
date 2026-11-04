"use client";

type Alt = { transcript: string; confidence: number };
type Results = ArrayLike<ArrayLike<Alt> & { isFinal: boolean }>;

/**
 * Same shape as the browser's SpeechRecognition, backed by the microphone + the server's /api/stt
 * (Speko). Used where the built-in recognizer is missing or unreliable (Safari on iPhone aborts).
 * Recording runs until stop() is called, then the audio is transcribed once and discarded.
 */
export class ServerSpeechRecognition {
  lang = "fr-FR"; interimResults = false; maxAlternatives = 1; continuous = false;
  onresult: ((e: { results: Results }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  private rec: MediaRecorder | null = null;

  start() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const fd = new FormData(); fd.append("audio", new Blob(chunks, { type: rec.mimeType }));
          const lang = this.lang.toLowerCase().startsWith("hi") ? "hi" : "fr";
          const r = await fetch(`/api/stt?lang=${lang}`, { method: "POST", body: fd });
          const j = await r.json().catch(() => ({})) as { text?: string };
          if (!r.ok) this.onerror?.({ error: "network" });
          else if (!j.text?.trim()) this.onerror?.({ error: "no-speech" });
          else {
            const alt = Object.assign([{ transcript: j.text, confidence: 1 }], { isFinal: true });
            this.onresult?.({ results: [alt] });
          }
        } catch { this.onerror?.({ error: "network" }); }
        this.onend?.();
      };
      this.rec = rec; rec.start();
    }).catch((e: Error) => {
      this.onerror?.({ error: e.name === "NotAllowedError" ? "not-allowed" : "audio-capture" });
      this.onend?.();
    });
  }

  stop() { if (this.rec?.state === "recording") this.rec.stop(); }
}
