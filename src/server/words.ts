import "server-only";
import { and, asc, eq, gt, lte, sql, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { reviewCards, reviewLogs, savedWords, type CardKind } from "@/db/schema";
import { schedule, type Rating } from "@/lib/srs";
import { endOfLocalDay, localDate, startOfLocalDay } from "@/lib/dates";
import { NEW_CARD_LIMIT, REVIEW_LIMIT, type DailyMinutes } from "@/lib/schedule";
import { HttpError } from "./http";

export type SaveWord = { fr: string; en: string; hi?: string; gender?: string | null; isPhrase?: boolean; entryId?: string | null; source: "dictionary" | "lesson" | "web" | "custom" | "mistake"; sourceRef?: string | null; personalExample?: string | null; kinds?: CardKind[] };

export function defaultKinds(w: { isPhrase?: boolean; gender?: string | null; source: string }): CardKind[] {
  if (w.isPhrase) return ["fr_to_meaning", "dictation"];
  const kinds: CardKind[] = ["fr_to_meaning", "meaning_to_fr"];
  if (w.source === "dictionary") {
    kinds.push("audio");
    if (w.gender === "m" || w.gender === "f") kinds.push("gender");
  }
  return kinds;
}

/** Saves a word or phrase for the learner and creates its review cards. Idempotent per (user, fr). */
export async function saveWord(userId: string, w: SaveWord) {
  const db = await getDb();
  const fr = w.fr.trim().replace(/\s+/g, " ");
  if (!fr || fr.length > 200) throw new HttpError(400, "Invalid word");
  const inserted = await db.insert(savedWords).values({
    userId, fr, en: w.en.trim().slice(0, 300), hi: (w.hi ?? "").trim().slice(0, 300), gender: w.gender ?? null, isPhrase: !!w.isPhrase,
    entryId: w.entryId ?? null, source: w.source, sourceRef: w.sourceRef ?? null, personalExample: w.personalExample ?? null,
  }).onConflictDoNothing().returning({ id: savedWords.id });
  if (inserted.length === 0) {
    const [existing] = await db.select({ id: savedWords.id }).from(savedWords).where(and(eq(savedWords.userId, userId), eq(savedWords.fr, fr)));
    if (w.kinds?.length) await addCards(userId, existing.id, w.kinds);
    return { id: existing.id, created: false };
  }
  await addCards(userId, inserted[0].id, w.kinds ?? defaultKinds(w));
  return { id: inserted[0].id, created: true };
}

export async function addCards(userId: string, savedWordId: string, kinds: CardKind[]) {
  const db = await getDb();
  if (!kinds.length) return;
  await db.insert(reviewCards).values(kinds.map((kind) => ({ userId, savedWordId, kind }))).onConflictDoNothing();
}

type QueueOpts = { timezone: string; dailyMinutes: DailyMinutes; now?: Date };

/** Today's review queue: due cards (capped) plus new cards (capped), one card per word per session. */
export async function reviewQueue(userId: string, o: QueueOpts) {
  const db = await getDb();
  const now = o.now ?? new Date();
  const today = localDate(o.timezone, now);
  const dayEnd = endOfLocalDay(today, o.timezone);
  const dayStart = startOfLocalDay(today, o.timezone);
  const [{ newToday }] = await db.select({ newToday: sql<number>`count(*)::int` }).from(reviewCards)
    .where(and(eq(reviewCards.userId, userId), isNotNull(reviewCards.firstReviewedAt), gt(reviewCards.firstReviewedAt, dayStart)));
  const newLimit = Math.max(0, NEW_CARD_LIMIT[o.dailyMinutes] - Number(newToday));
  const reviewLimit = REVIEW_LIMIT[o.dailyMinutes];

  const due = await db.select({ card: reviewCards, word: savedWords }).from(reviewCards).innerJoin(savedWords, eq(savedWords.id, reviewCards.savedWordId))
    .where(and(eq(reviewCards.userId, userId), sql`${reviewCards.state} <> 'new'`, lte(reviewCards.dueAt, dayEnd))).orderBy(asc(reviewCards.dueAt));
  const fresh = newLimit > 0 ? await db.select({ card: reviewCards, word: savedWords }).from(reviewCards).innerJoin(savedWords, eq(savedWords.id, reviewCards.savedWordId))
    .where(and(eq(reviewCards.userId, userId), eq(reviewCards.state, "new"))).orderBy(asc(reviewCards.firstAddedAt), asc(reviewCards.kind)).limit(newLimit * 3) : [];

  // Learning cards due later today are included; the client shows each one when its time comes.
  const dueNow = due;
  const seenWords = new Set<string>();
  const out: typeof due = [];
  for (const d of dueNow) { if (out.length >= reviewLimit) break; out.push(d); seenWords.add(d.word.id); }
  let added = 0;
  for (const d of fresh) {
    if (added >= newLimit) break;
    if (seenWords.has(d.word.id)) continue; // bury siblings: one new card per word per day
    out.push(d); seenWords.add(d.word.id); added++;
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(reviewCards).where(and(eq(reviewCards.userId, userId), sql`${reviewCards.state} <> 'new'`, lte(reviewCards.dueAt, dayEnd)));
  const [{ newWaiting }] = await db.select({ newWaiting: sql<number>`count(*)::int` }).from(reviewCards).where(and(eq(reviewCards.userId, userId), eq(reviewCards.state, "new")));
  return {
    cards: out.map(({ card, word }) => ({ card, word })),
    dueTotal: Number(total),
    overdueCapped: Number(total) > reviewLimit,
    newWaiting: Number(newWaiting),
    newLimitRemaining: newLimit,
  };
}

export async function rateCard(userId: string, cardId: string, rating: Rating, answer: string | undefined, now = new Date()) {
  const db = await getDb();
  const [card] = await db.select().from(reviewCards).where(and(eq(reviewCards.id, cardId), eq(reviewCards.userId, userId)));
  if (!card) throw new HttpError(404, "Card not found");
  const next = schedule(card, rating, now);
  await db.update(reviewCards).set({
    state: next.state, ease: next.ease, intervalDays: next.intervalDays, step: next.step, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt,
    lastReviewedAt: now, firstReviewedAt: card.firstReviewedAt ?? now,
  }).where(eq(reviewCards.id, card.id));
  await db.insert(reviewLogs).values({
    userId, cardId: card.id, rating, answer: answer?.slice(0, 300) ?? null, prevState: card.state, prevDueAt: card.dueAt, prevIntervalDays: card.intervalDays,
    nextDueAt: next.dueAt, nextIntervalDays: next.intervalDays, reviewedAt: now,
  });
  return next;
}

export async function wordHistory(userId: string, wordId: string) {
  const db = await getDb();
  const [word] = await db.select().from(savedWords).where(and(eq(savedWords.id, wordId), eq(savedWords.userId, userId)));
  if (!word) throw new HttpError(404, "Word not found");
  const cards = await db.select().from(reviewCards).where(and(eq(reviewCards.savedWordId, wordId), eq(reviewCards.userId, userId)));
  const logs = cards.length ? await db.select().from(reviewLogs).where(and(eq(reviewLogs.userId, userId), inArray(reviewLogs.cardId, cards.map((c) => c.id)))).orderBy(asc(reviewLogs.reviewedAt)) : [];
  return { word, cards, logs };
}

/** "Retained" = review-state cards with an interval of at least 7 days. */
export async function vocabularyStats(userId: string) {
  const db = await getDb();
  const [r] = await db.select({
    words: sql<number>`count(distinct ${savedWords.id})::int`,
    retained: sql<number>`count(distinct case when ${reviewCards.state} = 'review' and ${reviewCards.intervalDays} >= 7 then ${savedWords.id} end)::int`,
    learning: sql<number>`count(distinct case when ${reviewCards.state} in ('learning','relearning') or (${reviewCards.state} = 'review' and ${reviewCards.intervalDays} < 7) then ${savedWords.id} end)::int`,
  }).from(savedWords).leftJoin(reviewCards, eq(reviewCards.savedWordId, savedWords.id)).where(eq(savedWords.userId, userId));
  return { words: Number(r.words), retained: Number(r.retained), learning: Number(r.learning) };
}
