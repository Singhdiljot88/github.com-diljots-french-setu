/**
 * "Hindi bridge" boxes: French ideas a Hindi speaker already knows from Hindi grammar.
 * Copy for gender, nasals and the passé composé is the owner's fix list v2, section 8; the rest
 * follows section 8.4. All of it still needs a native Hindi reviewer.
 */
export type BridgeKey = "tu-vous" | "gender" | "nasals" | "reflexive" | "depuis" | "passe-compose";
export type Bridge = { title: { en: string; hi: string }; text: { en: string; hi: string } };

export const HINDI_BRIDGES: Record<BridgeKey, Bridge> = {
  "tu-vous": {
    title: { en: "You already know this from Hindi: तू / तुम / आप", hi: "यह आप हिंदी से पहले से जानते हैं: तू / तुम / आप" },
    text: {
      en: "Hindi has three levels of \"you\"; French has two. tu is for family, friends and children. vous is for anyone you would call आप, and in formal settings usually for people you would call तुम too. When in doubt, say vous.",
      hi: "सामने वाले को संबोधित करने के लिए हिंदी में तीन शब्द हैं (तू, तुम, आप), फ़्रेंच में दो। tu परिवार, दोस्तों और बच्चों के लिए है। जिसे आप \"आप\" कहते हैं, उसके लिए vous बोलें, और औपचारिक जगहों पर जिसे आप \"तुम\" कहते, उसके लिए भी अक्सर vous ही सही है। शक हो तो vous बोलें।",
    },
  },
  gender: {
    title: { en: "You already know this from Hindi: अच्छा / अच्छी", hi: "यह आप हिंदी से पहले से जानते हैं: अच्छा / अच्छी" },
    text: {
      en: "Remember: like Hindi, every French noun has a gender. Just as Hindi changes अच्छा / अच्छी, French changes le / la and adjectives. This is new for English speakers, not for you. The genders do not always match Hindi, so learn each noun with its le or la.",
      hi: "याद रखें: हिंदी की तरह फ़्रेंच में भी हर संज्ञा का लिंग होता है। जैसे हिंदी में \"अच्छा / अच्छी\" बदलता है, वैसे ही फ़्रेंच में le / la और विशेषण बदलते हैं। अंग्रेज़ी बोलने वालों के लिए यह नया है, आपके लिए नहीं। लिंग हमेशा हिंदी जैसा नहीं होता, इसलिए हर संज्ञा उसके le या la के साथ याद करें।",
    },
  },
  nasals: {
    title: { en: "You already know this from Hindi: the chandrabindu (ँ)", hi: "यह आप हिंदी से पहले से जानते हैं: चन्द्रबिन्दु (ँ)" },
    text: {
      en: "Speak through the nose: French nasal sounds are like Hindi's chandrabindu. As in हँसी you do not say a full न, in bon do not say a final न: let the sound come through the nose.",
      hi: "नाक से बोलें: फ़्रेंच की अनुनासिक ध्वनियाँ हिंदी के चन्द्रबिन्दु जैसी हैं। जैसे \"हँसी\" में आप पूरा \"न\" नहीं बोलते, वैसे ही bon में अंत में \"न\" न बोलें। आवाज़ को नाक से निकालें।",
    },
  },
  reflexive: {
    title: { en: "You already know this from Hindi: ख़ुद / अपने आप", hi: "यह आप हिंदी से पहले से जानते हैं: ख़ुद / अपने आप" },
    text: {
      en: "Hindi already marks doing something to yourself: मैं ख़ुद तैयार होता हूँ. French puts that \"yourself\" inside the verb: je me prépare, je me lève.",
      hi: "हिंदी में आप पहले से बताते हैं कि काम अपने लिए हो रहा है: \"मैं ख़ुद तैयार होता हूँ\"। फ़्रेंच में यह \"ख़ुद\" क्रिया का ही हिस्सा बन जाता है: je me prépare, je me lève।",
    },
  },
  depuis: {
    title: { en: "You already know this from Hindi: से", hi: "यह आप हिंदी से पहले से जानते हैं: से" },
    text: {
      en: "depuis works like Hindi से with an ongoing action: मैं सुबह से पढ़ रहा हूँ = j'étudie depuis ce matin. Like Hindi, French uses the present tense here, not a past tense as English does (\"I have been studying\").",
      hi: "depuis हिंदी के \"से\" की तरह चलता है, जब काम अभी भी जारी हो: \"मैं सुबह से पढ़ रहा हूँ\" = j'étudie depuis ce matin। हिंदी की तरह फ़्रेंच में भी यहाँ वर्तमान काल आता है, अंग्रेज़ी की तरह भूतकाल नहीं।",
    },
  },
  "passe-compose": {
    title: { en: "You already know this from Hindi: खा चुका हूँ", hi: "यह आप हिंदी से पहले से जानते हैं: खा चुका हूँ" },
    text: {
      en: "You already know this: मैं खा चुका हूँ has two parts, खाना + चुका हूँ. The French passé composé is the same: a helper verb + the past form of the main verb. For example: j'ai mangé = मैंने खा लिया / खा चुका हूँ.",
      hi: "आप यह पहले से जानते हैं: \"मैं खा चुका हूँ\" में दो हिस्से हैं, खाना + चुका हूँ। फ़्रेंच का passé composé भी ऐसा ही है: सहायक क्रिया + मुख्य क्रिया का भूतकाल रूप। जैसे: j'ai mangé = मैंने खा लिया / खा चुका हूँ।",
    },
  },
};

/** Lessons whose grammar box gets a bridge. The nasal bridge sits in the pronunciation lab. */
export const BRIDGE_DAYS: Record<number, BridgeKey> = { 1: "tu-vous", 6: "gender", 27: "reflexive", 30: "gender", 36: "depuis", 41: "passe-compose", 45: "depuis", 90: "gender" };
