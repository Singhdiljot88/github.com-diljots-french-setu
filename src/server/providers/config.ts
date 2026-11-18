import "server-only";
import type { ProviderStatus } from "@/components/prefs";

const env = (k: string) => process.env[k]?.trim() || undefined;

/**
 * Chat features (tutor, speaking partner, writing feedback) use a real model
 * whenever a key exists. OPENAI_API_KEY is preferred. SPEKO_API_KEY is the
 * fallback and is enough on its own. ANTHROPIC_API_KEY is used when it is the
 * only key. AI_PROVIDER can force one of those, or "demo". If the named
 * provider has no key, the same order applies, so a missing OpenAI key still
 * reaches Speko. Demo mode is only the last resort.
 */
export function aiProvider(): "openai" | "anthropic" | "speko" | "demo" {
  const p = env("AI_PROVIDER");
  if (p === "demo") return "demo";
  const openai = !!env("OPENAI_API_KEY");
  const speko = !!env("SPEKO_API_KEY");
  const anthropic = !!env("ANTHROPIC_API_KEY");
  if (p === "openai" && openai) return "openai";
  if (p === "speko" && speko) return "speko";
  if (p === "anthropic" && anthropic) return "anthropic";
  if (openai) return "openai";
  if (speko) return "speko";
  if (anthropic) return "anthropic";
  return "demo";
}

export function ttsProvider(): "speko" | "openai" | "azure" | "device" {
  const p = env("TTS_PROVIDER");
  if (p === "device") return "device";
  if ((p === "speko" || !p) && env("SPEKO_API_KEY")) return "speko";
  if ((p === "azure" || !p) && env("AZURE_SPEECH_KEY") && env("AZURE_SPEECH_REGION")) return "azure";
  if ((p === "openai" || !p) && env("OPENAI_API_KEY") && p === "openai") return "openai";
  return "device";
}

export function sttProvider(): "speko" | "openai" | "azure" | "browser" {
  const p = env("STT_PROVIDER");
  if (p === "browser") return "browser";
  if ((p === "speko" || !p) && env("SPEKO_API_KEY")) return "speko";
  if ((p === "openai" || !p) && env("OPENAI_API_KEY")) return "openai";
  if ((p === "azure" || !p) && env("AZURE_SPEECH_KEY") && env("AZURE_SPEECH_REGION")) return "azure";
  return "browser";
}

export function pronunciationProvider(): "azure" | "none" {
  return env("AZURE_SPEECH_KEY") && env("AZURE_SPEECH_REGION") && env("PRONUNCIATION_PROVIDER") !== "none" ? "azure" : "none";
}

export function searchProvider(): "brave" | "tavily" | "none" {
  const p = env("SEARCH_PROVIDER");
  if (p === "none") return "none";
  if ((p === "brave" || !p) && env("BRAVE_SEARCH_API_KEY")) return "brave";
  if ((p === "tavily" || !p) && env("TAVILY_API_KEY")) return "tavily";
  return "none";
}

const NAMES = { speko: "Speko", anthropic: "Claude (Anthropic)", openai: "OpenAI", demo: "Demo mode", azure: "Azure AI Speech", device: "device voice", browser: "browser speech recognition", none: "not configured", brave: "Brave Search", tavily: "Tavily" } as const;

export function providerStatus(): ProviderStatus {
  const ai = aiProvider(), tts = ttsProvider(), stt = sttProvider(), pr = pronunciationProvider(), se = searchProvider();
  return {
    ai: { available: ai !== "demo", name: ai === "speko" ? "Claude via Speko" : NAMES[ai] },
    tts: { server: tts !== "device", name: tts === "openai" ? "OpenAI TTS" : tts === "speko" && env("SPEKO_NARRATOR_VOICE_ID") ? "Speko, narrator in a cloned voice" : NAMES[tts] },
    stt: { server: stt !== "browser", name: stt === "openai" ? "OpenAI transcription" : stt === "speko" ? "Speko speech recognition" : NAMES[stt] },
    pronunciation: { available: pr !== "none", name: NAMES[pr] },
    search: { available: se !== "none", name: NAMES[se] },
  };
}
