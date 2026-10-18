import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, sessions, users } from "@/db/schema";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
export const SESSION_COOKIE = "fs_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = await scrypt(pw, Buffer.from(s, "base64"), 64, SCRYPT);
  const expected = Buffer.from(k, "base64");
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

const tokenHash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: tokenHash(token), userId, expiresAt });
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, tokenHash(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; email: string; isGuest: boolean };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select({ id: users.id, email: users.email, isGuest: users.isGuest }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, tokenHash(token)), gt(sessions.expiresAt, new Date())));
  return rows[0] ?? null;
}

export class AuthError extends Error { status = 401; }

/** Every data access in route handlers goes through this, so records are always scoped to the signed-in learner. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError("Not signed in");
  return u;
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function signUp(email: string, password: string, isGuest = false) {
  const db = await getDb();
  const e = email.trim().toLowerCase();
  if (!validateEmail(e)) return { error: "Please enter a valid email address." } as const;
  if (password.length < 8) return { error: "Use at least 8 characters for your password." } as const;
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, e));
  if (exists.length) return { error: "An account with this email already exists. Try signing in." } as const;
  const [u] = await db.insert(users).values({ email: e, passwordHash: await hashPassword(password), isGuest }).returning({ id: users.id });
  await createSession(u.id);
  return { userId: u.id } as const;
}

export async function signIn(email: string, password: string) {
  const db = await getDb();
  const e = email.trim().toLowerCase();
  const [u] = await db.select().from(users).where(eq(users.email, e));
  if (!u || !(await verifyPassword(password, u.passwordHash))) return { error: "Email or password is incorrect." } as const;
  await createSession(u.id);
  return { userId: u.id } as const;
}

export async function getProfile(userId: string) {
  const db = await getDb();
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return p ?? null;
}
