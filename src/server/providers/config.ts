import "server-only";
import type { ProviderStatus } from "@/components/prefs";

const env = (k: string) => process.env[k]?.trim() || undefined;

/**
 * Chat features use the existing OPENAI_API_KEY (same name as the speech routes).
 * Nothing is renamed. With that variable empty, the app stays in labelled demo mode.
 * AI_PROVIDER=anthropic or speko selects those backends only when that provider's own key is set.
 */
export function aiProvider(): "openai" | "anthropic" | "speko" | "demo" {
  const p = env("AI_PROVIDER");
  if (p === "demo") return "demo";
  if (p === "anthropic") return env("ANTHROPIC_API_KEY") ? "anthropic" : "demo";
  if (p === "speko") return env("SPEKO_API_KEY") ? "speko" : "demo";
  if (p === "openai" || !p) return env("OPENAI_API_KEY") ? "openai" : "demo";
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
