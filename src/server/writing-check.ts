import "server-only";
import { conjugate } from "@/lib/conjugate";
import { stripAccents, wordCount } from "@/lib/text";
import type { Correction, WritingFeedback } from "@/lib/feedback-schema";
import { dictIndex } from "./content";

/**
 * Rule-based checker used when no AI provider is configured. It is NOT AI and is labelled so in the UI:
 * it catches a fixed list of frequent beginner errors (missing accents on dictionary words, elision,
 * contractions, être/avoir agreement, article gender for known nouns, "j'ai … ans") and nothing else.
 */

type Spellings = { byBare: Map<string, Set<string>>; gender: Map<string, "m" | "f" | "mf"> };
let cache: { idx: unknown; s: Spellings } | null = null;

async function spellings(): Promise<Spellings> {
  const idx = await dictIndex();
  if (cache?.idx === idx) return cache.s;
  const byBare = new Map<string, Set<string>>();
  const gender = new Map<string, "m" | "f" | "mf">();
  const add = (w: string) => {
    for (const part of w.toLowerCase().split(/[\s']+/)) {
      const p = part.replace(/\(e\)|\(s\)|[.,!?]/g, "").replace(/-.*$/, "");
      if (!/^[\p{L}-]+$/u.test(p)) continue;
      const k = stripAccents(p);
      (byBare.get(k) ?? byBare.set(k, new Set()).get(k)!).add(p);
    }
  };
  for (const { entry: e } of idx.entries) {
    add(e.lemma); if (e.plural) add(e.plural); if (e.feminine) add(e.feminine);
    if (e.pos === "noun" && e.gender && !e.lemma.includes(" ")) { gender.set(e.lemma.toLowerCase(), e.gender); if (e.plural) gender.set(e.plural.toLowerCase(), e.gender); }
    if (e.verb) {
      const t = conjugate(e.lemma, e.verb);
      if (t) for (const rows of Object.values(t)) for (const r of rows) add(r.form);
    }
  }
  // function words the dictionary may list only inside phrases
  for (const w of ["à", "où", "là", "déjà", "très", "après", "être", "été", "café", "ça", "voilà", "français", "française", "ne", "pas", "et", "est", "es", "a", "as", "ou", "la", "le", "les", "des", "du", "de", "en", "un", "une"]) add(w);
  const s = { byBare, gender };
  cache = { idx, s };
  return s;
}

const VOWEL_START = /^[aeiouyhâàéèêëîïôûœ]/i;
// h aspiré words take no elision
const H_ASPIRE = new Set(["haricot", "héros", "hibou", "homard", "honte", "hors", "huit", "hasard", "haut", "hall", "handicap", "hockey"]);

const BE_HAVE: Record<string, Record<string, string>> = {
  je: { es: "suis", est: "suis", sont: "suis", as: "ai", a: "ai", avons: "ai" },
  tu: { suis: "es", est: "es", sont: "es", ai: "as", a: "as" },
  il: { es: "est", suis: "est", sont: "est", ai: "a", as: "a", ont: "a" },
  elle: { es: "est", suis: "est", sont: "est", ai: "a", as: "a", ont: "a" },
  on: { es: "est", suis: "est", sont: "est", ai: "a", as: "a", ont: "a" },
  nous: { sont: "sommes", est: "sommes", ont: "avons", a: "avons" },
  vous: { est: "êtes", etes: "êtes", sont: "êtes", ont: "avez", a: "avez" },
  ils: { est: "sont", es: "sont", a: "ont", as: "ont" },
  elles: { est: "sont", es: "sont", a: "ont", as: "ont" },
};

function corr(original: string, corrected: string, category: Correction["category"], en: string, hi: string, practice: { prompt: string; answer: string }, isError = true): Correction {
  return { original, corrected, category, isError, explanation: { en, hi }, practice };
}

const capFirst = (src: string, out: string) => (/^\p{Lu}/u.test(src) ? out.charAt(0).toUpperCase() + out.slice(1) : out);

export async function ruleBasedFeedback(text: string, o: { minWords?: number } = {}): Promise<WritingFeedback> {
  const { byBare, gender } = await spellings();
  const corrections: Correction[] = [];
  const seen = new Set<string>();
  let fixed = text;
  const push = (c: Correction, from?: RegExp, to?: string) => {
    const k = `${c.original}→${c.corrected}`;
    if (seen.has(k)) return;
    seen.add(k);
    if (corrections.length < 12) corrections.push(c);
    if (from && to !== undefined) fixed = fixed.replace(from, to);
  };
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // 1. Elision: je ai → j'ai, le ami → l'ami, de école → d'école, ne aime → n'aime, que il → qu'il
  for (const m of text.matchAll(/\b(je|le|la|de|ne|me|te|se|que)\s+([\p{L}]+)/giu)) {
    const [whole, det, next] = m;
    if (!VOWEL_START.test(next) || H_ASPIRE.has(next.toLowerCase()) || (det.toLowerCase() === "la" && /^(un|une|onze)$/i.test(next))) continue;
    if (/^(le|la)$/i.test(det) && /^(y|en)$/i.test(next)) continue;
    const short = det.toLowerCase() === "que" ? "qu" : det[0];
    const out = `${capFirst(det, short.toLowerCase())}'${next}`;
    push(corr(whole, out, "spelling",
      `Before a word starting with a vowel or a silent h, “${det.toLowerCase()}” drops its last letter and takes an apostrophe: ${out}.`,
      `स्वर (या मूक h) से शुरू होने वाले शब्द से पहले “${det.toLowerCase()}” का आख़िरी अक्षर हटकर apostrophe लगता है: ${out}।`,
      { prompt: `Fix the elision: ${det.toLowerCase()} ${next.toLowerCase()}`, answer: `${short.toLowerCase()}'${next.toLowerCase()}` }), new RegExp(esc(whole), "g"), out);
  }

  // 1b. Missing apostrophe: "je m appelle" → "je m'appelle", "l ami" → "l'ami"
  for (const m of text.matchAll(/(?<![\p{L}'’])([jmtsnlcd]|qu)\s+([\p{L}]+)/giu)) {
    if (!VOWEL_START.test(m[2])) continue;
    const out = `${m[1]}'${m[2]}`;
    push(corr(m[0], out, "spelling", `“${m[1].toLowerCase()}” on its own is the shortened form of a word, so it needs an apostrophe: ${out}.`, `अकेला “${m[1].toLowerCase()}” किसी शब्द का छोटा रूप है, इसलिए apostrophe ज़रूरी है: ${out}।`, { prompt: `Add the apostrophe: ${m[0].toLowerCase()}`, answer: out.toLowerCase() }), new RegExp(`(?<![\\p{L}'’])${esc(m[0])}`, "gu"), out);
  }

  // 2. Contractions: de le → du, de les → des, à le → au, à les → aux
  // \b does not treat "à" as a letter, so word edges are written with Unicode lookarounds.
  const CONTR: [RegExp, string, string][] = [[/(?<!\p{L})de le(?!\p{L})/giu, "du", "de + le"], [/(?<!\p{L})de les(?!\p{L})/giu, "des", "de + les"], [/(?<!\p{L})(à|a) le(?!\p{L})/giu, "au", "à + le"], [/(?<!\p{L})(à|a) les(?!\p{L})/giu, "aux", "à + les"]];
  for (const [re, out, rule] of CONTR) {
    for (const m of text.matchAll(re)) {
      const after = text.slice((m.index ?? 0) + m[0].length).match(/^\s+(\p{L}+)/u)?.[1] ?? "";
      if (VOWEL_START.test(after) && !H_ASPIRE.has(after.toLowerCase())) continue; // de l'… is already elision territory
      push(corr(m[0], capFirst(m[0], out), "grammar",
        `${rule} always combines into “${out}”.`, `${rule} हमेशा मिलकर “${out}” बन जाता है।`,
        { prompt: `Combine: ${rule}`, answer: out }), new RegExp(`(?<!\\p{L})${esc(m[0])}(?!\\p{L})`, "gu"), capFirst(m[0], out));
    }
  }

  // 3. Age uses avoir: je suis 25 ans → j'ai 25 ans
  for (const m of text.matchAll(/\b(je suis|tu es|il est|elle est)\s+(\d+|[\p{L}-]+)\s+ans\b/giu)) {
    const map: Record<string, string> = { "je suis": "j'ai", "tu es": "tu as", "il est": "il a", "elle est": "elle a" };
    const out = `${capFirst(m[1], map[m[1].toLowerCase()])} ${m[2]} ans`;
    push(corr(m[0], out, "vocabulary",
      "In French you “have” your age: avoir + number + ans (not être, unlike English “I am 25”).",
      "फ़्रेंच में उम्र “होती” नहीं, “रखते” हैं: avoir + संख्या + ans (हिंदी की तरह “मेरी उम्र 25 है” नहीं, “j'ai 25 ans”)।",
      { prompt: "Say “I am 30 years old” in French.", answer: "j'ai 30 ans" }), new RegExp(esc(m[0]), "g"), out);
  }

  // 4. être / avoir agreement with the subject
  for (const m of text.matchAll(/\b(je|j'|tu|il|elle|on|nous|vous|ils|elles)\s*\b(\p{L}+)/giu)) {
    const subj = m[1].toLowerCase().replace("'", "");
    const verb = stripAccents(m[2].toLowerCase());
    const right = BE_HAVE[subj === "j" ? "je" : subj]?.[verb];
    if (!right) continue;
    if (subj === "je" || subj === "j") {
      const out = right === "ai" ? "j'ai" : `je ${right}`;
      push(corr(m[0], capFirst(m[0], out), "agreement", `With “je” the verb form is “${out}”.`, `“je” के साथ क्रिया का रूप “${out}” होता है।`, { prompt: `Complete: ___ (${right === "ai" ? "avoir" : "être"}, je)`, answer: out }), new RegExp(esc(m[0]), "g"), capFirst(m[0], out));
    } else {
      const out = `${m[1]} ${right}`;
      const inf = ["suis", "es", "est", "sommes", "êtes", "sont"].includes(right) ? "être" : "avoir";
      push(corr(m[0], out, "agreement", `The verb must match the subject: ${m[1].toLowerCase()} ${right} (${inf}).`, `क्रिया कर्ता से मेल खानी चाहिए: ${m[1].toLowerCase()} ${right} (${inf})।`, { prompt: `Complete with ${inf}: ${m[1].toLowerCase()} ___`, answer: right }), new RegExp(esc(m[0]), "g"), out);
    }
  }

  // 5. Article gender for nouns the dictionary knows (un/une, le/la, mon/ma …)
  const ART: Record<string, { m: string; f: string }> = { un: { m: "un", f: "une" }, une: { m: "un", f: "une" }, le: { m: "le", f: "la" }, la: { m: "le", f: "la" }, mon: { m: "mon", f: "ma" }, ma: { m: "mon", f: "ma" }, ton: { m: "ton", f: "ta" }, ta: { m: "ton", f: "ta" }, son: { m: "son", f: "sa" }, sa: { m: "son", f: "sa" }, ce: { m: "ce", f: "cette" }, cette: { m: "ce", f: "cette" } };
  for (const m of text.matchAll(/\b(un|une|le|la|mon|ma|ton|ta|son|sa|ce|cette)\s+(\p{L}+)/giu)) {
    const art = m[1].toLowerCase(), noun = m[2].toLowerCase();
    const g = gender.get(noun);
    if (!g || g === "mf") continue;
    if (VOWEL_START.test(noun) && ["ma", "ta", "sa", "le", "la"].includes(art)) continue; // mon amie: possessive switches before a vowel
    const want = ART[art][g];
    if (want === art) continue;
    const out = `${capFirst(m[1], want)} ${m[2]}`;
    push(corr(m[0], out, "gender", `“${noun}” is ${g === "m" ? "masculine" : "feminine"}, so it takes “${want}”. Learn nouns with their article.`, `“${noun}” ${g === "m" ? "पुल्लिंग (masculine)" : "स्त्रीलिंग (feminine)"} है, इसलिए “${want}” लगेगा। संज्ञा हमेशा article के साथ याद करें।`, { prompt: `Article: ___ ${noun} (${art === "un" || art === "une" ? "a/an" : "the / my / this"})`, answer: want }), new RegExp(esc(m[0]), "g"), out);
  }

  // 6. Missing accents on words the dictionary knows only with accents
  for (const m of text.matchAll(/\p{L}+/gu)) {
    const w = m[0], lw = w.toLowerCase();
    if (lw !== stripAccents(lw) || lw.length < 3) continue;
    const forms = byBare.get(lw);
    if (!forms || forms.has(lw)) continue;
    const accented = [...forms].filter((f) => f !== lw);
    if (accented.length !== 1) continue;
    const out = capFirst(w, accented[0]);
    push(corr(w, out, "spelling", `Accents are part of the spelling: “${accented[0]}”. On the exam a missing accent counts as a spelling mistake.`, `Accent वर्तनी का हिस्सा है: “${accented[0]}”। परीक्षा में accent छूटना वर्तनी की ग़लती मानी जाती है।`, { prompt: `Write with the correct accents: ${lw}`, answer: accented[0] }), new RegExp(`(?<![\\p{L}])${esc(w)}(?![\\p{L}])`, "gu"), out);
  }

  // 7. Sentence capital and final punctuation (style, not errors)
  const trimmed = text.trim();
  if (trimmed && /^\p{Ll}/u.test(trimmed)) push(corr(trimmed.split(/\s+/)[0], trimmed.split(/\s+/)[0].replace(/^\p{Ll}/u, (c) => c.toUpperCase()), "organization", "Start the first sentence with a capital letter.", "पहला वाक्य बड़े अक्षर (capital) से शुरू करें।", { prompt: "Capitalise: bonjour, je m'appelle Ana.", answer: "Bonjour, je m'appelle Ana." }, false));
  if (trimmed && !/[.!?…»)]$/.test(trimmed)) { const tail = trimmed.split(/\s+/).slice(-3).join(" ");
    push(corr(tail, `${tail}.`, "organization", "End your text with a full stop.", "पाठ को पूर्णविराम (.) से ख़त्म करें।", { prompt: "Add the final punctuation: Je suis étudiant", answer: "Je suis étudiant." }, false)); fixed = fixed.trimEnd() + "."; }

  // capitals at sentence starts in the corrected text (fixes above may have lowercased one)
  fixed = fixed.replace(/(^\s*|[.!?]\s+)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase());

  const wc = wordCount(text);
  const taskNotes: string[] = [];
  if (o.minWords && wc < o.minWords) taskNotes.push(`${wc} words — the task asks for at least ${o.minWords}.`);
  else if (o.minWords) taskNotes.push(`${wc} words (minimum ${o.minWords}) ✓`);
  taskNotes.push("This checker cannot judge meaning, word order, task completion or tone. Compare with the model answer.");

  const errors = corrections.filter((c) => c.isError).length;
  return {
    summary: {
      en: errors ? `The rule checker found ${errors} likely error${errors > 1 ? "s" : ""} from its list of common beginner mistakes.` : "The rule checker found none of the common beginner mistakes it looks for. That does not mean the text is error-free.",
      hi: errors ? `नियम-आधारित जाँच ने आम ग़लतियों की सूची में से ${errors} संभावित ग़लती${errors > 1 ? "याँ" : ""} पाईं।` : "नियम-आधारित जाँच को अपनी सूची की कोई आम ग़लती नहीं मिली। इसका मतलब यह नहीं कि पाठ बिल्कुल सही है।",
    },
    strengths: wc >= (o.minWords ?? 1) ? ["You met the word count."] : [],
    corrections,
    correctedText: fixed,
    taskNotes,
  };
}
