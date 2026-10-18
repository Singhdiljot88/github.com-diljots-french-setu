"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) { super(message); }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? (res.status === 504 ? "The server took too long to answer (the very first start loads the whole course). Try again in a minute." : `Request failed (${res.status})`), data);
  return data as T;
}
