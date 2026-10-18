import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { dictEntries, lessons } from "@/db/schema";
import type { Day } from "@/content/schema";
import type { DictEntry } from "@/content/dictionary-schema";
import { CURRICULUM_VERSION, loadMocksFromDisk } from "@/content/load";
import { OUTLINE } from "@/content/outline";
import { buildIndex, search, type DictIndex } from "@/lib/dict-search";
import type { Mock } from "@/content/mock-schema";

type Cache = { lessons?: Map<number, { day: Day; reviewStatus: string; hash: string }>; dict?: DictIndex; mocks?: Mock[] };
const g = globalThis as unknown as { __fsContent?: Cache };
const cache: Cache = (g.__fsContent ??= {});

export async function allLessons() {
  if (!cache.lessons) {
    const db = await getDb();
    const rows = await db.select().from(lessons).where(eq(lessons.curriculumVersion, CURRICULUM_VERSION)).orderBy(asc(lessons.day));
    cache.lessons = new Map(rows.map((r) => [r.day, { day: r.content as Day, reviewStatus: r.reviewStatus, hash: r.contentHash }]));
  }
  return cache.lessons;
}

export async function getLesson(day: number) {
  return (await allLessons()).get(day) ?? null;
}

/** Course map: every day from the outline, flagged when its full lesson is available. */
export async function courseMap() {
  const ls = await allLessons();
  return OUTLINE.map((o) => ({ ...o, available: ls.has(o.day), titleHi: ls.get(o.day)?.day.title.hi, titleFr: ls.get(o.day)?.day.title.fr }));
}

export async function dictIndex(): Promise<DictIndex> {
  if (!cache.dict) {
    const db = await getDb();
    const rows = await db.select().from(dictEntries);
    cache.dict = buildIndex(rows.map((r) => ({ id: r.id, entry: r.data as DictEntry, source: r.source })));
  }
  return cache.dict;
}

export async function searchDictionary(q: string, limit = 20) {
  return search(await dictIndex(), q, limit);
}

export async function getEntry(id: string) {
  const idx = await dictIndex();
  return idx.entries.find((e) => e.id === id) ?? null;
}

export async function lessonReviewStatus(day: number) {
  const db = await getDb();
  const [r] = await db.select({ s: lessons.reviewStatus }).from(lessons).where(and(eq(lessons.curriculumVersion, CURRICULUM_VERSION), eq(lessons.day, day)));
  return r?.s ?? null;
}

export function getMocks(): Mock[] {
  if (!cache.mocks) cache.mocks = loadMocksFromDisk();
  return cache.mocks;
}
export const getMock = (id: string) => getMocks().find((m) => m.id === id) ?? null;

export function invalidateContentCache() {
  cache.lessons = undefined; cache.dict = undefined; cache.mocks = undefined;
}
