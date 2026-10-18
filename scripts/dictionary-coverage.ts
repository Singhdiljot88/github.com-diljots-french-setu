/**
 * Lists lesson vocabulary (non-phrase items) that the dictionary cannot find as a headword, form or plural.
 * Usage: npx tsx scripts/dictionary-coverage.ts [--json]
 */
import { loadDaysFromDisk, loadDictionaryFromDisk } from "../src/content/load";
import { buildIndex } from "../src/lib/dict-search";
import { searchKey } from "../src/lib/text";

const days = loadDaysFromDisk().map((d) => d.day);
const dict = loadDictionaryFromDisk().entries;
const idx = buildIndex(dict.map((e) => ({ ...e, source: "" })));
const missing = new Map<string, { pos: string; en: string; hi: string; gender?: string; days: number[] }>();
for (const d of days) {
  for (const v of d.vocabulary) {
    if (v.pos === "phrase") continue;
    const word = (v.lemma ?? v.fr).replace(/^(?:(?:le|la|les|un|une|des)\s+|l['’])/i, "").trim();
    if (word.includes(" ")) continue;
    const keys = [searchKey(word), searchKey(`se ${word}`), searchKey(`s'${word}`), searchKey(word.replace(/^(se |s')/i, ""))];
    const hits = keys.flatMap((k) => idx.byKey.get(k) ?? []).filter((h) => h.kind !== "misspelling");
    if (hits?.length) continue;
    const m = missing.get(word) ?? { pos: v.pos, en: v.en, hi: v.hi, gender: v.gender, days: [] };
    m.days.push(d.day);
    missing.set(word, m);
  }
}
if (process.argv.includes("--json")) console.log(JSON.stringify([...missing].map(([w, m]) => ({ word: w, ...m })), null, 1));
else {
  process.stdout.on("error", () => process.exit(0));
  console.log(`${missing.size} lesson words missing from the dictionary (${days.length} days, ${dict.length} entries)`);
  for (const [w, m] of missing) console.log(`${w}\t${m.pos}\t${m.en}\tdays ${m.days.join(",")}`);
}
