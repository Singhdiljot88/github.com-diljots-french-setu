import type { Day, LangItem } from "./schema";
import type { DictEntry } from "./dictionary-schema";
import type { Mock } from "./mock-schema";

const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN_WORD = /[A-Za-z]{4,}/;

/** Words that may legitimately appear in Latin script inside Hindi text. */
const ALLOWED_LATIN = /\b(TEF|Canada|CEFR|NCLC|IPA|email|e-mail|SMS|OK|Wi-?Fi|Montréal|Toronto|Québec|Ottawa)\b/gi;

function lintItem(where: string, it: LangItem, out: string[], requirePron: boolean) {
  if (it.pron !== undefined) {
    if (!DEVANAGARI.test(it.pron)) out.push(`${where}: pron must be Devanagari`);
    if (it.pron.trim() === it.hi.trim()) out.push(`${where}: pron identical to hi — pronunciation and meaning must differ`);
  } else if (requirePron) out.push(`${where}: missing pron`);
  const hiLatin = it.hi.replace(ALLOWED_LATIN, "");
  if (LATIN_WORD.test(hiLatin.replace(/\([^)]*\)/g, ""))) out.push(`${where}: hi contains Latin words: "${it.hi}"`);
}

export function lintDay(d: Day): string[] {
  const out: string[] = [];
  d.vocabulary.forEach((v, i) => lintItem(`vocabulary[${i}] ${v.fr}`, v, out, true));
  d.phrases.forEach((v, i) => lintItem(`phrases[${i}] ${v.fr}`, v, out, true));
  d.grammar.examples.forEach((v, i) => lintItem(`grammar.examples[${i}]`, v, out, true));
  d.pronunciation.words.forEach((v, i) => lintItem(`pronunciation.words[${i}]`, v, out, true));
  d.speaking.prompts.forEach((v, i) => lintItem(`speaking.prompts[${i}]`, v, out, false));
  d.review.items.forEach((v, i) => lintItem(`review.items[${i}]`, v, out, false));
  const transcript = d.listening.lines.map((l) => l.fr).join(" ");
  d.listening.questions.forEach((q, i) => {
    if (q.evidence && !norm(transcript).includes(norm(q.evidence))) out.push(`listening.questions[${i}]: evidence not found in transcript: "${q.evidence}"`);
  });
  d.reading.questions.forEach((q, i) => {
    if (q.evidence && !norm(d.reading.text).includes(norm(q.evidence))) out.push(`reading.questions[${i}]: evidence not found in text: "${q.evidence}"`);
  });
  const blanks = (d.listening.gapFill.text.match(/___/g) ?? []).length;
  if (blanks !== d.listening.gapFill.answers.length) out.push(`listening.gapFill: ${blanks} blanks but ${d.listening.gapFill.answers.length} answers`);
  const wc = d.writing.model.fr.split(/\s+/).filter(Boolean).length;
  if (wc < d.writing.minWords) out.push(`writing.model has ${wc} words, below minWords ${d.writing.minWords}`);
  if (d.checkpoint && d.assessment.length < 10) out.push(`checkpoint days need at least 10 assessment questions`);
  d.assessment.forEach((q, i) => {
    if (q.type === "mcq" && q.answer >= q.options.length) out.push(`assessment[${i}]: answer out of range`);
    if (q.type === "reorder") {
      const a = q.answer.replace(/[.?!]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");
      const w = [...q.words].map((x) => x.replace(/[.?!]/g, "")).filter(Boolean).sort().join(" ");
      if (a !== w) out.push(`assessment[${i}]: reorder words do not match answer`);
    }
  });
  return out;
}

export function norm(s: string) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[«»"“”]/g, "").replace(/\s+/g, " ").trim();
}

export function lintDictionary(entries: DictEntry[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${e.lemma.toLowerCase()}|${e.pos}`;
    if (seen.has(key)) out.push(`duplicate entry ${key}`);
    seen.add(key);
    if (e.pos === "noun" && !e.gender) out.push(`${e.lemma}: noun without gender`);
    if (e.pos === "verb" && !e.verb) out.push(`${e.lemma}: verb without verb info`);
    if (e.pron && !DEVANAGARI.test(e.pron)) out.push(`${e.lemma}: pron must be Devanagari`);
    if (e.pron && e.hi.includes(e.pron)) out.push(`${e.lemma}: pron identical to Hindi meaning`);
    if (e.verb && e.verb.group === 3 && !e.verb.irregular) out.push(`${e.lemma}: group 3 verb needs irregular forms`);
  }
  return out;
}

export function lintMock(m: Mock): string[] {
  const out: string[] = [];
  const r = m.reading.sections.flatMap((s) => s.items.flatMap((i) => i.questions)).length;
  const l = m.listening.sections.flatMap((s) => s.items.flatMap((i) => i.questions)).length;
  if (r !== 40) out.push(`reading has ${r} questions, expected 40`);
  if (l !== 40) out.push(`listening has ${l} questions, expected 40`);
  for (const s of m.reading.sections) for (const it of s.items) for (const q of it.questions)
    if (q.evidence && !norm(it.document.text).includes(norm(q.evidence))) out.push(`reading ${s.key}: evidence not in document: "${q.evidence}"`);
  for (const s of m.listening.sections) for (const it of s.items) {
    const t = it.lines.map((x) => x.fr).join(" ");
    for (const q of it.questions) if (q.evidence && !norm(t).includes(norm(q.evidence))) out.push(`listening ${s.key}: evidence not in audio: "${q.evidence}"`);
  }
  return out;
}
