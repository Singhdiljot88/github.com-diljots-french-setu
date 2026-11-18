import type { DictEntry } from "@/content/dictionary-schema";
import { bareInfinitive, conjugate, TENSE_LABELS, type Tense, type VerbInfo } from "./conjugate";
import { H_ASPIRE } from "./elision";
import { checkAnswer, normalizeBasic, stripAccents } from "./text";

/** First course day that teaches the tense. Present of être starts on day 4. */
export const TENSE_FROM_DAY: Record<Tense, number> = {
  present: 4,
  imperatif: 29,
  passe_compose: 41,
  imparfait: 46,
  futur: 48,
  conditionnel: 65,
  subjonctif: 75,
};

export const DRILL_TENSES: Tense[] = ["present", "imperatif", "passe_compose", "imparfait", "futur", "conditionnel", "subjonctif"];

/** High-frequency verbs, in the order the course meets them. Forms come from the conjugation engine. */
const DRILL_LEMMAS: { lemma: string; fromDay: number }[] = [
  { lemma: "être", fromDay: 4 },
  { lemma: "avoir", fromDay: 5 },
  { lemma: "parler", fromDay: 9 },
  { lemma: "habiter", fromDay: 9 },
  { lemma: "aimer", fromDay: 9 },
  { lemma: "travailler", fromDay: 9 },
  { lemma: "aller", fromDay: 16 },
  { lemma: "faire", fromDay: 16 },
  { lemma: "venir", fromDay: 16 },
  { lemma: "se lever", fromDay: 27 },
  { lemma: "prendre", fromDay: 29 },
  { lemma: "finir", fromDay: 31 },
  { lemma: "choisir", fromDay: 31 },
  { lemma: "attendre", fromDay: 31 },
  { lemma: "répondre", fromDay: 31 },
  { lemma: "pouvoir", fromDay: 32 },
  { lemma: "vouloir", fromDay: 32 },
  { lemma: "devoir", fromDay: 32 },
  { lemma: "voir", fromDay: 43 },
  { lemma: "dire", fromDay: 43 },
  { lemma: "écrire", fromDay: 43 },
  { lemma: "lire", fromDay: 43 },
  { lemma: "mettre", fromDay: 43 },
  { lemma: "partir", fromDay: 44 },
  { lemma: "arriver", fromDay: 44 },
  { lemma: "sortir", fromDay: 44 },
];

export type DrillVerb = {
  lemma: string;
  en: string;
  hi: string;
  pron?: string;
  fromDay: number;
  entryId: string;
  group: 1 | 2 | 3;
  aux: "avoir" | "être";
  pronominal: boolean;
  verb: VerbInfo;
};

export type SubjectSpec = {
  id: string;
  personIndex: number;
  pronoun: "je" | "tu" | "il" | "elle" | "nous" | "vous" | "ils" | "elles";
  fr: string;
  en: string;
  hi: string;
  fem: boolean;
  plural: boolean;
};

export type DrillQuestion = {
  id: string;
  lemma: string;
  en: string;
  hi: string;
  pron?: string;
  entryId: string;
  tense: Tense;
  tenseLabel: { fr: string; en: string; hi: string };
  subject: SubjectSpec;
  answer: string;
  hint: { en: string; hi: string };
  ahead: boolean;
  taughtDay: number;
};

const PLAIN: SubjectSpec[] = [
  { id: "je", personIndex: 0, pronoun: "je", fr: "je", en: "I", hi: "मैं", fem: false, plural: false },
  { id: "tu", personIndex: 1, pronoun: "tu", fr: "tu", en: "you (informal)", hi: "tu", fem: false, plural: false },
  { id: "il", personIndex: 2, pronoun: "il", fr: "il", en: "he", hi: "वह (पुल्लिंग)", fem: false, plural: false },
  { id: "elle", personIndex: 2, pronoun: "elle", fr: "elle", en: "she", hi: "वह (स्त्रीलिंग)", fem: true, plural: false },
  { id: "nous", personIndex: 3, pronoun: "nous", fr: "nous", en: "we", hi: "हम", fem: false, plural: true },
  { id: "vous", personIndex: 4, pronoun: "vous", fr: "vous", en: "you (formal or plural)", hi: "vous", fem: false, plural: false },
  { id: "ils", personIndex: 5, pronoun: "ils", fr: "ils", en: "they (masculine or mixed)", hi: "वे (पुल्लिंग)", fem: false, plural: true },
  { id: "elles", personIndex: 5, pronoun: "elles", fr: "elles", en: "they (feminine)", hi: "वे (स्त्रीलिंग)", fem: true, plural: true },
];

const GENDERED: SubjectSpec[] = [
  { id: "je-m", personIndex: 0, pronoun: "je", fr: "je (homme)", en: "I (man)", hi: "मैं (पुरुष)", fem: false, plural: false },
  { id: "je-f", personIndex: 0, pronoun: "je", fr: "je (femme)", en: "I (woman)", hi: "मैं (स्त्री)", fem: true, plural: false },
  { id: "tu-m", personIndex: 1, pronoun: "tu", fr: "tu (homme)", en: "you, informal (man)", hi: "tu (पुरुष)", fem: false, plural: false },
  { id: "elle", personIndex: 2, pronoun: "elle", fr: "elle", en: "she", hi: "वह (स्त्रीलिंग)", fem: true, plural: false },
  { id: "il", personIndex: 2, pronoun: "il", fr: "il", en: "he", hi: "वह (पुल्लिंग)", fem: false, plural: false },
  { id: "nous-m", personIndex: 3, pronoun: "nous", fr: "nous (hommes)", en: "we (men or mixed)", hi: "हम (पुल्लिंग)", fem: false, plural: true },
  { id: "nous-f", personIndex: 3, pronoun: "nous", fr: "nous (femmes)", en: "we (women)", hi: "हम (स्त्रीलिंग)", fem: true, plural: true },
  { id: "vous-m", personIndex: 4, pronoun: "vous", fr: "vous (un homme)", en: "you, one man", hi: "vous (एक पुरुष)", fem: false, plural: false },
  { id: "vous-f", personIndex: 4, pronoun: "vous", fr: "vous (une femme)", en: "you, one woman", hi: "vous (एक स्त्री)", fem: true, plural: false },
  { id: "vous-p", personIndex: 4, pronoun: "vous", fr: "vous (plusieurs)", en: "you, several people", hi: "vous (कई लोग)", fem: false, plural: true },
  { id: "ils", personIndex: 5, pronoun: "ils", fr: "ils", en: "they (masculine or mixed)", hi: "वे (पुल्लिंग)", fem: false, plural: true },
  { id: "elles", personIndex: 5, pronoun: "elles", fr: "elles", en: "they (feminine)", hi: "वे (स्त्रीलिंग)", fem: true, plural: true },
];

const IMPERATIVE: SubjectSpec[] = [
  { id: "tu-imp", personIndex: 0, pronoun: "tu", fr: "(tu)", en: "command to one person (tu)", hi: "tu के लिए आदेश", fem: false, plural: false },
  { id: "nous-imp", personIndex: 1, pronoun: "nous", fr: "(nous)", en: "command including yourself (nous)", hi: "nous के लिए आदेश", fem: false, plural: true },
  { id: "vous-imp", personIndex: 2, pronoun: "vous", fr: "(vous)", en: "command with vous", hi: "vous के लिए आदेश", fem: false, plural: false },
];

const vowelStart = (s: string) => /^[aeiouyhâàäéèêëîïôöûùüœæ]/i.test(s);
const jeElides = (rest: string, inf: string) => vowelStart(rest) && !(rest.toLowerCase().startsWith("h") && H_ASPIRE.has(inf));

function agrees(lemma: string, verb: VerbInfo, tense: Tense) {
  const { pronominal } = bareInfinitive(lemma);
  return tense === "passe_compose" && (pronominal || verb.pronominal || verb.aux === "être");
}

function stripLead(form: string): { que: boolean; rest: string } {
  let s = form.trim();
  let que = false;
  if (/^que\s+/i.test(s)) { que = true; s = s.replace(/^que\s+/i, ""); }
  else if (/^qu'/i.test(s)) { que = true; s = s.replace(/^qu'/i, ""); }
  const prefixes = ["j'", "je ", "tu ", "ils ", "il ", "nous ", "vous "];
  for (const p of prefixes) {
    if (s.toLowerCase().startsWith(p)) { s = s.slice(p.length); break; }
  }
  return { que, rest: s };
}

function concretize(rest: string, spec: SubjectSpec, agree: boolean): string {
  if (!agree) return rest;
  const parts = rest.split(" ");
  const last = parts[parts.length - 1] ?? "";
  const base = last.replace(/\(e\)\(s\)$/, "").replace(/\(e\)s$/, "").replace(/\(e\)$/, "");
  let out = base;
  if (spec.fem && !out.endsWith("e")) out += "e";
  if (spec.plural && !out.endsWith("s")) out += "s";
  parts[parts.length - 1] = out;
  return parts.join(" ");
}

function attach(pronoun: SubjectSpec["pronoun"], rest: string, inf: string): string {
  if (pronoun === "je") return jeElides(rest, inf) ? `j'${rest}` : `je ${rest}`;
  return `${pronoun} ${rest}`;
}

function withQue(phrase: string): string {
  return vowelStart(phrase) ? `qu'${phrase}` : `que ${phrase}`;
}

/** The full form the learner should type, including the subject (except the imperative). */
export function renderAnswer(lemma: string, verb: VerbInfo, tense: Tense, spec: SubjectSpec): string | null {
  const table = conjugate(lemma, verb);
  if (!table) return null;
  const rows = table[tense];
  const row = rows[spec.personIndex];
  if (!row?.form || row.form.includes("—")) return null;
  if (tense === "imperatif") return row.form;
  const { inf } = bareInfinitive(lemma);
  const lead = stripLead(row.form);
  const rest = concretize(lead.rest, spec, agrees(lemma, verb, tense));
  const phrase = attach(spec.pronoun, rest, inf);
  return lead.que || tense === "subjonctif" ? withQue(phrase) : phrase;
}

export function resolveDrillVerbs(entries: { id: string; entry: DictEntry }[]): DrillVerb[] {
  const by = new Map(entries.filter((e) => e.entry.pos === "verb" && e.entry.verb).map((e) => [e.entry.lemma.toLowerCase(), e]));
  const out: DrillVerb[] = [];
  for (const spec of DRILL_LEMMAS) {
    const hit = by.get(spec.lemma.toLowerCase());
    if (!hit?.entry.verb) continue;
    if (!conjugate(hit.entry.lemma, hit.entry.verb)) continue;
    const { pronominal } = bareInfinitive(hit.entry.lemma);
    out.push({
      lemma: hit.entry.lemma,
      en: hit.entry.en[0] ?? spec.lemma,
      hi: hit.entry.hi[0] ?? "",
      pron: hit.entry.pron,
      fromDay: spec.fromDay,
      entryId: hit.id,
      group: hit.entry.verb.group,
      aux: hit.entry.verb.aux,
      pronominal: pronominal || hit.entry.verb.pronominal,
      verb: hit.entry.verb,
    });
  }
  return out;
}

function subjectsFor(tense: Tense, lemma: string, verb: VerbInfo): SubjectSpec[] {
  if (tense === "imperatif") return IMPERATIVE;
  return agrees(lemma, verb, tense) ? GENDERED : PLAIN;
}

function hintFor(verb: DrillVerb, tense: Tense): { en: string; hi: string } {
  if (tense === "present" && verb.group === 1) return {
    en: "Regular -er: je -e, tu -es, il/elle -e, nous -ons, vous -ez, ils/elles -ent. The last letters -e, -es and -ent are silent.",
    hi: "नियमित -er: je -e, tu -es, il/elle -e, nous -ons, vous -ez, ils/elles -ent। अंत का -e, -es और -ent चुप रहता है।",
  };
  if (tense === "present" && verb.group === 2) return {
    en: "Regular -ir: je -is, tu -is, il/elle -it, nous -issons, vous -issez, ils/elles -issent.",
    hi: "नियमित -ir: je -is, tu -is, il/elle -it, nous -issons, vous -issez, ils/elles -issent।",
  };
  if (tense === "passe_compose" && (verb.pronominal || verb.aux === "être")) return {
    en: "Passé composé with être. The participle agrees with the subject: allé, allée, allés, allées. Like Hindi गया / गई / गए / गईं.",
    hi: "être के साथ passé composé। कृदंत कर्ता के साथ बदलता है: allé, allée, allés, allées। हिंदी के गया / गई / गए / गईं की तरह।",
  };
  if (tense === "passe_compose") return {
    en: "Passé composé with avoir: the present of avoir plus the past participle. With avoir, the participle does not change for the subject.",
    hi: "avoir के साथ passé composé: avoir का वर्तमान और कृदंत। avoir के साथ कृदंत कर्ता के लिए नहीं बदलता।",
  };
  if (tense === "imparfait") return {
    en: "Imparfait: the nous form of the present, drop -ons, add -ais, -ais, -ait, -ions, -iez, -aient. être uses ét-.",
    hi: "Imparfait: वर्तमान का nous रूप, -ons हटाएँ, फिर -ais, -ais, -ait, -ions, -iez, -aient। être में ét- लगता है।",
  };
  if (tense === "futur") return {
    en: "Futur simple: the infinitive (or an irregular stem such as ser-, ir-, fer-) plus -ai, -as, -a, -ons, -ez, -ont.",
    hi: "Futur simple: infinitif (या अनियमित धातु जैसे ser-, ir-, fer-) और -ai, -as, -a, -ons, -ez, -ont।",
  };
  if (tense === "conditionnel") return {
    en: "Conditionnel: the future stem plus the imparfait endings. je voudrais and je parlerais use this.",
    hi: "Conditionnel: भविष्य की धातु और imparfait के प्रत्यय। je voudrais और je parlerais इसी से बनते हैं।",
  };
  if (tense === "subjonctif") return {
    en: "Subjonctif after que: for many verbs it looks like the present, with -ions and -iez for nous and vous. être → que je sois.",
    hi: "que के बाद subjonctif: कई क्रियाओं में यह वर्तमान जैसा दिखता है, nous/vous में -ions और -iez। être → que je sois।",
  };
  if (tense === "imperatif") return {
    en: "Imperative: the tu / nous / vous present, without the pronoun. For -er verbs, drop the -s of tu: parle, not parles.",
    hi: "आज्ञार्थ: tu / nous / vous का वर्तमान, सर्वनाम के बिना। -er क्रिया में tu का -s हटता है: parle, parles नहीं।",
  };
  return {
    en: "This verb does not follow the regular endings. Learn this form as a set.",
    hi: "यह क्रिया नियमित प्रत्ययों पर नहीं चलती। इस रूप को पूरा का पूरा याद करें।",
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function unlockedTenses(courseDay: number, preview: boolean): Tense[] {
  return DRILL_TENSES.filter((t) => preview || courseDay >= TENSE_FROM_DAY[t]);
}

export function buildDrill(o: {
  verbs: DrillVerb[];
  courseDay: number;
  preview: boolean;
  count?: number;
  seed: number;
  tense?: Tense | "mix";
  lemma?: string;
}): DrillQuestion[] {
  const rand = mulberry32(o.seed || 1);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const wantLemma = o.lemma?.trim().toLowerCase();
  const verbs = o.verbs.filter((v) => (wantLemma ? v.lemma.toLowerCase() === wantLemma : o.preview || o.courseDay >= v.fromDay));
  const tenses = (o.tense && o.tense !== "mix" ? [o.tense] : unlockedTenses(o.courseDay, o.preview || !!wantLemma))
    .filter((t) => o.preview || !!wantLemma || o.courseDay >= TENSE_FROM_DAY[t]);
  if (!verbs.length || !tenses.length) return [];
  const count = Math.min(12, Math.max(1, o.count ?? 8));
  const out: DrillQuestion[] = [];
  const seen = new Set<string>();
  for (let n = 0; n < count * 8 && out.length < count; n++) {
    const verb = pick(verbs);
    const tense = pick(tenses);
    const table = conjugate(verb.lemma, verb.verb);
    if (!table || table[tense].length === 0) continue;
    if (table[tense].length < 6 && tense !== "imperatif") continue;
    const spec = pick(subjectsFor(tense, verb.lemma, verb.verb));
    const answer = renderAnswer(verb.lemma, verb.verb, tense, spec);
    if (!answer) continue;
    const id = `${verb.lemma}|${tense}|${spec.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const taughtDay = Math.max(verb.fromDay, TENSE_FROM_DAY[tense]);
    out.push({
      id, lemma: verb.lemma, en: verb.en, hi: verb.hi, pron: verb.pron, entryId: verb.entryId,
      tense, tenseLabel: TENSE_LABELS[tense], subject: spec, answer,
      hint: hintFor(verb, tense),
      ahead: taughtDay > o.courseDay,
      taughtDay,
    });
  }
  return out;
}

function sameWords(a: string, b: string) {
  return stripAccents(normalizeBasic(a)) === stripAccents(normalizeBasic(b));
}

/** Why a wrong answer missed, in English and Hindi. Accent-only slips are not treated as wrong. */
export function gradeDrill(input: string, q: DrillQuestion): { result: "correct" | "accent" | "wrong"; feedback: { en: string; hi: string } } {
  const checked = checkAnswer(input, q.answer);
  if (checked.result === "correct") return {
    result: "correct",
    feedback: { en: `Correct: ${q.answer}. ${q.hint.en}`, hi: `सही: ${q.answer}। ${q.hint.hi}` },
  };
  if (checked.result === "accent") return {
    result: "accent",
    feedback: {
      en: `The form is right, but the accent is not. Write: ${q.answer}.`,
      hi: `रूप सही है, पर accent नहीं। लिखें: ${q.answer}।`,
    },
  };
  const typed = normalizeBasic(input);
  if (!typed) return { result: "wrong", feedback: { en: `Type the full form. The answer is ${q.answer}.`, hi: `पूरा रूप लिखें। उत्तर है ${q.answer}।` } };
  if (sameWords(typed, q.lemma) || sameWords(typed, q.lemma.replace(/^se |^s'/, ""))) return {
    result: "wrong",
    feedback: { en: `That is the infinitive. Change it for ${q.subject.fr}: ${q.answer}.`, hi: `यह infinitif है। ${q.subject.fr} के लिए बदलें: ${q.answer}।` },
  };
  if (/^je\s+[aeiouyhàâéèêëîïôùûœ]/i.test(typed) && q.answer.startsWith("j'")) return {
    result: "wrong",
    feedback: { en: `je becomes j' before a vowel sound: ${q.answer}.`, hi: `स्वर से पहले je का j' हो जाता है: ${q.answer}।` },
  };
  const auxAvoir = /\b(ai|as|avons|avez|ont)\b/.test(stripAccents(typed));
  const auxEtre = /\b(suis|es|est|sommes|etes|sont)\b/.test(stripAccents(typed));
  const ansEtre = /\b(suis|es|est|sommes|êtes|sont)\b/.test(q.answer);
  const ansAvoir = /\b(ai|as|a|avons|avez|ont)\b/.test(q.answer);
  if (q.tense === "passe_compose" && auxAvoir && ansEtre && !auxEtre) return {
    result: "wrong",
    feedback: { en: `This verb takes être in the passé composé, not avoir: ${q.answer}.`, hi: `इस क्रिया का passé composé être के साथ बनता है, avoir के साथ नहीं: ${q.answer}।` },
  };
  if (q.tense === "passe_compose" && auxEtre && ansAvoir && !ansEtre) return {
    result: "wrong",
    feedback: { en: `This verb takes avoir in the passé composé, not être: ${q.answer}.`, hi: `इस क्रिया का passé composé avoir के साथ बनता है, être के साथ नहीं: ${q.answer}।` },
  };
  const typedBits = stripAccents(typed).split(" ");
  const ansBits = stripAccents(normalizeBasic(q.answer)).split(" ");
  if (typedBits.length === ansBits.length && typedBits.slice(0, -1).join(" ") === ansBits.slice(0, -1).join(" ") && typedBits.at(-1) !== ansBits.at(-1)) {
    const agreement = q.tense === "passe_compose" && /suis|est|sommes|êtes|sont/.test(q.answer);
    return {
      result: "wrong",
      feedback: agreement
        ? { en: `The ending does not match ${q.subject.fr}. With être, add -e for a woman and -s for a plural: ${q.answer}.`, hi: `अंत ${q.subject.fr} से नहीं मिलता। être के साथ स्त्री के लिए -e और बहुवचन के लिए -s: ${q.answer}।` }
        : { en: `The ending does not match ${q.subject.fr}: ${q.answer}. ${q.hint.en}`, hi: `अंत ${q.subject.fr} से नहीं मिलता: ${q.answer}। ${q.hint.hi}` },
    };
  }
  return {
    result: "wrong",
    feedback: { en: `Not quite. ${q.answer}. ${q.hint.en}`, hi: `अभी नहीं। ${q.answer}। ${q.hint.hi}` },
  };
}
