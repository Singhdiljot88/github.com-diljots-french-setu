import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthError, requireUser, type CurrentUser } from "./auth";
import { DbSetupError } from "@/db/errors";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite cookies). */
function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers / server-side tests
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Cross-site request blocked");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Bad origin");
  }
}

type Handler<P> = (ctx: { req: Request; user: CurrentUser; params: P }) => Promise<unknown>;

export function authed<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      checkOrigin(req);
      const user = await requireUser();
      const result = await handler({ req, user, params: ctx?.params ? await ctx.params : ({} as P) });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function publicRoute<P = Record<string, string>>(handler: (ctx: { req: Request; params: P }) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      checkOrigin(req);
      const result = await handler({ req, params: ctx?.params ? await ctx.params : ({} as P) });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues.slice(0, 5) }, { status: 400 });
  if (e instanceof DbSetupError) {
    console.error("[db]", e.message);
    return NextResponse.json({ error: `Setup problem: ${e.message}` }, { status: 503 });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new HttpError(400, "Expected a JSON body"); }
  return schema.parse(raw);
}
