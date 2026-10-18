import { normalizeBasic, stripAccents } from "./text";

/**
 * Compares what a speech recognizer heard with the target phrase, word by word.
 * It measures recognition, not accent: a word counts as heard when the recognizer wrote it,
 * ignoring case, accents, punctuation and elision apostrophes.
 */
export type WordMatch = { word: string; heard: boolean };
export type PhraseMatch = { words: WordMatch[]; heard: number; total: number; exact: boolean };

/** Splits into words the way recognizers write them: hyphens and elisions separate words ("appelez-vous", "m'appelle"). */
const rawWords = (s: string) =>
  s.normalize("NFC").replace(/[’‘`]/g, "'").replace(/[.,!?;:…()"«»\-–—/]/g, " ").replace(/'/g, "' ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const key = (w: string) => stripAccents(normalizeBasic(w));

export function matchPhrase(target: string, transcript: string): PhraseMatch {
  const shown = rawWords(target);
  const t = shown.map(key);
  const h = rawWords(transcript).map(key);
  // Longest common subsequence keeps word order: "vous et" does not count for "et vous".
  const dp = Array.from({ length: t.length + 1 }, () => new Array<number>(h.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--) for (let j = h.length - 1; j >= 0; j--) dp[i][j] = t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const heardIdx = new Set<number>();
  for (let i = 0, j = 0; i < t.length && j < h.length;) {
    if (t[i] === h[j]) { heardIdx.add(i); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  const words = shown.map((w, i) => ({ word: w, heard: heardIdx.has(i) }));
  return { words, heard: heardIdx.size, total: t.length, exact: heardIdx.size === t.length && h.length === t.length };
}

export type Status = "all" | "most" | "some" | "none";
export function statusFor(heard: number, total: number): Status {
  if (!total) return "none";
  if (heard === total) return "all";
  if (heard / total >= 0.6) return "most";
  return heard > 0 ? "some" : "none";
}
export const STATUS_LABEL: Record<Status, { icon: string; en: string }> = {
  all: { icon: "✅", en: "Every word recognised" },
  most: { icon: "🟢", en: "Most words recognised" },
  some: { icon: "🟡", en: "Some words recognised" },
  none: { icon: "🔴", en: "Not recognised yet" },
};
