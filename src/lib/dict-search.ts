import type { DictEntry } from "@/content/dictionary-schema";
import { conjugate, TENSE_LABELS, type Tense } from "./conjugate";
import { levenshtein, searchKey } from "./text";

export type IndexedEntry = { id: string; entry: DictEntry; source: string };
export type MatchKind = "lemma" | "form" | "plural_feminine" | "misspelling" | "prefix" | "english" | "hindi" | "phrase" | "fuzzy";
export type SearchHit = { id: string; entry: DictEntry; source: string; score: number; match: MatchKind; note?: string };

export type DictIndex = {
  entries: IndexedEntry[];
  byKey: Map<string, { idx: number; kind: MatchKind; note?: string }[]>;
  lemmaKeys: string[];
};

const DEVANAGARI = /[ऀ-ॿ]/;

function add(map: DictIndex["byKey"], key: string, v: { idx: number; kind: MatchKind; note?: string }) {
  if (!key) return;
  const arr = map.get(key);
  if (arr) { if (!arr.some((x) => x.idx === v.idx && x.kind === v.kind)) arr.push(v); } else map.set(key, [v]);
}

export function buildIndex(entries: IndexedEntry[]): DictIndex {
  const byKey: DictIndex["byKey"] = new Map();
  entries.forEach(({ entry: e }, idx) => {
    add(byKey, searchKey(e.lemma), { idx, kind: "lemma" });
    if (e.plural) add(byKey, searchKey(e.plural), { idx, kind: "plural_feminine", note: `plural of ${e.lemma}` });
    if (e.feminine) add(byKey, searchKey(e.feminine), { idx, kind: "plural_feminine", note: `feminine of ${e.lemma}` });
    for (const m of e.misspellings) add(byKey, searchKey(m), { idx, kind: "misspelling", note: `common misspelling of ${e.lemma}` });
    if (e.verb) {
      const table = conjugate(e.lemma, e.verb);
      if (table) {
        for (const [tense, rows] of Object.entries(table)) {
          for (const r of rows) {
            const words = r.form.replace(/\(e\)|\(s\)/g, "").split(/[\s']/).filter(Boolean);
            const verbWord = words[words.length - 1];
            if (!verbWord) continue;
            const k = searchKey(verbWord.replace(/-.*$/, ""));
            if (k && k !== searchKey(e.lemma)) add(byKey, k, { idx, kind: "form", note: `${verbWord}: ${TENSE_LABELS[tense as Tense].fr.toLowerCase()} of ${e.lemma}` });
          }
        }
      }
    }
  });
  return { entries, byKey, lemmaKeys: entries.map((x) => searchKey(x.entry.lemma)) };
}

const KIND_SCORE: Record<MatchKind, number> = { lemma: 100, form: 90, plural_feminine: 85, misspelling: 80, english: 70, hindi: 70, prefix: 60, phrase: 45, fuzzy: 40 };

export function search(index: DictIndex, query: string, limit = 20): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const hits = new Map<number, SearchHit>();
  const put = (idx: number, kind: MatchKind, bonus = 0, note?: string) => {
    const score = KIND_SCORE[kind] + bonus;
    const prev = hits.get(idx);
    if (!prev || prev.score < score) {
      const { id, entry, source } = index.entries[idx];
      hits.set(idx, { id, entry, source, score, match: kind, note });
    }
  };

  if (DEVANAGARI.test(q)) {
    const nq = q.normalize("NFC");
    index.entries.forEach(({ entry }, idx) => {
      for (const h of entry.hi) {
        const nh = h.normalize("NFC");
        if (nh === nq) put(idx, "hindi", 10);
        else if (nh.split(/[\s,/()।]+/).includes(nq)) put(idx, "hindi", 5);
        else if (nh.includes(nq)) put(idx, "hindi", 0);
      }
    });
    return rank(hits, limit);
  }

  const key = searchKey(q);
  const exactAccents = q.normalize("NFC").toLowerCase();
  for (const m of index.byKey.get(key) ?? []) {
    const bonus = m.kind === "lemma" && index.entries[m.idx].entry.lemma.toLowerCase() === exactAccents ? 5 : 0;
    put(m.idx, m.kind, bonus, m.note);
  }
  // Also accept queries with an article ("la maison", "l'école", "un livre")
  const noArticle = key.replace(/^(le|la|les|l'|un|une|des|du|de la|se|s')\s*/, "");
  if (noArticle !== key) for (const m of index.byKey.get(noArticle) ?? []) put(m.idx, m.kind, -2, m.note);

  const wordRe = new RegExp(`(^|[^a-z])${escapeRe(key)}([^a-z]|$)`);
  const enKey = searchKey(q.replace(/^to /i, ""));
  index.entries.forEach(({ entry }, idx) => {
    const lk = index.lemmaKeys[idx];
    if (key.length >= 2 && lk.startsWith(key) && lk !== key) put(idx, "prefix", -Math.min(20, lk.length - key.length));
    for (const en of entry.en) {
      const ek = searchKey(en.replace(/^to /, ""));
      if (ek === key || ek === enKey) put(idx, "english", 8);
      else if (key.length >= 3 && wordRe.test(ek)) put(idx, "english", -5);
    }
    if (key.includes(" ") && lk.includes(key)) put(idx, "phrase");
  });

  if (hits.size === 0 && key.length >= 3) {
    const maxD = key.length <= 5 ? 1 : 2;
    index.lemmaKeys.forEach((lk, idx) => {
      const d = levenshtein(key, lk, maxD);
      if (d <= maxD) put(idx, "fuzzy", -d * 5, `did you mean “${index.entries[idx].entry.lemma}”?`);
    });
  }
  return rank(hits, limit);
}

function rank(hits: Map<number, SearchHit>, limit: number) {
  const levelRank = { A1: 0, A2: 1, B1: 2, B2: 3 } as const;
  return [...hits.values()].sort((a, b) => b.score - a.score || levelRank[a.entry.level] - levelRank[b.entry.level] || a.entry.lemma.localeCompare(b.entry.lemma, "fr")).slice(0, limit);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
