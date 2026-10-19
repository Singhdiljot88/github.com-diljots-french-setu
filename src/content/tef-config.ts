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
      hi: "पढ़ना (पठन)",
      tip: { en: "Examiners reward reading the question first, then finding the exact line that answers it.", hi: "पहले प्रश्न पढ़ें, फिर पाठ में वह पंक्ति खोजें जो ठीक उसी का उत्तर देती है।" },
      minutes: 60,
      questions: 40,
      rules: [
        { text: "40 multiple-choice questions in 60 minutes.", hi: "60 मिनट में 40 बहुविकल्पीय प्रश्न।", source: "official" as Confidence },
        { text: "You can move between questions and change answers until time runs out.", hi: "समय ख़त्म होने तक आप प्रश्नों के बीच आगे-पीछे जा सकते हैं और उत्तर बदल सकते हैं।", source: "prep-guides" as Confidence },
      ],
    },
    listening: {
      title: "Compréhension orale",
      en: "Listening",
      hi: "सुनना (श्रवण)",
      tip: { en: "Read the question and options before the recording starts, so you know what to listen for.", hi: "रिकॉर्डिंग शुरू होने से पहले प्रश्न और विकल्प पढ़ लें, ताकि पता हो कि क्या सुनना है।" },
      minutes: 40,
      questions: 40,
      rules: [
        { text: "40 multiple-choice questions in 40 minutes.", hi: "40 मिनट में 40 बहुविकल्पीय प्रश्न।", source: "official" as Confidence },
        { text: "The test moves from one recording to the next and you cannot go back.", hi: "परीक्षा एक रिकॉर्डिंग से अगली पर जाती है और आप पीछे नहीं जा सकते।", source: "official" as Confidence },
        { text: "Each recording is played once.", hi: "हर रिकॉर्डिंग एक ही बार चलती है।", source: "prep-guides" as Confidence },
      ],
    },
    writing: {
      title: "Expression écrite",
      en: "Writing",
      hi: "लिखना (लेखन)",
      tip: { en: "Examiners reward clear structure, linking words and an answer to every part of the task.", hi: "परीक्षक साफ़ ढाँचा, जोड़ने वाले शब्द और काम के हर हिस्से का उत्तर देखते हैं।" },
      minutes: 60,
      tasks: {
        a: { title: "Section A: continue a news story", titleHi: "खंड A: एक समाचार को आगे लिखें", minWords: 80 },
        b: { title: "Section B: give and defend your opinion", titleHi: "खंड B: अपनी राय दें और उसका समर्थन करें", minWords: 200 },
      },
      rules: [
        { text: "Two tasks in 60 minutes in total.", hi: "कुल 60 मिनट में दो काम।", source: "official" as Confidence },
        { text: "Section A asks for at least 80 words, section B for at least 200.", hi: "खंड A में कम से कम 80 शब्द और खंड B में कम से कम 200 शब्द लिखने होते हैं।", source: "prep-guides" as Confidence },
      ],
    },
    speaking: {
      title: "Expression orale",
      en: "Speaking",
      hi: "बोलना (मौखिक)",
      tip: { en: "Keep the conversation going: ask follow-up questions and give reasons for your opinion.", hi: "बातचीत चलाते रहें: आगे के प्रश्न पूछें और अपनी राय के कारण बताएँ।" },
      minutes: 15,
      tasks: {
        a: { title: "Section A: get information", titleHi: "खंड A: जानकारी लें", minutes: 5 },
        b: { title: "Section B: present a document and convince", titleHi: "खंड B: एक दस्तावेज़ प्रस्तुत करें और राज़ी करें", minutes: 10 },
      },
      rules: [
        { text: "Two tasks in 15 minutes in total: section A, getting information, and section B, presenting and convincing.", hi: "कुल 15 मिनट में दो काम: खंड A में जानकारी लेना, और खंड B में किसी बात को प्रस्तुत करके सामने वाले को राज़ी करना।", source: "official" as Confidence },
        { text: "Section A lasts about 5 minutes and section B about 10.", hi: "खंड A लगभग 5 मिनट और खंड B लगभग 10 मिनट का होता है।", source: "prep-guides" as Confidence },
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
