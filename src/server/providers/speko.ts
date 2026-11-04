import "server-only";
import { Speko } from "@spekoai/sdk";

/** One Speko client for AI (LLM), speech-to-text and text-to-speech. Only used when SPEKO_API_KEY is set. */
let client: Speko | null = null;
export function speko(): Speko {
  return (client ??= new Speko({
    apiKey: process.env.SPEKO_API_KEY!.trim(),
    ...(process.env.SPEKO_BASE_URL?.trim() && { baseUrl: process.env.SPEKO_BASE_URL.trim() }),
  }));
}

/** LLM used through Speko. Pinned so answers stay consistent; AI_MODEL overrides it (a Speko "vendor:model" id). */
export const spekoLlm = () => process.env.AI_MODEL?.trim() || "anthropic:claude-sonnet-5";
