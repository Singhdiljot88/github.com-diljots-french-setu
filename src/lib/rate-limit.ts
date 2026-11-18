type Bucket = { reset: number; n: number };
const buckets = new Map<string, Bucket>();

/**
 * In-memory limiter. On a hosted deploy each server instance has its own map, so this
 * slows a burst against one instance; it is not a global lock.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now >= b.reset) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    buckets.set(key, { reset: now + windowMs, n: 1 });
    return { ok: true, retryAfter: 0 };
  }
  if (b.n >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  b.n += 1;
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/** First forwarded address, used only as a rate-limit key. It is not stored. */
export function clientIp(req: Request): string {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  return raw && raw.length <= 80 ? raw : "local";
}
