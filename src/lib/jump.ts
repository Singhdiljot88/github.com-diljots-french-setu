export type JumpPage = { href: string; en: string; hi: string; icon: string };

export type DayQueryFields = { day: number; titleEn: string; titleHi?: string | null; titleFr?: string | null };

/** Pages whose English name, Hindi name or path contains the query. An empty query returns every page. */
export function filterPages(pages: JumpPage[], q: string): JumpPage[] {
  const s = q.trim().toLowerCase();
  if (!s) return pages;
  return pages.filter((p) => p.en.toLowerCase().includes(s) || p.hi.toLowerCase().includes(s) || p.href.toLowerCase().includes(s));
}

/** A day number typed on its own or after “day”, “jour” or “दिन”. Out of 1–120 is not a day. */
export function dayFromQuery(q: string): number | null {
  const m = q.trim().match(/^(?:day|jour|दिन)\s*(\d{1,3})$/i) ?? (/^\d{1,3}$/.test(q.trim()) ? [q.trim(), q.trim()] : null);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 120 ? n : null;
}

/** True when the query is only a day number, so a dictionary lookup would not help. */
export function isDayOnlyQuery(q: string): boolean {
  return /^(?:day|jour|दिन)\s*\d{1,3}$/i.test(q.trim()) || /^\d{1,3}$/.test(q.trim());
}

/**
 * Course-map filter. Digits match the day number (so “12” finds 12 and 120).
 * Anything else matches the English, Hindi or French title.
 */
export function matchesDayQuery(day: DayQueryFields, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  if (/^\d{1,3}$/.test(query)) return String(day.day).startsWith(query);
  const blob = `${day.titleEn} ${day.titleHi ?? ""} ${day.titleFr ?? ""}`.toLowerCase();
  return blob.includes(query);
}
