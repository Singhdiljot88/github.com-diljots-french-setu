import { eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { contentVersions, dictEntries, lessons } from "@/db/schema";
import { CURRICULUM_VERSION, DICTIONARY_SOURCE, DICTIONARY_VERSION, loadDaysFromDisk, loadDictionaryFromDisk, sha } from "@/content/load";

/**
 * Seeds versioned curriculum and dictionary content. Idempotent: content is only
 * rewritten when its hash changes, and every change is logged in content_versions.
 */
export async function seedContent(db: DB) {
  const days = loadDaysFromDisk();
  const curriculumHash = sha(days.map((d) => d.hash).join(""));
  const cvId = `curriculum-${CURRICULUM_VERSION}@${curriculumHash.slice(0, 12)}`;
  const existing = await db.select().from(contentVersions).where(eq(contentVersions.id, cvId));
  if (existing.length === 0 && days.length > 0) {
    // Only changed lessons are written, a few per statement: one round trip per lesson was too slow
    // for a serverless cold start against a remote database.
    const stored = new Map((await db.select({ day: lessons.day, hash: lessons.contentHash }).from(lessons).where(eq(lessons.curriculumVersion, CURRICULUM_VERSION))).map((r) => [r.day, r.hash]));
    const changed = days.filter(({ day, hash }) => stored.get(day.day) !== hash);
    for (let i = 0; i < changed.length; i += 10) {
      const rows = changed.slice(i, i + 10).map(({ day, hash }) => ({ curriculumVersion: CURRICULUM_VERSION, day: day.day, title: day.title.en, content: day, contentHash: hash }));
      await db.insert(lessons).values(rows)
        .onConflictDoUpdate({ target: [lessons.curriculumVersion, lessons.day], set: { title: sql`excluded.title`, content: sql`excluded.content`, contentHash: sql`excluded.content_hash`, updatedAt: new Date() } });
    }
    await db.insert(contentVersions).values({ id: cvId, kind: "curriculum", hash: curriculumHash, notes: `${days.length} lessons` }).onConflictDoNothing();
  }

  const dict = loadDictionaryFromDisk();
  const dvId = `dictionary-${DICTIONARY_VERSION}@${dict.hash.slice(0, 12)}`;
  const dExisting = await db.select().from(contentVersions).where(eq(contentVersions.id, dvId));
  if (dExisting.length === 0 && dict.entries.length > 0) {
    const chunk = 200;
    for (let i = 0; i < dict.entries.length; i += chunk) {
      const rows = dict.entries.slice(i, i + chunk).map(({ id, entry }) => ({ id, version: DICTIONARY_VERSION, lemma: entry.lemma, pos: entry.pos, data: entry, source: DICTIONARY_SOURCE }));
      await db.insert(dictEntries).values(rows).onConflictDoUpdate({ target: dictEntries.id, set: { data: sql`excluded.data`, version: sql`excluded.version`, source: sql`excluded.source` } });
    }
    await db.insert(contentVersions).values({ id: dvId, kind: "dictionary", hash: dict.hash, notes: `${dict.entries.length} entries` }).onConflictDoNothing();
  }
}
