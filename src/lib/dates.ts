/** Local-date helpers. Dates are 'YYYY-MM-DD' strings in the learner's IANA time zone. */

export function localDate(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Whole calendar days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Offset (ms) of a time zone from UTC at a given instant. */
function tzOffsetMs(timeZone: string, at: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant at which local date `d` ends (i.e. next local midnight). */
export function endOfLocalDay(d: string, timeZone: string): Date {
  const next = addDays(d, 1);
  const guess = new Date(`${next}T00:00:00Z`);
  const off = tzOffsetMs(timeZone, guess);
  const t = new Date(guess.getTime() - off);
  // Re-check across DST transitions.
  const off2 = tzOffsetMs(timeZone, t);
  return off2 === off ? t : new Date(guess.getTime() - off2);
}

export function startOfLocalDay(d: string, timeZone: string): Date {
  return endOfLocalDay(addDays(d, -1), timeZone);
}

export function formatLocalDate(d: string, locale = "en-GB"): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
