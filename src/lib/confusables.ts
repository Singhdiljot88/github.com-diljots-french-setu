/**
 * Faux amis (false friends) and other traps for English and Hindi speakers.
 * AI-drafted on 2026-11-15, editorial review pending (listed in docs/CONTENT_REVIEW_NOTES.md).
 */
export type Confusable = {
  fr: string;
  /** What an English speaker guesses */
  looksLike: string;
  /** What it really means */
  means: { en: string; hi: string };
  /** The French word for the thing the learner probably meant */
  insteadSay?: { fr: string; en: string };
  example: { fr: string; en: string };
  kind: "false_friend" | "sound_alike" | "gender_trap";
};

export const CONFUSABLES: Confusable[] = [
  { fr: "la librairie", looksLike: "library", means: { en: "bookshop", hi: "किताबों की दुकान" }, insteadSay: { fr: "la bibliothèque", en: "library" }, example: { fr: "J'achète un roman à la librairie.", en: "I buy a novel at the bookshop." }, kind: "false_friend" },
  { fr: "actuellement", looksLike: "actually", means: { en: "currently, at the moment", hi: "इस समय, आजकल" }, insteadSay: { fr: "en fait", en: "actually" }, example: { fr: "Actuellement, je travaille à Toronto.", en: "At the moment, I work in Toronto." }, kind: "false_friend" },
  { fr: "attendre", looksLike: "attend", means: { en: "to wait (for)", hi: "इंतज़ार करना" }, insteadSay: { fr: "assister à", en: "to attend" }, example: { fr: "J'attends le bus depuis dix minutes.", en: "I have been waiting for the bus for ten minutes." }, kind: "false_friend" },
  { fr: "rester", looksLike: "rest", means: { en: "to stay, to remain", hi: "रुकना, बने रहना" }, insteadSay: { fr: "se reposer", en: "to rest" }, example: { fr: "Je reste à la maison ce soir.", en: "I'm staying home tonight." }, kind: "false_friend" },
  { fr: "le collège", looksLike: "college", means: { en: "middle school (ages 11–15)", hi: "मिडिल स्कूल (11–15 साल)" }, insteadSay: { fr: "l'université / le cégep (Québec)", en: "college / university" }, example: { fr: "Mon fils va au collège à pied.", en: "My son walks to middle school." }, kind: "false_friend" },
  { fr: "une journée", looksLike: "journey", means: { en: "a day (the whole day)", hi: "पूरा दिन" }, insteadSay: { fr: "un voyage, un trajet", en: "journey" }, example: { fr: "Bonne journée !", en: "Have a nice day!" }, kind: "false_friend" },
  { fr: "sensible", looksLike: "sensible", means: { en: "sensitive", hi: "संवेदनशील, भावुक" }, insteadSay: { fr: "raisonnable", en: "sensible" }, example: { fr: "Elle a la peau sensible.", en: "She has sensitive skin." }, kind: "false_friend" },
  { fr: "le magasin", looksLike: "magazine", means: { en: "shop, store", hi: "दुकान" }, insteadSay: { fr: "le magazine", en: "magazine" }, example: { fr: "Le magasin ferme à 21 h.", en: "The store closes at 9 p.m." }, kind: "false_friend" },
  { fr: "assister à", looksLike: "assist", means: { en: "to attend (a meeting, a class)", hi: "(मीटिंग, क्लास में) शामिल होना" }, insteadSay: { fr: "aider", en: "to assist, help" }, example: { fr: "J'assiste à une réunion à 10 h.", en: "I'm attending a meeting at 10." }, kind: "false_friend" },
  { fr: "éventuellement", looksLike: "eventually", means: { en: "possibly, if needed", hi: "शायद, ज़रूरत पड़ने पर" }, insteadSay: { fr: "finalement", en: "eventually" }, example: { fr: "On pourrait éventuellement partir plus tôt.", en: "We could possibly leave earlier." }, kind: "false_friend" },
  { fr: "la location", looksLike: "location", means: { en: "rental, renting", hi: "किराये पर लेना" }, insteadSay: { fr: "l'emplacement, l'endroit", en: "location, place" }, example: { fr: "La location d'une voiture coûte cher.", en: "Renting a car is expensive." }, kind: "false_friend" },
  { fr: "blesser", looksLike: "bless", means: { en: "to injure, to hurt", hi: "चोट पहुँचाना" }, insteadSay: { fr: "bénir", en: "to bless" }, example: { fr: "Il s'est blessé au genou.", en: "He hurt his knee." }, kind: "false_friend" },
  { fr: "la monnaie", looksLike: "money", means: { en: "change (coins), currency", hi: "छुट्टे पैसे, मुद्रा" }, insteadSay: { fr: "l'argent", en: "money" }, example: { fr: "Vous avez de la monnaie ?", en: "Do you have change?" }, kind: "false_friend" },
  { fr: "le crayon", looksLike: "crayon", means: { en: "pencil", hi: "पेंसिल" }, insteadSay: { fr: "le crayon de couleur", en: "crayon" }, example: { fr: "Écrivez au crayon, s'il vous plaît.", en: "Please write in pencil." }, kind: "false_friend" },
  { fr: "le stage", looksLike: "stage", means: { en: "internship, training course", hi: "इंटर्नशिप, प्रशिक्षण" }, insteadSay: { fr: "la scène", en: "stage (theatre)" }, example: { fr: "Je fais un stage dans une banque.", en: "I'm doing an internship at a bank." }, kind: "false_friend" },
  { fr: "prétendre", looksLike: "pretend", means: { en: "to claim", hi: "दावा करना" }, insteadSay: { fr: "faire semblant", en: "to pretend" }, example: { fr: "Il prétend qu'il est malade.", en: "He claims he is sick." }, kind: "false_friend" },
  { fr: "la lecture", looksLike: "lecture", means: { en: "reading", hi: "पढ़ना, पठन" }, insteadSay: { fr: "le cours magistral, la conférence", en: "lecture" }, example: { fr: "J'aime la lecture le soir.", en: "I like reading in the evening." }, kind: "false_friend" },
  { fr: "deux / douze", looksLike: "2 or 12?", means: { en: "deux [dø] = 2 · douze [duz] = 12: listen for the final z sound", hi: "deux (दअ) = 2 · douze (दूज़) = 12: आख़िरी ज़ की आवाज़ सुनें" }, example: { fr: "Rendez-vous à douze heures.", en: "Meet at twelve o'clock." }, kind: "sound_alike" },
  { fr: "seize / treize", looksLike: "16 or 13?", means: { en: "seize [sɛz] = 16 · treize [tʁɛz] = 13", hi: "seize (सेज़) = 16 · treize (त्रेज़) = 13" }, example: { fr: "Le bus 16 passe à 13 h.", en: "Bus 16 comes at 1 p.m." }, kind: "sound_alike" },
  { fr: "dessus / dessous", looksLike: "on top or under?", means: { en: "dessus [dəsy] = on top · dessous [dəsu] = underneath", hi: "dessus (दस्यू) = ऊपर · dessous (दसू) = नीचे" }, example: { fr: "Les clés sont dessous.", en: "The keys are underneath." }, kind: "sound_alike" },
  { fr: "cent / sans / sang", looksLike: "same sound", means: { en: "all [sɑ̃]: hundred / without / blood: context tells you", hi: "तीनों (सॉं): सौ / बिना / ख़ून — संदर्भ से समझें" }, example: { fr: "Un café sans sucre, s'il vous plaît.", en: "A coffee without sugar, please." }, kind: "sound_alike" },
  { fr: "le / les", looksLike: "one or many?", means: { en: "le [lə] = singular · les [le] = plural: in TEF listening this tells you how many", hi: "le (ल) = एक · les (ले) = कई — TEF सुनने में इसी से संख्या पता चलती है" }, example: { fr: "J'ai perdu les billets.", en: "I lost the tickets." }, kind: "sound_alike" },
  { fr: "la voiture", looksLike: "Hindi: गाड़ी (f) ✓", means: { en: "feminine in both. But le train (m) while रेल is feminine in Hindi", hi: "दोनों में स्त्रीलिंग। पर le train पुल्लिंग है, जबकि हिंदी में रेल स्त्रीलिंग है" }, example: { fr: "Le train arrive, la voiture attend.", en: "The train arrives, the car waits." }, kind: "gender_trap" },
  { fr: "le livre", looksLike: "Hindi: किताब (f)", means: { en: "masculine in French, feminine in Hindi", hi: "फ़्रेंच में पुल्लिंग, हिंदी में स्त्रीलिंग" }, example: { fr: "Le livre est intéressant.", en: "The book is interesting." }, kind: "gender_trap" },
  { fr: "la maison", looksLike: "Hindi: घर (m)", means: { en: "feminine in French, masculine in Hindi", hi: "फ़्रेंच में स्त्रीलिंग, हिंदी में पुल्लिंग" }, example: { fr: "La maison est grande.", en: "The house is big." }, kind: "gender_trap" },
  { fr: "le lait", looksLike: "Hindi: दूध (m) ✓", means: { en: "masculine in both", hi: "दोनों में पुल्लिंग" }, example: { fr: "Le lait est froid.", en: "The milk is cold." }, kind: "gender_trap" },
  { fr: "la table", looksLike: "Hindi: मेज़ (f) ✓", means: { en: "feminine in both", hi: "दोनों में स्त्रीलिंग" }, example: { fr: "La table est propre.", en: "The table is clean." }, kind: "gender_trap" },
  { fr: "le pays", looksLike: "Hindi: देश (m) ✓", means: { en: "masculine in both. But la France, l'Inde are feminine", hi: "दोनों में पुल्लिंग। पर la France, l'Inde स्त्रीलिंग हैं" }, example: { fr: "Le Canada est un grand pays.", en: "Canada is a big country." }, kind: "gender_trap" },
  { fr: "la chambre", looksLike: "Hindi: कमरा (m)", means: { en: "feminine in French, masculine in Hindi", hi: "फ़्रेंच में स्त्रीलिंग, हिंदी में पुल्लिंग" }, example: { fr: "La chambre est au premier étage.", en: "The bedroom is on the first floor." }, kind: "gender_trap" },
  { fr: "le pain", looksLike: "Hindi: रोटी (f)", means: { en: "masculine in French, feminine in Hindi", hi: "फ़्रेंच में पुल्लिंग, हिंदी में स्त्रीलिंग" }, example: { fr: "Le pain est frais.", en: "The bread is fresh." }, kind: "gender_trap" },
  { fr: "la lettre", looksLike: "Hindi: पत्र / चिट्ठी", means: { en: "feminine in French (like चिट्ठी), though पत्र is masculine", hi: "फ़्रेंच में स्त्रीलिंग (चिट्ठी जैसा), जबकि पत्र पुल्लिंग है" }, example: { fr: "J'écris une lettre au propriétaire.", en: "I'm writing a letter to the landlord." }, kind: "gender_trap" },
];
