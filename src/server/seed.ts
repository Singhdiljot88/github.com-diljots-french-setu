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
    for (const { day, hash } of days) {
      await db.insert(lessons).values({ curriculumVersion: CURRICULUM_VERSION, day: day.day, title: day.title.en, content: day, contentHash: hash })
        .onConflictDoUpdate({ target: [lessons.curriculumVersion, lessons.day], set: { title: day.title.en, content: day, contentHash: hash, updatedAt: new Date() }, where: sql`${lessons.contentHash} <> excluded.content_hash` });
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
