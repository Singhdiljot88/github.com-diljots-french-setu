import { authed, HttpError } from "@/server/http";
import { getProfile } from "@/server/auth";
import { reviewQueue } from "@/server/words";
import { dictIndex } from "@/server/content";
import { previewIntervals } from "@/lib/srs";
import { searchKey } from "@/lib/text";
import type { DailyMinutes } from "@/lib/schedule";

type Example = { fr: string; en?: string; hi?: string; cloze?: string; answer?: string };

export const GET = authed(async ({ user }) => {
  const p = await getProfile(user.id);
  if (!p) throw new HttpError(400, "Finish onboarding first");
  const q = await reviewQueue(user.id, { timezone: p.timezone, dailyMinutes: p.dailyMinutes as DailyMinutes });
  const idx = await dictIndex();
  const byId = new Map(idx.entries.map((e, i) => [e.id, i]));
  const now = new Date();

  // Example sentence with the word blanked out, for cloze cards: the learner's own example first, then the dictionary's.
  const exampleFor = (w: (typeof q.cards)[number]["word"]): Example | null => {
    const i = w.entryId ? byId.get(w.entryId) : idx.byKey.get(searchKey(w.fr))?.find((h) => h.kind === "lemma")?.idx;
    const entry = i !== undefined ? idx.entries[i].entry : null;
    const candidates: Example[] = [...(w.personalExample ? [{ fr: w.personalExample }] : []), ...(entry?.examples ?? [])];
    for (const ex of candidates) {
      for (const m of ex.fr.matchAll(/[\p{L}'’-]+/gu)) {
        const tok = m[0].replace(/^(l|d|j|m|t|s|n|qu|c)['’]/i, "");
        const k = searchKey(tok);
        const isWord = k === searchKey(w.fr) || (i !== undefined && idx.byKey.get(k)?.some((h) => h.idx === i));
        if (isWord) {
          const start = (m.index ?? 0) + (m[0].length - tok.length);
          return { ...ex, cloze: ex.fr.slice(0, start) + "____" + ex.fr.slice(start + tok.length), answer: tok };
        }
      }
    }
    return candidates[0] ?? null;
  };

  return {
    ...q,
    cards: q.cards.map(({ card, word }) => ({
      card: { id: card.id, kind: card.kind, state: card.state, dueAt: card.dueAt, intervalDays: card.intervalDays },
      word: { id: word.id, fr: word.fr, en: word.en, hi: word.hi, gender: word.gender, isPhrase: word.isPhrase },
      example: card.kind === "cloze" || card.kind === "fr_to_meaning" ? exampleFor(word) : null,
      preview: previewIntervals(card, now),
    })),
  };
});
