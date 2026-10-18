import { authed } from "@/server/http";
import { searchDictionary } from "@/server/content";

export const GET = authed(async ({ req }) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 100);
  const hits = await searchDictionary(q, 25);
  return { hits: hits.map((h) => ({ id: h.id, lemma: h.entry.lemma, pos: h.entry.pos, gender: h.entry.gender, en: h.entry.en, hi: h.entry.hi, pron: h.entry.pron, level: h.entry.level, match: h.match, note: h.note })) };
});
