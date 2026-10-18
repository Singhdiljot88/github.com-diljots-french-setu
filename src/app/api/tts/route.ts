import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ttsCache } from "@/db/schema";
import { authed, HttpError } from "@/server/http";
import { ttsProvider } from "@/server/providers/config";

// Two women's and two men's voices per provider; "narrator" uses the first.
const AZURE_VOICES: Record<string, string> = { f1: "fr-CA-SylvieNeural", f2: "fr-FR-DeniseNeural", m1: "fr-CA-JeanNeural", m2: "fr-FR-HenriNeural", narrator: "fr-CA-SylvieNeural" };
const OPENAI_VOICES: Record<string, string> = { f1: "nova", f2: "shimmer", m1: "onyx", m2: "echo", narrator: "alloy" };
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
  const key = createHash("sha256").update(JSON.stringify([provider, voice, slow, text])).digest("hex");
  const db = await getDb();
  const [hit] = await db.select().from(ttsCache).where(eq(ttsCache.key, key));
  if (hit) return new Response(new Uint8Array(hit.audio), { headers: { "content-type": hit.mime, "cache-control": "private, max-age=86400" } });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let audio: Buffer, mime: string;
  try {
    if (provider === "azure") {
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
  return new Response(new Uint8Array(audio), { headers: { "content-type": mime, "cache-control": "private, max-age=86400" } });
});
