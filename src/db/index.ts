import "server-only";
import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

type Holder = { db?: Promise<DB>; close?: () => Promise<void> };
const g = globalThis as unknown as { __frenchSetuDb?: Holder };
const holder: Holder = (g.__frenchSetuDb ??= {});

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  let db: DB;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5), ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined });
    db = drizzle(pool, { schema }) as unknown as DB;
    holder.close = () => pool.end();
    if (process.env.AUTO_MIGRATE !== "false") await migrate(db as never, { migrationsFolder });
  } else {
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
  if (!holder.db) holder.db = connect().catch((e) => { holder.db = undefined; throw e; });
  return holder.db;
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.close = undefined;
}

export { schema };
