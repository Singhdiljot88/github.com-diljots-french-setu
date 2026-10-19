import type { StudioTask } from "@/server/writing-tasks";

const FREE_HI: Record<string, string> = {
  "free-email-landlord": "मकान-मालिक को ईमेल",
  "free-email-employer": "छुट्टी माँगने का ईमेल",
  "free-paragraph-city": "अनुच्छेद: मेरा शहर",
  "free-story-trip": "कहानी: एक यात्रा",
};

/** English and Hindi title for a writing-studio task. `lessonHi` is the Hindi title of the lesson, for lesson tasks. */
export function taskTitle(t: StudioTask, lessonHi?: string): { en: string; hi: string } {
  if (t.group === "free") return { en: t.title, hi: FREE_HI[t.id] ?? t.title };
  if (t.group === "lesson") return { en: t.title, hi: `दिन ${t.day}: ${lessonHi ?? t.title.replace(/^Day \d+: /, "")}` };
  return { en: t.title, hi: t.title.replace(/Practice exam (\d+)/, "अभ्यास परीक्षा $1") };
}
