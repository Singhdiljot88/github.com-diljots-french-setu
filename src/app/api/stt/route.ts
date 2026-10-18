import { authed, HttpError } from "@/server/http";
import { sttProvider } from "@/server/providers/config";

const MAX_BYTES = 4_000_000;

/** Server speech-to-text for browsers without built-in recognition. Audio is transcribed and discarded. */
export const POST = authed(async ({ req }) => {
  const provider = sttProvider();
  if (provider === "browser") throw new HttpError(501, "Server speech recognition is not configured. Type your answer instead.");
  const fd = await req.formData();
  const audio = fd.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) throw new HttpError(400, "No audio");
  if (audio.size > MAX_BYTES) throw new HttpError(413, "Recording is too long.");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    if (provider === "openai") {
      const out = new FormData();
      out.append("file", audio, "speech.webm");
      out.append("model", process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe");
      out.append("language", "fr");
      const r = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/audio/transcriptions`, { method: "POST", body: out, signal: ctrl.signal, headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
      if (!r.ok) throw new HttpError(502, `Transcription failed (${r.status}).`);
      const j = await r.json() as { text?: string };
      return { text: j.text ?? "", provider: "openai" };
    }
    // Azure short-audio REST API expects WAV/OGG; browsers usually record webm/ogg (Firefox) — ogg works, webm may not.
    const region = process.env.AZURE_SPEECH_REGION;
    const r = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=fr-CA&format=simple`, {
      method: "POST", signal: ctrl.signal, body: Buffer.from(await audio.arrayBuffer()),
      headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!, "content-type": audio.type.includes("ogg") ? "audio/ogg; codecs=opus" : "audio/wav" },
    });
    if (!r.ok) throw new HttpError(502, `Transcription failed (${r.status}).`);
    const j = await r.json() as { DisplayText?: string };
    return { text: j.DisplayText ?? "", provider: "azure" };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, (e as Error).name === "AbortError" ? "Transcription timed out." : "Could not reach the transcription service.");
  } finally { clearTimeout(t); }
});
