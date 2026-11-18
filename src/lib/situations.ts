import type { Day } from "@/content/schema";

export type PhraseLine = {
  fr: string;
  en: string;
  hi: string;
  pron?: string;
  day: number;
  source: "phrase" | "speaking" | "writing";
};

export type Situation = {
  id: string;
  icon: string;
  days: number[];
  title: { en: string; hi: string };
  blurb: { en: string; hi: string };
  lines: PhraseLine[];
};

const DEFS: Omit<Situation, "lines">[] = [
  { id: "hello", icon: "👋", days: [1, 3, 4, 7], title: { en: "Hello and introductions", hi: "नमस्ते और परिचय" }, blurb: { en: "Names, how you are, and a first conversation.", hi: "नाम, हालचाल, और पहली बातचीत।" } },
  { id: "cafe", icon: "☕", days: [19, 24], title: { en: "Café and food", hi: "कैफ़े और खाना" }, blurb: { en: "Order, talk about meals, and say what you eat.", hi: "ऑर्डर करें, भोजन की बात करें, और बताएँ आप क्या खाते हैं।" } },
  { id: "shop", icon: "🛒", days: [25, 26], title: { en: "Shopping", hi: "ख़रीदारी" }, blurb: { en: "Prices, quantities, sizes and colours.", hi: "दाम, मात्रा, साइज़ और रंग।" } },
  { id: "home", icon: "🏠", days: [23, 27, 39], title: { en: "Home and messages", hi: "घर और संदेश" }, blurb: { en: "A flat, a daily routine, and a short email.", hi: "फ़्लैट, दिनचर्या, और एक छोटा ईमेल।" } },
  { id: "city", icon: "🚇", days: [15, 16, 29, 33], title: { en: "Getting around", hi: "इधर-उधर जाना" }, blurb: { en: "Time, places, directions and the weather.", hi: "समय, जगहें, रास्ता और मौसम।" } },
  { id: "health", icon: "🩺", days: [36, 37], title: { en: "Health and appointments", hi: "सेहत और अपॉइंटमेंट" }, blurb: { en: "Symptoms, the pharmacy, and booking a time.", hi: "लक्षण, दवाख़ाना, और समय लेना।" } },
  { id: "work", icon: "💼", days: [30, 32], title: { en: "Work", hi: "काम" }, blurb: { en: "Jobs, permission and what you have to do.", hi: "नौकरी, अनुमति, और जो करना ज़रूरी है।" } },
  { id: "plans", icon: "🎯", days: [55, 59, 65], title: { en: "Plans and polite requests", hi: "योजना और विनम्र अनुरोध" }, blurb: { en: "Goals, questions about an ad, and je voudrais.", hi: "लक्ष्य, विज्ञापन के सवाल, और je voudrais।" } },
];

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Phrases already written in the lessons, grouped for a real situation. No new French is invented here. */
export function buildPhrasebook(days: Day[]): Situation[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  return DEFS.map((def) => {
    const lines: PhraseLine[] = [];
    const seen = new Set<string>();
    const add = (day: number, source: PhraseLine["source"], fr: string, en: string, hi: string, pron?: string) => {
      const k = norm(fr);
      if (!k || k.length > 180 || seen.has(k)) return;
      seen.add(k);
      lines.push({ fr: fr.trim(), en, hi, pron, day, source });
    };
    for (const n of def.days) {
      const d = byDay.get(n);
      if (!d) continue;
      for (const p of d.phrases) add(n, "phrase", p.fr, p.en, p.hi, p.pron);
      for (const p of d.speaking.prompts) add(n, "speaking", p.fr, p.en, p.hi, p.pron);
      for (const p of d.writing.usefulPhrases) add(n, "writing", p.fr, p.en, p.hi, p.pron);
    }
    return { ...def, lines: lines.slice(0, 16) };
  });
}
