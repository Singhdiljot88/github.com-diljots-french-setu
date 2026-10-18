import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts } from "@/db/schema";
import { statusFor, type Status } from "@/lib/speech-match";

type R = { fr: string; en: string; hi: string; pron: string | null; transcript: string; via: string; heard: number; total: number; missed: string[] };
export type PhraseRow = {
  fr: string; en: string; hi: string; pron: string | null; day: number | null; tries: number;
  first: { transcript: string; heard: number; at: Date }; best: { transcript: string; heard: number; at: Date; count: number }; total: number; status: Status;
  improved: boolean; stillMissed: string[];
};

/** Builds the "best attempts" report from saved Say-it attempts. Only counts what the recognizer wrote. */
export async function sayReport(userId: string, since?: Date) {
  const db = await getDb();
  const rows = await db.select().from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.kind, "say_phrase"), since ? gte(attempts.createdAt, since) : undefined))
    .orderBy(asc(attempts.createdAt)).limit(5000);
  const by = new Map<string, { day: number | null; list: { r: R; at: Date }[] }>();
  for (const a of rows) {
    const r = a.response as R | null;
    if (!r?.fr) continue;
    const g = by.get(r.fr) ?? { day: a.day, list: [] };
    g.list.push({ r, at: a.createdAt });
    by.set(r.fr, g);
  }
  const phrases: PhraseRow[] = [];
  for (const [fr, g] of by) {
    const first = g.list[0];
    // Best = most words recognised; among equals, the latest one.
    let best = first;
    for (const x of g.list) if (x.r.heard >= best.r.heard) best = x;
    const total = best.r.total;
    const bestCount = g.list.filter((x) => x.r.heard === best.r.heard && x.r.heard === total).length;
    const missedEvery = (best.r.missed ?? []).filter((w) => g.list.every((x) => (x.r.missed ?? []).includes(w)));
    phrases.push({
      fr, en: best.r.en, hi: best.r.hi, pron: best.r.pron, day: g.day, tries: g.list.length,
      first: { transcript: first.r.transcript, heard: first.r.heard, at: first.at },
      best: { transcript: best.r.transcript, heard: best.r.heard, at: best.at, count: bestCount },
      total, status: statusFor(best.r.heard, total), improved: best.r.heard > first.r.heard, stillMissed: missedEvery,
    });
  }
  phrases.sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || a.fr.localeCompare(b.fr));
  const vias = new Set(rows.map((a) => (a.response as R | null)?.via).filter(Boolean));
  return {
    phrases, attempts: rows.length,
    from: rows[0]?.createdAt ?? null, to: rows.at(-1)?.createdAt ?? null,
    usedBrowser: vias.has("speech_browser"), usedKeyboard: vias.has("typed_keyboard"),
  };
}
