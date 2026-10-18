import type { DictEntry } from "@/content/dictionary-schema";

export type Tense = "present" | "passe_compose" | "imparfait" | "futur" | "conditionnel" | "subjonctif" | "imperatif";
export const TENSE_LABELS: Record<Tense, { fr: string; en: string; hi: string }> = {
  present: { fr: "Présent", en: "Present", hi: "वर्तमान काल" },
  passe_compose: { fr: "Passé composé", en: "Past (perfect)", hi: "भूतकाल (पूर्ण)" },
  imparfait: { fr: "Imparfait", en: "Imperfect", hi: "अपूर्ण भूतकाल" },
  futur: { fr: "Futur simple", en: "Future", hi: "भविष्यकाल" },
  conditionnel: { fr: "Conditionnel présent", en: "Conditional", hi: "संभावनार्थ (conditional)" },
  subjonctif: { fr: "Subjonctif présent", en: "Subjunctive", hi: "संभाव्य भाव (subjunctive)" },
  imperatif: { fr: "Impératif", en: "Imperative", hi: "आज्ञार्थ" },
};

const PRONOUNS = ["je", "tu", "il/elle/on", "nous", "vous", "ils/elles"];
const REFLEXIVE = ["me", "te", "se", "nous", "vous", "se"];
const vowelStart = (s: string) => /^[aeiouyhâàäéèêëîïôöûùüœ]/i.test(s);
const H_ASPIRE = new Set(["haïr", "hurler", "heurter", "hâter", "hisser", "hausser"]);
const elides = (s: string, inf: string) => vowelStart(s) && !(s.startsWith("h") && H_ASPIRE.has(inf));

export type VerbInfo = NonNullable<DictEntry["verb"]>;

/** Splits "se lever" / "s'appeler" into the bare infinitive. */
export function bareInfinitive(lemma: string): { inf: string; pronominal: boolean } {
  const m = lemma.match(/^(?:se |s')(.+)$/);
  return m ? { inf: m[1], pronominal: true } : { inf: lemma, pronominal: false };
}

type Core = { present: string[]; participle: string; futureStem: string; imperfectStem: string; subjunctive: string[]; imperative: string[] };

function core(inf: string, v: VerbInfo): Core | null {
  if (v.irregular) {
    const i = v.irregular;
    const nous = i.present[3];
    const imperfectStem = i.imperfectStem ?? IMPERSONAL_IMPF[inf] ?? nous.replace(/ons$/, "");
    const imperative = i.imperative ?? [i.present[1].replace(/([^s])s$/, (inf.endsWith("er") || inf === "aller") ? "$1" : "$1s"), i.present[3], i.present[4]];
    return { present: i.present, participle: i.participle, futureStem: i.futureStem, imperfectStem, subjunctive: i.subjunctive, imperative };
  }
  if (v.group === 1 && inf.endsWith("er")) {
    const s = inf.slice(0, -2);
    const present = [s + "e", s + "es", s + "e", s + "ons", s + "ez", s + "ent"];
    return { present, participle: s + "é", futureStem: inf, imperfectStem: s, subjunctive: [s + "e", s + "es", s + "e", s + "ions", s + "iez", s + "ent"], imperative: [s + "e", s + "ons", s + "ez"] };
  }
  if (v.group === 2 && inf.endsWith("ir")) {
    const s = inf.slice(0, -2);
    const present = [s + "is", s + "is", s + "it", s + "issons", s + "issez", s + "issent"];
    const ss = s + "iss";
    return { present, participle: s + "i", futureStem: inf, imperfectStem: ss, subjunctive: [ss + "e", ss + "es", ss + "e", ss + "ions", ss + "iez", ss + "ent"], imperative: [s + "is", s + "issons", s + "issez"] };
  }
  return null;
}

const IMPERSONAL_IMPF: Record<string, string> = { falloir: "fall", pleuvoir: "pleuv" };
/** commenç- / mange- lose ç / e before endings starting with i (commencions, mangions). */
const joinStem = (stem: string, ending: string) => ending.startsWith("i") ? stem.replace(/ç$/, "c").replace(/ge$/, "g") : stem;
const IMPF = ["ais", "ais", "ait", "ions", "iez", "aient"];
const FUT = ["ai", "as", "a", "ons", "ez", "ont"];
const COND = IMPF;
const AVOIR = ["ai", "as", "a", "avons", "avez", "ont"];
const ETRE = ["suis", "es", "est", "sommes", "êtes", "sont"];

export type ConjugationTable = Record<Tense, { person: string; form: string }[]>;

function withPronoun(i: number, form: string, inf: string, pronominal: boolean): string {
  let verbPart = form;
  if (pronominal) {
    const r = REFLEXIVE[i];
    verbPart = (r === "me" || r === "te" || r === "se") && elides(form, inf) ? `${r[0]}'${form}` : `${r} ${form}`;
  }
  if (i === 0) return elides(verbPart, inf) ? `j'${verbPart}` : `je ${verbPart}`;
  return `${PRONOUNS[i].split("/")[0]} ${verbPart}`;
}

export function conjugate(lemma: string, v: VerbInfo): ConjugationTable | null {
  const { inf, pronominal } = bareInfinitive(lemma);
  const c = core(inf, v);
  if (!c) return null;
  const pron = pronominal || v.pronominal;
  const aux = pron ? "être" : v.aux;
  const mk = (forms: string[]) => forms.map((f, i) => ({ person: PRONOUNS[i], form: withPronoun(i, f, inf, pron) }));
  const pp = c.participle;
  const ppForms = aux === "être" ? [pp + "(e)", pp + "(e)", pp + "(e)", pp + "(e)s", pp + "(e)(s)", pp + "(e)s"] : Array(6).fill(pp);
  const auxForms = aux === "être" ? ETRE : AVOIR;
  const pc = auxForms.map((a, i) => ({ person: PRONOUNS[i], form: withPronoun(i, `${a} ${ppForms[i]}`, inf, pron) }));
  const subj = c.subjunctive.map((f, i) => ({ person: PRONOUNS[i], form: `que ${withPronoun(i, f, inf, pron).replace(/^que /, "")}`.replace(/^que je ([aeiouhéèêâîôû])/i, "que j'$1").replace(/^que il/, "qu'il").replace(/^que ils/, "qu'ils") }));
  const imperative = (pron
    ? [`${c.imperative[0]}-toi`, `${c.imperative[1]}-nous`, `${c.imperative[2]}-vous`]
    : c.imperative).map((f, i) => ({ person: ["(tu)", "(nous)", "(vous)"][i], form: f }));
  const impersonal = c.present.filter((f) => f && f !== "—").length === 1;
  const only3 = <T,>(rows: T[]) => (impersonal ? rows.filter((_, i) => i === 2) : rows);
  const table: ConjugationTable = {
    present: mk(c.present),
    passe_compose: pc,
    imparfait: mk(IMPF.map((e) => joinStem(c.imperfectStem, e) + e)),
    futur: mk(FUT.map((e) => c.futureStem + e)),
    conditionnel: mk(COND.map((e) => c.futureStem + e)),
    subjonctif: subj,
    imperatif: impersonal ? [] : imperative,
  };
  if (impersonal) for (const k of Object.keys(table) as Tense[]) if (k !== "imperatif") table[k] = only3(table[k]);
  return table;
}

/** All single-word inflected forms (for search indexing: "suis" → être, "allé" → aller). */
export function inflectedForms(lemma: string, v: VerbInfo): string[] {
  const { inf } = bareInfinitive(lemma);
  const c = core(inf, v);
  if (!c) return [];
  const set = new Set<string>([inf, c.participle, c.participle + "e", c.participle + "s", c.participle + "es"]);
  for (const f of [...c.present, ...c.subjunctive, ...c.imperative]) set.add(f);
  for (const e of IMPF) set.add(joinStem(c.imperfectStem, e) + e);
  for (const e of FUT) set.add(c.futureStem + e);
  return [...set].filter((f) => f && !f.includes("—"));
}
