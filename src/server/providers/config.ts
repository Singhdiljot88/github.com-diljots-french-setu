import "server-only";
import type { ProviderStatus } from "@/components/prefs";

const env = (k: string) => process.env[k]?.trim() || undefined;

export function aiProvider(): "anthropic" | "openai" | "demo" {
  const p = env("AI_PROVIDER");
  if (p === "demo") return "demo";
  if ((p === "anthropic" || !p) && env("ANTHROPIC_API_KEY")) return "anthropic";
  if ((p === "openai" || !p) && env("OPENAI_API_KEY")) return "openai";
  return "demo";
}

export function ttsProvider(): "openai" | "azure" | "device" {
  const p = env("TTS_PROVIDER");
  if (p === "device") return "device";
  if ((p === "azure" || !p) && env("AZURE_SPEECH_KEY") && env("AZURE_SPEECH_REGION")) return "azure";
  if ((p === "openai" || !p) && env("OPENAI_API_KEY") && p === "openai") return "openai";
  return "device";
}

export function sttProvider(): "openai" | "azure" | "browser" {
  const p = env("STT_PROVIDER");
  if (p === "browser") return "browser";
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

const NAMES = { anthropic: "Claude (Anthropic)", openai: "OpenAI", demo: "Demo mode", azure: "Azure AI Speech", device: "device voice", browser: "browser speech recognition", none: "not configured", brave: "Brave Search", tavily: "Tavily" } as const;

export function providerStatus(): ProviderStatus {
  const ai = aiProvider(), tts = ttsProvider(), stt = sttProvider(), pr = pronunciationProvider(), se = searchProvider();
  return {
    ai: { available: ai !== "demo", name: NAMES[ai] },
    tts: { server: tts !== "device", name: tts === "openai" ? "OpenAI TTS" : NAMES[tts] },
    stt: { server: stt !== "browser", name: stt === "openai" ? "OpenAI transcription" : NAMES[stt] },
    pronunciation: { available: pr !== "none", name: NAMES[pr] },
    search: { available: se !== "none", name: NAMES[se] },
  };
}
