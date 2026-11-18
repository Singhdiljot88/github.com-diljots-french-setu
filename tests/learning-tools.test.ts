import { describe, expect, it } from "vitest";
import { loadDaysFromDisk, loadDictionaryFromDisk } from "@/content/load";
import { filterGrammar, toGrammarPoints } from "@/lib/grammar-ref";
import { buildPhrasebook } from "@/lib/situations";
import { buildDrill, gradeDrill, renderAnswer, resolveDrillVerbs, type SubjectSpec } from "@/lib/verb-drill";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { aiProvider } from "@/server/providers/config";

const elle: SubjectSpec = { id: "elle", personIndex: 2, pronoun: "elle", fr: "elle", en: "she", hi: "वह", fem: true, plural: false };
const jeM: SubjectSpec = { id: "je-m", personIndex: 0, pronoun: "je", fr: "je", en: "I", hi: "मैं", fem: false, plural: false };
const nousM: SubjectSpec = { id: "nous-m", personIndex: 3, pronoun: "nous", fr: "nous", en: "we", hi: "हम", fem: false, plural: true };
const elles: SubjectSpec = { id: "elles", personIndex: 5, pronoun: "elles", fr: "elles", en: "they", hi: "वे", fem: true, plural: true };
const tu: SubjectSpec = { id: "tu", personIndex: 1, pronoun: "tu", fr: "tu", en: "you", hi: "tu", fem: false, plural: false };

describe("grammar reference", () => {
  const points = toGrammarPoints(loadDaysFromDisk().map((d) => d.day));
  it("has one point per lesson", () => {
    expect(points).toHaveLength(120);
    expect(points[0].day).toBe(1);
    expect(points[40].day).toBe(41);
  });
  it("finds the passé composé lesson in French or English", () => {
    const hit = filterGrammar(points, { q: "passe compose", phase: 0, maxDay: null });
    expect(hit.some((p) => p.day === 41)).toBe(true);
  });
  it("hides later days when the learner has not reached them", () => {
    const early = filterGrammar(points, { q: "", phase: 0, maxDay: 10 });
    expect(early.every((p) => p.day <= 10)).toBe(true);
    expect(early.length).toBe(10);
  });
});

describe("verb drill", () => {
  const verbs = resolveDrillVerbs(loadDictionaryFromDisk().entries);
  const verb = (lemma: string) => verbs.find((v) => v.lemma === lemma)!;
  it("loads the everyday verbs from the dictionary", () => {
    for (const lemma of ["être", "avoir", "parler", "aller", "finir", "se lever", "prendre"]) expect(verb(lemma)).toBeTruthy();
  });
  it("builds the passé composé with être agreement", () => {
    const aller = verb("aller");
    expect(renderAnswer(aller.lemma, aller.verb, "passe_compose", jeM)).toBe("je suis allé");
    expect(renderAnswer(aller.lemma, aller.verb, "passe_compose", elle)).toBe("elle est allée");
    expect(renderAnswer(aller.lemma, aller.verb, "passe_compose", nousM)).toBe("nous sommes allés");
    expect(renderAnswer(aller.lemma, aller.verb, "passe_compose", elles)).toBe("elles sont allées");
  });
  it("elides je and keeps regular endings", () => {
    expect(renderAnswer(verb("parler").lemma, verb("parler").verb, "present", jeM)).toBe("je parle");
    expect(renderAnswer(verb("parler").lemma, verb("parler").verb, "present", tu)).toBe("tu parles");
    expect(renderAnswer(verb("habiter").lemma, verb("habiter").verb, "present", jeM)).toBe("j'habite");
    expect(renderAnswer(verb("être").lemma, verb("être").verb, "present", jeM)).toBe("je suis");
    expect(renderAnswer(verb("avoir").lemma, verb("avoir").verb, "present", jeM)).toBe("j'ai");
    expect(renderAnswer(verb("finir").lemma, verb("finir").verb, "present", tu)).toBe("tu finis");
  });
  it("agrees a pronominal verb and forms the subjunctive of être", () => {
    const lever = verb("se lever");
    expect(renderAnswer(lever.lemma, lever.verb, "passe_compose", elle)).toBe("elle s'est levée");
    expect(renderAnswer(verb("être").lemma, verb("être").verb, "subjonctif", jeM)).toBe("que je sois");
  });
  it("explains an elision miss and accepts an accent-only slip", () => {
    const q = buildDrill({ verbs, courseDay: 20, preview: false, count: 1, seed: 2, tense: "present", lemma: "habiter" })[0];
    expect(q.answer.startsWith("j'") || q.answer.startsWith("je ") || q.answer.startsWith("tu ") || q.answer.startsWith("il ") || q.answer.startsWith("elle ") || q.answer.startsWith("nous ") || q.answer.startsWith("vous ") || q.answer.startsWith("ils ") || q.answer.startsWith("elles ")).toBe(true);
    const parler = buildDrill({ verbs, courseDay: 20, preview: false, count: 8, seed: 3, tense: "present", lemma: "parler" });
    const je = parler.find((item) => item.subject.pronoun === "je")!;
    expect(gradeDrill("je parle", { ...je, answer: "je parle" }).result).toBe("correct");
    expect(gradeDrill("je habite", { ...je, answer: "j'habite", lemma: "habiter" }).result).toBe("wrong");
    expect(gradeDrill("je prefere", { ...je, answer: "je préfère", lemma: "préférer" }).feedback.en).toMatch(/accent/i);
  });
  it("does not offer the passé composé before day 41", () => {
    const early = buildDrill({ verbs, courseDay: 20, preview: false, count: 8, seed: 4, tense: "mix" });
    expect(early.every((q) => q.tense === "present")).toBe(true);
    const later = buildDrill({ verbs, courseDay: 50, preview: false, count: 8, seed: 5, tense: "passe_compose", lemma: "aller" });
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((q) => q.tense === "passe_compose")).toBe(true);
  });
});

describe("phrasebook", () => {
  const book = buildPhrasebook(loadDaysFromDisk().map((d) => d.day));
  it("groups real lesson phrases and does not invent empty sections", () => {
    expect(book.length).toBeGreaterThanOrEqual(8);
    for (const s of book) {
      expect(s.lines.length).toBeGreaterThan(3);
      expect(s.lines.every((l) => l.fr && l.en && l.hi)).toBe(true);
    }
  });
});

describe("sign-in rate limit", () => {
  it("allows a burst and then refuses", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(rateLimit("t", 3, 1000, 0).ok).toBe(true);
    expect(rateLimit("t", 3, 1000, 0).ok).toBe(false);
    expect(rateLimit("t", 3, 1000, 1000).ok).toBe(true);
  });
});

describe("OpenAI provider selection", () => {
  it("reads the existing OPENAI_API_KEY and stays in demo mode when it is empty", () => {
    const key = process.env.OPENAI_API_KEY;
    const provider = process.env.AI_PROVIDER;
    try {
      delete process.env.AI_PROVIDER;
      delete process.env.OPENAI_API_KEY;
      expect(aiProvider()).toBe("demo");
      process.env.OPENAI_API_KEY = "sk-already-set";
      expect(aiProvider()).toBe("openai");
      process.env.AI_PROVIDER = "demo";
      expect(aiProvider()).toBe("demo");
    } finally {
      if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key;
      if (provider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = provider;
    }
  });
});
