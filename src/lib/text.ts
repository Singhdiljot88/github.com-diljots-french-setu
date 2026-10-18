/** Text normalisation and answer comparison for French. */

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/Œ/g, "OE");
}

export function normalizeBasic(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/[’‘`]/g, "'").replace(/[«»"“”]/g, "").replace(/ | /g, " ").replace(/\s+/g, " ").trim();
}

/** For search: lowercase, no accents, no punctuation */
export function searchKey(s: string): string {
  return stripAccents(normalizeBasic(s)).replace(/[^a-z0-9'\- ऀ-ॿ]/g, "").replace(/\s+/g, " ").trim();
}

const stripPunct = (s: string) => s.replace(/[.,!?;:…]/g, "").replace(/\s+/g, " ").trim();

export type AnswerCheck = { result: "correct" | "accent" | "wrong"; expected: string };

/** Compare a typed French answer to accepted answers. Accent-only differences are flagged, not failed. */
export function checkAnswer(input: string, answer: string, accept: string[] = []): AnswerCheck {
  const cands = [answer, ...accept];
  const a = stripPunct(normalizeBasic(input));
  if (!a) return { result: "wrong", expected: answer };
  for (const c of cands) if (stripPunct(normalizeBasic(c)) === a) return { result: "correct", expected: answer };
  for (const c of cands) if (stripAccents(stripPunct(normalizeBasic(c))) === stripAccents(a)) return { result: "accent", expected: answer };
  return { result: "wrong", expected: answer };
}

export function wordCount(s: string): number {
  // French elisions (l'homme, j'ai) count as one word each, as most exam counters do with spaces.
  return s.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Word-level diff used to highlight corrections (LCS). */
export function diffWords(a: string, b: string): { type: "same" | "del" | "add"; text: string }[] {
  const x = a.split(/(\s+)/).filter((t) => t !== "");
  const y = b.split(/(\s+)/).filter((t) => t !== "");
  const n = x.length, m = y.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { type: "same" | "del" | "add"; text: string }[] = [];
  let i = 0, j = 0;
  const push = (type: "same" | "del" | "add", text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text; else out.push({ type, text });
  };
  while (i < n && j < m) {
    if (x[i] === y[j]) { push("same", x[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push("del", x[i]); i++; }
    else { push("add", y[j]); j++; }
  }
  while (i < n) push("del", x[i++]);
  while (j < m) push("add", y[j++]);
  return out;
}
