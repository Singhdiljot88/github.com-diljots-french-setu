/** Raised when the app has no usable database, with a message the person deploying can act on. */
export class DbSetupError extends Error {}

const CONNECT_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET", "28P01", "28000", "3D000"]);

/** Turns a Postgres connection failure into a DbSetupError; returns null for anything else. */
export function asDbSetupError(e: unknown): DbSetupError | null {
  if (e instanceof DbSetupError) return e;
  const err = e as { code?: string; message?: string; cause?: unknown } | null;
  const code = err?.code ?? (err?.cause as { code?: string } | undefined)?.code;
  const msg = String(err?.message ?? "");
  if (code === "28P01" || /password authentication failed/i.test(msg)) return new DbSetupError("The database rejected the password in DATABASE_URL. Copy the connection string from Supabase again and put your database password in it.");
  if (/tenant or user not found/i.test(msg)) return new DbSetupError("Supabase did not recognise the user in DATABASE_URL. Use the Transaction pooler string exactly as Supabase shows it (the user looks like postgres.yourprojectref).");
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") return new DbSetupError("The database address in DATABASE_URL cannot be reached from the host. With Supabase, use the Transaction pooler string (port 6543), not the direct connection (port 5432).");
  if ((code && CONNECT_CODES.has(code)) || /self[- ]signed certificate|SSL|getaddrinfo|connect ETIMEDOUT|connection timeout|timeout expired/i.test(msg)) return new DbSetupError("The app could not connect to the database in DATABASE_URL. Check the address and port (6543 for the Supabase pooler) and set DATABASE_SSL to require.");
  return null;
}
