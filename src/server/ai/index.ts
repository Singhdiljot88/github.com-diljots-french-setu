import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gte, sql } from "drizzle-orm";
import { z, type ZodType } from "zod";
import { getDb } from "@/db";
import { aiCache, aiUsage } from "@/db/schema";
import { aiProvider } from "../providers/config";
import { HttpError } from "../http";

/**
 * One server-side entry point for every AI feature (writing feedback, speaking partner,
 * lesson generation from web pages). The provider is chosen by env; nothing here runs in
 * the browser and API keys never leave the server.
 */

export type AiFeature = "writing_feedback" | "speaking_turn" | "speaking_feedback" | "web_lesson";

export class AiUnavailable extends Error {}

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT_PER_USER || 60);
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60_000);

export function aiModel() {
  return process.env.AI_MODEL?.trim() || (aiProvider() === "openai" ? "gpt-4.1-mini" : "claude-opus-5-5");
}

/** Wrap text the learner or a web page supplied so the model treats it as data, not instructions. */
export function untrusted(tag: string, text: string) {
  return `<${tag}>\n${text.replaceAll(`</${tag}>`, `<\\/${tag}>`)}\n</${tag}>`;
}

/** Zod → JSON Schema accepted by structured outputs (objects closed, length/size keywords dropped; zod re-checks them). */
export function toOutputSchema(schema: ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }) as Record<string, unknown>;
  const DROP = new Set(["$schema", "minLength", "maxLength", "maxItems", "minimum", "maximum", "default", "format", "pattern"]);
  const walk = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(walk);
    if (!n || typeof n !== "object") return n;
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n)) {
      if (DROP.has(k)) continue;
      if (k === "minItems" && typeof v === "number" && v <= 1) { if (v === 1) o[k] = 1; continue; }
      o[k] = walk(v);
    }
    if (o.type === "object") {
      o.additionalProperties = false;
      // structured outputs requires every property to be listed in `required`; optional ones become nullable
      const props = (o.properties ?? {}) as Record<string, Record<string, unknown>>;
      const req = new Set((o.required as string[] | undefined) ?? []);
      for (const k of Object.keys(props)) if (!req.has(k)) props[k] = { anyOf: [props[k], { type: "null" }] };
      o.required = Object.keys(props);
    }
    return o;
  };
  return walk(raw) as Record<string, unknown>;
}

/** Nulls produced for optional fields → undefined, so zod optional() accepts them. */
function dropNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
  return v;
}

async function checkQuota(userId: string) {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 3600_000);
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(aiUsage).where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, since)));
  if ((r?.n ?? 0) >= DAILY_LIMIT) throw new HttpError(429, `You have used today's ${DAILY_LIMIT} AI requests. The limit resets over the next 24 hours; the rest of the course still works.`);
}

async function logUsage(userId: string, feature: AiFeature, provider: string, ok: boolean) {
  const db = await getDb();
  await db.insert(aiUsage).values({ userId, feature, provider, ok });
}

let anthropic: Anthropic | null = null;
function anthropicClient() {
  // timeout is in ms; the SDK retries 429/5xx/connection errors with backoff
  return (anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 2 }));
}

async function callAnthropic(o: { system: string; prompt: string; jsonSchema: Record<string, unknown>; maxTokens: number; effort: "low" | "medium" }) {
  try {
    const res = await anthropicClient().beta.messages.create({
      model: aiModel(),
      max_tokens: o.maxTokens,
      // server-side fallback: if the model declines, the API re-runs the request on Anthropic's recommended fallback model
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: o.effort, format: { type: "json_schema", schema: o.jsonSchema } },
      system: o.system,
      messages: [{ role: "user", content: o.prompt }],
    });
    if (res.stop_reason === "refusal") throw new AiUnavailable("The AI declined this request. Try rephrasing your text.");
    if (res.stop_reason === "max_tokens") throw new AiUnavailable("The AI response was cut off. Try a shorter text.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return JSON.parse(text) as unknown;
  } catch (e) {
    if (e instanceof AiUnavailable) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new AiUnavailable("The AI service is busy right now. Please try again in a minute.");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiUnavailable("The AI key on the server is invalid. Ask whoever runs this app to check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiUnavailable("The AI service took too long to answer. Please try again.");
    if (e instanceof Anthropic.APIError) throw new AiUnavailable(`The AI service returned an error (${e.status ?? "network"}).`);
    if (e instanceof SyntaxError) throw new AiUnavailable("The AI returned a malformed answer.");
    throw e;
  }
}

async function callOpenAI(o: { system: string; prompt: string; jsonSchema: Record<string, unknown>; maxTokens: number }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST", signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: aiModel(), max_completion_tokens: o.maxTokens,
          response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: o.jsonSchema } },
          messages: [{ role: "system", content: o.system }, { role: "user", content: o.prompt }],
        }),
      });
      if ((r.status === 429 || r.status >= 500) && attempt < 2) { await new Promise((s) => setTimeout(s, 1000 * 2 ** attempt)); continue; }
      if (!r.ok) throw new AiUnavailable(`The AI service returned an error (${r.status}).`);
      const j = await r.json() as { choices?: { message?: { content?: string; refusal?: string } }[] };
      const m = j.choices?.[0]?.message;
      if (m?.refusal) throw new AiUnavailable("The AI declined this request.");
      return JSON.parse(m?.content ?? "") as unknown;
    }
  } catch (e) {
    if (e instanceof AiUnavailable) throw e;
    if ((e as Error).name === "AbortError") throw new AiUnavailable("The AI service took too long to answer. Please try again.");
    if (e instanceof SyntaxError) throw new AiUnavailable("The AI returned a malformed answer.");
    throw new AiUnavailable("Could not reach the AI service.");
  } finally { clearTimeout(t); }
}

/**
 * Ask the configured model for JSON matching `schema`. Results are validated with zod, cached by
 * input hash when `cache` is set, counted against a per-user daily limit, and never invented:
 * if no provider is configured this throws AiUnavailable and callers show their labelled demo path.
 */
export async function generateJson<T>(feature: AiFeature, userId: string, o: { system: string; prompt: string; schema: ZodType<T>; maxTokens?: number; effort?: "low" | "medium"; cache?: boolean }): Promise<{ data: T; provider: string; model: string; cached: boolean }> {
  const provider = aiProvider();
  if (provider === "demo") throw new AiUnavailable("No AI provider is configured on the server.");
  const model = aiModel();
  // Keys are per user (prefix) so a learner's cached results can be deleted with their account.
  const key = `u:${userId}:` + createHash("sha256").update(JSON.stringify([feature, provider, model, o.system, o.prompt])).digest("hex");
  const db = await getDb();
  if (o.cache) {
    const [hit] = await db.select().from(aiCache).where(eq(aiCache.key, key));
    const parsed = hit && o.schema.safeParse(hit.value);
    if (parsed && parsed.success) return { data: parsed.data, provider, model, cached: true };
  }
  await checkQuota(userId);
  const jsonSchema = toOutputSchema(o.schema);
  const args = { system: o.system, prompt: o.prompt, jsonSchema, maxTokens: o.maxTokens ?? 8000, effort: o.effort ?? "low" };
  let ok = false;
  try {
    const raw = provider === "anthropic" ? await callAnthropic(args) : await callOpenAI(args);
    const parsed = o.schema.safeParse(dropNulls(raw));
    if (!parsed.success) throw new AiUnavailable("The AI answer did not match the expected format, so it was discarded.");
    ok = true;
    if (o.cache) await db.insert(aiCache).values({ key, value: parsed.data as object }).onConflictDoUpdate({ target: aiCache.key, set: { value: parsed.data as object, createdAt: new Date() } });
    return { data: parsed.data, provider, model, cached: false };
  } finally {
    await logUsage(userId, feature, provider, ok);
  }
}
