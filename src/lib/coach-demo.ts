/** Labelled non-AI fallbacks. None of these invent a TEF, CEFR or NCLC score. */

export const DEMO_LABEL = {
  en: "Not AI. Built from your lesson text and saved mistakes. This is not an official TEF, CEFR or NCLC score.",
  hi: "यह AI नहीं है। आपके पाठ और सहेजी ग़लतियों से बना है। यह आधिकारिक TEF, CEFR या NCLC अंक नहीं है।",
};
export const AI_LABEL = {
  en: "AI help. Check anything that looks wrong. This is not an official TEF, CEFR or NCLC score.",
  hi: "AI मदद। जो ग़लत लगे उसे जाँचें। यह आधिकारिक TEF, CEFR या NCLC अंक नहीं है।",
};

export type ExplainResult = { focus: string; en: string; hi: string };

export function demoExplain(input: { fr: string; en?: string; hi?: string }): ExplainResult {
  const focus = input.fr.trim().slice(0, 80);
  const en = input.en?.trim()
    ? `“${focus}” means: ${input.en.trim()}. Read it aloud, then check the grammar box of the lesson it came from.`
    : `Read “${focus}” aloud. Look up any word you don’t know in the dictionary, then try saying the whole line.`;
  const hi = input.hi?.trim()
    ? `“${focus}” का अर्थ: ${input.hi.trim()}। इसे ज़ोर से पढ़ें, फिर उसी पाठ का व्याकरण बॉक्स देखें।`
    : `“${focus}” को ज़ोर से पढ़ें। जो शब्द नया हो उसे शब्दकोश में देखें, फिर पूरी पंक्ति बोलें।`;
  return { focus, en, hi };
}

export type PracticeItem = { promptEn: string; promptHi: string; sentence: string; answer: string; whyEn: string; whyHi: string };

export function demoDrills(mistakes: { original: string; corrected: string; explanation: { en: string; hi?: string }; drill: { prompt: string; answer: string } | null }[]): PracticeItem[] {
  return mistakes.slice(0, 5).map((m) => ({
    promptEn: m.drill?.prompt || `Rewrite this correctly: ${m.original}`,
    promptHi: "इसे सही करके लिखें।",
    sentence: m.original,
    answer: m.drill?.answer || m.corrected,
    whyEn: m.explanation.en,
    whyHi: m.explanation.hi || "यह आपकी सहेजी गई ग़लती है।",
  }));
}

export type Scene = { openingFr: string; openingEn: string; openingHi: string; goalEn: string; goalHi: string; prompts: { fr: string; en: string; hi: string }[] };

export function demoScene(situation: { title: { en: string; hi: string }; blurb: { en: string; hi: string }; lines: { fr: string; en: string; hi: string }[] }): Scene {
  const prompts = situation.lines.slice(0, 4).map((l) => ({ fr: l.fr, en: l.en, hi: l.hi }));
  const first = prompts[0];
  return {
    openingFr: first?.fr ?? "Bonjour !",
    openingEn: first?.en ?? situation.blurb.en,
    openingHi: first?.hi ?? situation.blurb.hi,
    goalEn: situation.blurb.en,
    goalHi: situation.blurb.hi,
    prompts: prompts.length ? prompts : [{ fr: "Bonjour !", en: "Hello!", hi: "नमस्ते!" }],
  };
}
