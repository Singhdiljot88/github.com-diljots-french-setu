import "server-only";
import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { DbSetupError, asDbSetupError } from "./errors";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

type Holder = { db?: Promise<DB>; close?: () => Promise<void> };
const g = globalThis as unknown as { __frenchSetuDb?: Holder };
const holder: Holder = (g.__frenchSetuDb ??= {});

const migrationsFolder = path.join(process.cwd(), "drizzle");

/**
 * DATABASE_URL first. Vercel's Supabase integration sets POSTGRES_URL (the pooler) instead, so that
 * works too, with SSL on. When SSL is on, sslmode is dropped from the URL because pg would otherwise
 * insist on verifying Supabase's certificate chain and fail.
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): { url?: string; ssl: boolean } {
  const raw = env.DATABASE_URL || env.POSTGRES_URL || env.SUPABASE_DB_URL;
  if (!raw) return { ssl: false };
  const ssl = env.DATABASE_SSL === "require" || (!env.DATABASE_URL && env.DATABASE_SSL !== "disable") || /supabase\.(co|com)/.test(raw);
  if (!ssl) return { url: raw, ssl };
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return { url: u.toString(), ssl };
  } catch {
    return { url: raw, ssl };
  }
}

async function connect(): Promise<DB> {
  const { url, ssl } = databaseUrl();
  let db: DB;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5), connectionTimeoutMillis: 15_000, ssl: ssl ? { rejectUnauthorized: false } : undefined });
    db = drizzle(pool, { schema }) as unknown as DB;
    holder.close = () => pool.end();
    if (process.env.AUTO_MIGRATE !== "false") await migrate(db as never, { migrationsFolder });
  } else {
    // Hosted serverless platforms have no lasting disk, so the embedded database cannot work there.
    if (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw new DbSetupError("No database is set up. Add DATABASE_URL (your Supabase Transaction pooler connection string) and DATABASE_SSL=require to the Production environment in the hosting settings, then redeploy. POSTGRES_URL from the Vercel Supabase integration also works.");
    }
    // Embedded Postgres (PGlite) for local use, demo mode and tests — no server needed.
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    if (dir !== "memory://") fs.mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir === "memory://" ? undefined : dir);
    db = drizzle(client, { schema }) as unknown as DB;
    holder.close = () => client.close();
    await migrate(db as never, { migrationsFolder });
  }
  const { seedContent } = await import("@/server/seed");
  await seedContent(db);
  return db;
}

export function getDb(): Promise<DB> {
  if (!holder.db) holder.db = connect().catch((e) => { holder.db = undefined; throw asDbSetupError(e) ?? e; });
  return holder.db;
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.close = undefined;
}

export { schema };
