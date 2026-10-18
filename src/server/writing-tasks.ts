import "server-only";
import { allLessons, getMocks } from "./content";

type Bi = { en: string; hi: string };
export type StudioTask = {
  id: string; group: "lesson" | "free" | "tef_a" | "tef_b"; title: string; taskType: string; prompt: Bi & { fr?: string }; minWords: number; maxWords?: number; timeLimitSec?: number;
  stimulus?: string; day?: number;
  learn?: { hints: Bi[]; phrases: { fr: string; en: string; hi: string; pron?: string }[]; model?: { fr: string; en: string }; checklist?: Bi[]; outline?: Bi[] };
};

const TEF_A_OUTLINE: Bi[] = [
  { en: "Continue the story in the same tense and style as the article (passé composé + imparfait).", hi: "कहानी को लेख के ही काल और शैली में आगे बढ़ाइए (passé composé + imparfait)।" },
  { en: "Answer: what happened next, who reacted, how it ended.", hi: "बताइए: आगे क्या हुआ, किसने क्या किया, अंत कैसे हुआ।" },
  { en: "Use time connectors: ensuite, tout à coup, finalement.", hi: "समय बताने वाले शब्द: ensuite, tout à coup, finalement।" },
  { en: "At least 80 words. Leave 3 minutes to reread accents and agreements.", hi: "कम से कम 80 शब्द। accent और agreement जाँचने के लिए 3 मिनट रखिए।" },
];
const TEF_B_OUTLINE: Bi[] = [
  { en: "Introduction: restate the opinion and say whether you agree.", hi: "भूमिका: राय दोहराइए और बताइए कि आप सहमत हैं या नहीं।" },
  { en: "Three arguments, each in its own paragraph, with an example.", hi: "तीन तर्क, हर एक अलग अनुच्छेद में, उदाहरण के साथ।" },
  { en: "Connectors: d'abord, de plus, enfin, par contre, c'est pourquoi.", hi: "जोड़ने वाले शब्द: d'abord, de plus, enfin, par contre, c'est pourquoi।" },
  { en: "Conclusion that sums up your position. At least 200 words.", hi: "निष्कर्ष जो आपकी राय को समेटे। कम से कम 200 शब्द।" },
];
const ARG_PHRASES = [
  { fr: "À mon avis, …", en: "In my opinion, …", hi: "मेरी राय में, …" },
  { fr: "D'abord, … Ensuite, … Enfin, …", en: "First, … Next, … Finally, …", hi: "पहले, … फिर, … आख़िर में, …" },
  { fr: "Par exemple, …", en: "For example, …", hi: "उदाहरण के लिए, …" },
  { fr: "Certes, … mais …", en: "Admittedly, … but …", hi: "माना कि, … लेकिन …" },
  { fr: "C'est pourquoi je pense que …", en: "That is why I think that …", hi: "इसीलिए मुझे लगता है कि …" },
];

const FREE: StudioTask[] = [
  { id: "free-email-landlord", group: "free", title: "Email to a landlord", taskType: "email", minWords: 60, maxWords: 120,
    prompt: { en: "Write an email to your landlord: the heating in your flat doesn't work. Describe the problem, since when, and ask for a repair date.", hi: "अपने मकान-मालिक को ईमेल लिखिए: आपके फ़्लैट का हीटिंग काम नहीं कर रहा। समस्या, कब से, और मरम्मत की तारीख़ पूछिए।" },
    learn: { hints: [{ en: "Start with Madame, Monsieur, and end with Cordialement.", hi: "Madame, Monsieur से शुरू कीजिए और Cordialement से ख़त्म।" }], phrases: [{ fr: "Je vous écris parce que …", en: "I am writing because …", hi: "मैं आपको इसलिए लिख रहा/रही हूँ क्योंकि …" }, { fr: "depuis lundi", en: "since Monday", hi: "सोमवार से" }, { fr: "Pourriez-vous …?", en: "Could you …?", hi: "क्या आप … सकते हैं?" }] } },
  { id: "free-email-employer", group: "free", title: "Email asking for a day off", taskType: "email", minWords: 60, maxWords: 120,
    prompt: { en: "Write to your manager to ask for a day off next Friday. Give the reason and propose how your work will be covered.", hi: "अपने मैनेजर को अगले शुक्रवार की छुट्टी के लिए लिखिए। कारण बताइए और यह भी कि आपका काम कैसे होगा।" },
    learn: { hints: [{ en: "Use vous and the conditional to be polite (je voudrais, pourriez-vous).", hi: "शिष्टता के लिए vous और conditional (je voudrais, pourriez-vous) इस्तेमाल कीजिए।" }], phrases: [{ fr: "Je voudrais vous demander …", en: "I would like to ask you …", hi: "मैं आपसे … माँगना चाहूँगा/चाहूँगी" }, { fr: "un jour de congé", en: "a day off", hi: "एक दिन की छुट्टी" }, { fr: "Mon collègue pourra …", en: "My colleague will be able to …", hi: "मेरे सहकर्मी … कर सकेंगे" }] } },
  { id: "free-paragraph-city", group: "free", title: "Paragraph: my city", taskType: "paragraph", minWords: 80,
    prompt: { en: "Describe the city where you live: where it is, what there is to do, what you like and don't like.", hi: "जिस शहर में आप रहते हैं उसका वर्णन कीजिए: वह कहाँ है, वहाँ क्या कर सकते हैं, आपको क्या पसंद है और क्या नहीं।" },
    learn: { hints: [{ en: "Use il y a, on peut, j'aime / je n'aime pas, parce que.", hi: "il y a, on peut, j'aime / je n'aime pas, parce que इस्तेमाल कीजिए।" }], phrases: [{ fr: "Il y a beaucoup de …", en: "There are lots of …", hi: "बहुत सारे … हैं" }, { fr: "On peut …", en: "You can …", hi: "आप … सकते हैं" }] } },
  { id: "free-story-trip", group: "free", title: "Story: a trip", taskType: "story", minWords: 100,
    prompt: { en: "Tell the story of a trip you took, in the past: where, with whom, what happened, a problem you had.", hi: "अपनी किसी यात्रा की कहानी भूतकाल में लिखिए: कहाँ, किसके साथ, क्या हुआ, कोई समस्या जो आई।" },
    learn: { hints: [{ en: "Passé composé for events, imparfait for background (il faisait beau, j'étais fatigué).", hi: "घटनाओं के लिए passé composé, पृष्ठभूमि के लिए imparfait (il faisait beau, j'étais fatigué)।" }], phrases: [{ fr: "L'année dernière, …", en: "Last year, …", hi: "पिछले साल, …" }, { fr: "Tout à coup, …", en: "Suddenly, …", hi: "अचानक, …" }] } },
];

export async function studioTasks(): Promise<StudioTask[]> {
  const lessons = [...(await allLessons()).values()].map((l) => l.day).sort((a, b) => a.day - b.day);
  const fromLessons: StudioTask[] = lessons.map((d) => ({
    id: `day-${d.day}`, group: "lesson", day: d.day, title: `Day ${d.day}: ${d.title.en}`, taskType: d.writing.type, prompt: d.writing.prompt, minWords: d.writing.minWords, maxWords: d.writing.maxWords,
    learn: { hints: d.writing.hints, phrases: d.writing.usefulPhrases, model: d.writing.model, checklist: d.writing.checklist },
  }));
  const tef = getMocks().flatMap((m): StudioTask[] => [
    { id: `tef-a-${m.id}`, group: "tef_a", title: `TEF A · ${m.title}`, taskType: "article_continuation", prompt: { ...m.writing.a.instruction }, stimulus: m.writing.a.articleStart, minWords: 80, timeLimitSec: 25 * 60,
      learn: { hints: [], phrases: [{ fr: "Quelques minutes plus tard, …", en: "A few minutes later, …", hi: "कुछ मिनट बाद, …" }, { fr: "Heureusement, …", en: "Fortunately, …", hi: "सौभाग्य से, …" }, { fr: "Finalement, …", en: "In the end, …", hi: "आख़िरकार, …" }], outline: TEF_A_OUTLINE } },
    { id: `tef-b-${m.id}`, group: "tef_b", title: `TEF B · ${m.title}`, taskType: "opinion_letter", prompt: { ...m.writing.b.instruction }, stimulus: m.writing.b.statement, minWords: 200, timeLimitSec: 35 * 60,
      learn: { hints: [], phrases: ARG_PHRASES, outline: TEF_B_OUTLINE } },
  ]);
  return [...FREE, ...tef, ...fromLessons];
}
