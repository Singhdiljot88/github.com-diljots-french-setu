import { stripAccents } from "./text";

/** A real grammar or vocabulary fix for a short spoken turn. Capitals and full stops are not fixes. */
export type SpokenFix = { original: string; corrected: string; en: string; hi: string; category: "grammar" | "vocabulary" };

const norm = (s: string) => stripAccents(s.toLowerCase()).replace(/[^a-z'\s]/g, " ").replace(/\s+/g, " ").trim();

/** Repairs a learner would want to hear, including "je bien" and the non-word "montague". */
export function spokenFixes(text: string): SpokenFix[] {
  const raw = text.trim();
  const n = norm(raw);
  if (!n) return [];
  const out: SpokenFix[] = [];
  const mountain = /\bmontague\b|\bmontagu\b|\bmontain\b/.test(n);
  if (/\bje bien\b/.test(n) && !/\b(vais|va|suis|me sens) bien\b/.test(n)) {
    out.push({
      original: raw,
      corrected: "Je vais bien.",
      category: "grammar",
      en: mountain
        ? "“I am well” needs aller: je vais bien. “Je bien” has no verb. “Montague” is not a French word (the mountain is la montagne). If you were giving your name, say Je m'appelle … ."
        : "“I am well” needs the verb aller: je vais bien. “Je bien” has no verb, so it is not a sentence.",
      hi: mountain
        ? "“मैं ठीक हूँ” के लिए aller चाहिए: je vais bien। “Je bien” में क्रिया नहीं है। “Montague” फ़्रेंच शब्द नहीं है (पहाड़ के लिए la montagne)। अगर आप अपना नाम बता रहे थे, तो Je m'appelle … कहिए।"
        : "“मैं ठीक हूँ” के लिए क्रिया aller चाहिए: je vais bien। “Je bien” में क्रिया नहीं है, इसलिए यह वाक्य नहीं है।",
    });
  }
  if (mountain) {
    out.push({
      original: "montague",
      corrected: "la montagne",
      category: "vocabulary",
      en: "“Montague” is not a French word. The mountain is la montagne. A name is Je m'appelle … .",
      hi: "“Montague” फ़्रेंच शब्द नहीं है। पहाड़ के लिए la montagne कहते हैं। नाम के लिए Je m'appelle … कहते हैं।",
    });
  }
  if (/\bje suis\b/.test(n) && /\bans\b/.test(n)) {
    out.push({
      original: raw,
      corrected: raw.replace(/je suis/i, "j'ai"),
      category: "grammar",
      en: "Age uses avoir, not être: j'ai 30 ans, not je suis 30 ans.",
      hi: "उम्र avoir से बनती है, être से नहीं: j'ai 30 ans, je suis 30 ans नहीं।",
    });
  }
  return out;
}

/** The sentence to show as a clearer version of a short spoken turn. */
export function spokenRecast(text: string): string | undefined {
  const fixes = spokenFixes(text);
  return fixes.find((f) => /[.!?…]/.test(f.corrected))?.corrected ?? fixes[0]?.corrected;
}

/** A short French reaction the scripted partner can say before its next question. */
export function spokenReaction(text: string): string | null {
  const n = norm(text);
  const bits: string[] = [];
  if (/\bje bien\b|\bje vais bien\b|\bca va\b/.test(n)) bits.push("Ah, tu vas bien, tant mieux !");
  if (/\bmontag/.test(n)) bits.push("Tu parles de la montagne ?");
  if (/\bappelle\b/.test(n) || /\bje m\b/.test(n)) bits.push("Enchanté !");
  if (!bits.length && /^(hi|hello|hey|bonjour|salut)\b/.test(n)) bits.push("Bonjour !");
  return bits.length ? bits.join(" ") : null;
}
