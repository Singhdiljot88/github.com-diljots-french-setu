/**
 * Runs database migrations and loads course content, then exits.
 * Usage: DATABASE_URL=postgres://… npm run db:migrate
 * (the app also does this at startup unless AUTO_MIGRATE=false)
 */
import { closeDb, getDb } from "../src/db";

async function main() {
  console.log(process.env.DATABASE_URL ? "Migrating Postgres from DATABASE_URL…" : `Migrating embedded database at ${process.env.PGLITE_DIR ?? ".data/pglite"}…`);
  await getDb();
  await closeDb();
  console.log("Done: schema is up to date and content is loaded.");
}
main().catch((e) => { console.error(e); process.exit(1); });
