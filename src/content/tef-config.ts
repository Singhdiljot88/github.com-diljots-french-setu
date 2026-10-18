/**
 * TEF Canada test format used by the mock simulator.
 *
 * Keep this file as the single place that states exam rules, so it can be updated when the
 * official format changes. Each rule says where it came from. Nothing here maps a raw practice
 * score to a TEF score, CEFR level or NCLC/CLB level, and nothing should.
 */
export type Confidence = "official" | "prep-guides";

export type SectionKey = "reading" | "listening" | "writing" | "speaking";

export const TEF_CANADA = {
  variant: "tef_canada",
  version: "tef-canada-2026-10",
  /** Date the official handbook below was last read by the people who wrote this config. */
  checkedOn: "2026-10-18",
  sources: [
    {
      label: "Le français des affaires (CCI Paris Île-de-France), Livret du responsable TEF 2026, pages 5 and 26",
      url: "https://www.lefrancaisdesaffaires.fr/wp-content/uploads/2026/04/2026-livret-du-responsable-tef.pdf",
    },
  ],
  sections: {
    reading: {
      title: "Compréhension écrite",
      en: "Reading",
      minutes: 60,
      questions: 40,
      rules: [
        { text: "40 multiple-choice questions in 60 minutes.", source: "official" as Confidence },
        { text: "You can move between questions and change answers until time runs out.", source: "prep-guides" as Confidence },
      ],
    },
    listening: {
      title: "Compréhension orale",
      en: "Listening",
      minutes: 40,
      questions: 40,
      rules: [
        { text: "40 multiple-choice questions in 40 minutes.", source: "official" as Confidence },
        { text: "The test moves from one recording to the next and you cannot go back.", source: "official" as Confidence },
        { text: "Each recording is played once.", source: "prep-guides" as Confidence },
      ],
    },
    writing: {
      title: "Expression écrite",
      en: "Writing",
      minutes: 60,
      tasks: {
        a: { title: "Section A: continue a news story", minWords: 80 },
        b: { title: "Section B: give and defend your opinion", minWords: 200 },
      },
      rules: [
        { text: "Two tasks in 60 minutes in total.", source: "official" as Confidence },
        { text: "Section A asks for at least 80 words, section B for at least 200.", source: "prep-guides" as Confidence },
      ],
    },
    speaking: {
      title: "Expression orale",
      en: "Speaking",
      minutes: 15,
      tasks: {
        a: { title: "Section A: get information", minutes: 5 },
        b: { title: "Section B: present a document and convince", minutes: 10 },
      },
      rules: [
        { text: "Two tasks in 15 minutes in total: section A, getting information, and section B, presenting and convincing.", source: "official" as Confidence },
        { text: "Section A lasts about 5 minutes and section B about 10.", source: "prep-guides" as Confidence },
      ],
    },
  },
} as const;

export const SECTION_ORDER: SectionKey[] = ["reading", "listening", "writing", "speaking"];

export function sectionSeconds(key: SectionKey) {
  return TEF_CANADA.sections[key].minutes * 60;
}

/** Grace period for network delays before a section is closed on the server. */
export const GRACE_SECONDS = 5;
