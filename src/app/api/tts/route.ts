import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ttsCache } from "@/db/schema";
import { authed, HttpError } from "@/server/http";
import { ttsProvider } from "@/server/providers/config";

// Two women's and two men's voices per provider; "narrator" uses the first.
const AZURE_VOICES: Record<string, string> = { f1: "fr-CA-SylvieNeural", f2: "fr-FR-DeniseNeural", m1: "fr-CA-JeanNeural", m2: "fr-FR-HenriNeural", narrator: "fr-CA-SylvieNeural" };
const OPENAI_VOICES: Record<string, string> = { f1: "nova", f2: "shimmer", m1: "onyx", m2: "echo", narrator: "alloy" };
// ElevenLabs French voices routed through Speko. The narrator can be swapped for a cloned voice with SPEKO_NARRATOR_VOICE_ID.
const SPEKO_VOICES: Record<string, string> = { f1: "sQfOhaIRbFZ7R8bP1x9f", f2: "w85ZODduJOHPSdpVT1ia", m1: "IbTlccXlWxGVwnbGUHEd", m2: "jvSOBXJ1cP2sdvT5RgUP", narrator: "sQfOhaIRbFZ7R8bP1x9f" };
const spekoVoice = (voice: string) => (voice === "narrator" && process.env.SPEKO_NARRATOR_VOICE_ID?.trim()) || SPEKO_VOICES[voice];
/** Safari plays <audio> only from servers that answer Range requests with 206, so honour a single byte range. */
function audioResponse(req: Request, bytes: Uint8Array, mime: string): Response {
  const headers: Record<string, string> = { "content-type": mime, "cache-control": "private, max-age=86400", "accept-ranges": "bytes" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  const size = bytes.length;
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    const part = new Uint8Array(bytes.subarray(start, end + 1));
    return new Response(part, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(part.length) } });
  }
  return new Response(new Uint8Array(bytes), { headers: { ...headers, "content-length": String(size) } });
}

function pcmToWav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** Server text-to-speech, cached by (provider, voice, speed, text). Only used when a TTS provider is configured. */
export const GET = authed(async ({ req }) => {
  const provider = ttsProvider();
  if (provider === "device") throw new HttpError(501, "Server voices are not configured.");
  const u = new URL(req.url);
  const text = (u.searchParams.get("text") ?? "").trim();
  if (!text || text.length > 600) throw new HttpError(400, "Text must be 1–600 characters.");
  const voice = u.searchParams.get("voice") ?? "narrator";
  if (!(voice in AZURE_VOICES)) throw new HttpError(400, "Unknown voice");
  const slow = u.searchParams.get("slow") === "1";
  const voiceId = provider === "speko" ? spekoVoice(voice) : voice;
  const key = createHash("sha256").update(JSON.stringify([provider, voiceId, slow, text])).digest("hex");
  const db = await getDb();
  const [hit] = await db.select().from(ttsCache).where(eq(ttsCache.key, key));
  if (hit) {
    const raw = /^audio\/(pcm|l16)/i.test(hit.mime);
    const body = raw ? pcmToWav(Buffer.from(hit.audio), Number(/rate=(\d+)/i.exec(hit.mime)?.[1]) || 24000) : hit.audio;
    return audioResponse(req, new Uint8Array(body), raw ? "audio/wav" : hit.mime);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let audio: Buffer, mime: string;
  try {
    if (provider === "speko") {
      const r = await fetch(`${process.env.SPEKO_BASE_URL?.trim() || "https://api.speko.dev"}/v1/synthesize`, {
        method: "POST", signal: ctrl.signal,
        headers: { authorization: `Bearer ${process.env.SPEKO_API_KEY!.trim()}`, "content-type": "application/json" },
        body: JSON.stringify({
          text, intent: { language: "fr" }, voice: voiceId,
          model: process.env.SPEKO_TTS_MODEL?.trim() || "eleven_multilingual_v2",
          ...(slow && { speed: 0.75 }),
          constraints: { allowedProviders: { tts: ["elevenlabs"] } },
        }),
      });
      if (!r.ok) throw new HttpError(502, `Speech service error (${r.status}).`);
      audio = Buffer.from(await r.arrayBuffer()); mime = r.headers.get("content-type") || "audio/mpeg";
      // Some providers return raw 16-bit mono PCM, which browsers cannot play: wrap it in a WAV header.
      const pcm = /^audio\/(pcm|l16)/i.exec(mime);
      if (pcm) {
        audio = pcmToWav(audio, Number(/rate=(\d+)/i.exec(mime)?.[1]) || 24000);
        mime = "audio/wav";
      }
    } else if (provider === "azure") {
      const ssml = `<speak version="1.0" xml:lang="fr-CA"><voice name="${AZURE_VOICES[voice]}"><prosody rate="${slow ? "-30%" : "0%"}">${esc(text)}</prosody></voice></speak>`;
      const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST", body: ssml, signal: ctrl.signal,
        headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!, "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3" },
      });
      if (!r.ok) throw new HttpError(502, `Speech service error (${r.status}).`);
      audio = Buffer.from(await r.arrayBuffer()); mime = "audio/mpeg";
    } else {
      const r = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/audio/speech`, {
        method: "POST", signal: ctrl.signal,
        headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice: OPENAI_VOICES[voice], input: text, speed: slow ? 0.75 : 1, response_format: "mp3", instructions: "Speak clear standard French." }),
      });
      if (!r.ok) throw new HttpError(502, `Speech service error (${r.status}).`);
      audio = Buffer.from(await r.arrayBuffer()); mime = "audio/mpeg";
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, (e as Error).name === "AbortError" ? "Speech service timed out." : "Could not reach the speech service.");
  } finally { clearTimeout(timer); }
  await db.insert(ttsCache).values({ key, provider, mime, audio }).onConflictDoNothing();
  return audioResponse(req, new Uint8Array(audio), mime);
});
