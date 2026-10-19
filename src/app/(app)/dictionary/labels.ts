/** English and Hindi names for dictionary parts of speech and registers. Unknown values are shown as they are. */
const POS: Record<string, string> = {
  noun: "संज्ञा", verb: "क्रिया", adjective: "विशेषण", adverb: "क्रियाविशेषण", conjunction: "समुच्चयबोधक", phrase: "वाक्यांश", number: "संख्या",
  pronoun: "सर्वनाम", preposition: "संबंधबोधक (preposition)", determiner: "निर्धारक (determiner)", interjection: "विस्मयादिबोधक",
};
const REGISTER: Record<string, string> = { informal: "अनौपचारिक", formal: "औपचारिक", familiar: "बोलचाल की" };

export const posBi = (pos: string) => ({ en: pos, hi: POS[pos] ?? pos });
export const registerBi = (r: string) => ({ en: r, hi: REGISTER[r] ?? r });
