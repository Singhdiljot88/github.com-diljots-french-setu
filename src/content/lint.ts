import type { Day, LangItem } from "./schema";
import type { DictEntry } from "./dictionary-schema";
import type { Mock } from "./mock-schema";

const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN_WORD = /[A-Za-z]{4,}/;

/** Words that may legitimately appear in Latin script inside Hindi text. */
const ALLOWED_LATIN = /\b(TEF|Canada|CEFR|NCLC|IPA|email|e-mail|SMS|OK|Wi-?Fi|Montréal|Toronto|Québec|Ottawa)\b/gi;

/** A pronunciation guide is pure Devanagari: Latin letters (ü, ö, a–z) inside it are unreadable for the learner. */
export const MIXED_SCRIPT = /[A-Za-zÀ-ÿ]/;

/**
 * Strings that must never come back (Hindi fix list, sections 2–5). Old guide letters are listed too:
 * since October 2026 the French r is written र, /ʒ/ ज, /y/ ्यू, and /ə ø œ/ the inherent vowel.
 */
export const BANNED_STRINGS: { text: string; why: string }[] = [
  { text: "बाँझ़ा", why: "wrong transcription of bonjour" }, { text: "बॉनझ़ा", why: "wrong transcription of bonjour" },
  { text: "सा-लू", why: "salut is सा-ल्यू" }, { text: "सा-लूँ", why: "salut is सा-ल्यू" }, { text: "मैर-सी", why: "merci is मेर-सी" },
  { text: "लठ", why: "le is ल" }, { text: "वर्तनी का जाल", why: "use वर्तनी की चेतावनी" }, { text: "कोर्स नक्शा", why: "use पाठ्यक्रम" },
  { text: "पासे कॉम्पोज़े", why: "keep the French term: passé composé (पूर्ण भूतकाल)" }, { text: "फ्रेंच", why: "फ़्रेंच takes a nukta" },
  { text: "दोहराई का", why: "the noun is दोहराव" }, { text: "दोहराई:", why: "the noun is दोहराव" },
  { text: "गलत", why: "one spelling across the app: ग़लत" },
];

/** Old guide letters that must not appear inside a pron field any more. */
const OLD_GUIDE_LETTERS = /[üöÜÖ]|ग़|ग़|झ़/;

export function lintPron(where: string, pron: string, out: string[]) {
  if (!DEVANAGARI.test(pron)) out.push(`${where}: pron must be Devanagari`);
  if (MIXED_SCRIPT.test(pron)) out.push(`${where}: Latin letters inside the Devanagari guide "${pron}"`);
  else if (OLD_GUIDE_LETTERS.test(pron)) out.push(`${where}: old guide letter (ग़, झ़) in "${pron}"; see CONVENTIONS.md section 3`);
}

function lintItem(where: string, it: LangItem, out: string[], requirePron: boolean) {
  if (it.pron !== undefined) {
    lintPron(where, it.pron, out);
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
  for (const sec of ["listening", "reading"] as const) d[sec].questions.forEach((q, i) => {
    if (!q.q.hi) out.push(`${sec}.questions[${i}]: question has no Hindi text (q.hi)`);
  });
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

/** Words whose Hindi meaning is a borrowing that sounds like the French (parc = पार्क). */
const SAME_SOUND_AND_MEANING = new Set(["parc"]);

export function lintDictionary(entries: DictEntry[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${e.lemma.toLowerCase()}|${e.pos}`;
    if (seen.has(key)) out.push(`duplicate entry ${key}`);
    seen.add(key);
    if (e.pos === "noun" && !e.gender) out.push(`${e.lemma}: noun without gender`);
    if (e.pos === "verb" && !e.verb) out.push(`${e.lemma}: verb without verb info`);
    if (e.pron) lintPron(e.lemma, e.pron, out);
    if (e.pron && e.hi.includes(e.pron) && !SAME_SOUND_AND_MEANING.has(e.lemma)) out.push(`${e.lemma}: pron identical to Hindi meaning`);
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
