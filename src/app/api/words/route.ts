import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { savedWords } from "@/db/schema";
import { authed, body } from "@/server/http";
import { saveWord } from "@/server/words";

export const GET = authed(async ({ user }) => {
  const db = await getDb();
  const words = await db.select().from(savedWords).where(eq(savedWords.userId, user.id)).orderBy(desc(savedWords.createdAt));
  return { words };
});

export const POST = authed(async ({ req, user }) => {
  const w = await body(req, z.object({
    fr: z.string().min(1).max(200), en: z.string().min(1).max(300), hi: z.string().max(300).optional(), gender: z.string().max(3).nullable().optional(),
    isPhrase: z.boolean().optional(), entryId: z.string().max(200).nullable().optional(), lemma: z.string().max(200).optional(),
    source: z.enum(["dictionary", "lesson", "web", "custom"]), sourceRef: z.string().max(300).nullable().optional(), personalExample: z.string().max(500).nullable().optional(),
    kinds: z.array(z.enum(["fr_to_meaning", "meaning_to_fr", "audio", "gender", "dictation", "cloze"])).optional(),
  }));
  return saveWord(user.id, w);
});
