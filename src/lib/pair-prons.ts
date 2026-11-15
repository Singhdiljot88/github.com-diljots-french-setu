/**
 * Approximate Devanagari for every minimal-pair word in the pronunciation lab, written to
 * content/CONVENTIONS.md §3 (whole phrase as spoken, liaison applied). AI-drafted 2026-11-15,
 * editorial review pending.
 */
export const PAIR_PRONS: Record<string, string> = {
  "tu": "त्यू", "tout": "तू", "la rue": "ला र्यू", "la roue": "ला रू", "vu": "व्यू", "vous": "वू", "dessus": "द-स्यू", "dessous": "द-सू",
  "nu": "न्यू", "nous": "नू", "pur": "प्यूर", "pour": "पूर",
  "le livre": "ल लीव्र", "les livres": "ले लीव्र", "je dis": "ज दी", "j'ai dit": "जे दी", "ce matin": "स मा-तैं", "ces matins": "से मा-तैं",
  "le sac": "ल साक", "les sacs": "ले साक",
  "deux": "द", "des": "दे", "peu": "प", "paix": "पे", "ceux": "स", "ses": "से", "jeu": "ज", "j'ai": "जे",
  "bon": "बों", "banc": "बाँ", "cent": "साँ", "son": "सों", "lent": "लाँ", "long": "लों", "blanc": "ब्लाँ", "blond": "ब्लों",
  "le vin": "ल वैं", "le vent": "ल वाँ", "le pain": "ल पैं", "le paon": "ल पाँ", "cinq": "सैंक", "il ment": "इल माँ", "la main": "ला मैं",
  "les joues": "ले जू", "les choux": "ले शू", "bouger": "बू-जे", "boucher": "बू-शे", "Jean": "जाँ", "champ": "शाँ", "les gens": "ले जाँ", "le chant": "ल शाँ",
  "le poisson": "ल प्वा-सों", "le poison": "ल प्वा-ज़ों", "le dessert": "ल दे-सेर", "le désert": "ल दे-ज़ेर",
  "ils sont": "इल सों", "ils ont": "इल ज़ों", "nous savons": "नू सा-वों", "nous avons": "नू ज़ा-वों",
  "le lait": "ल ले", "le rat": "ल रा", "rire": "रीर", "lire": "लीर", "le riz": "ल री", "le lit": "ल ली", "prier": "प्री-ये", "plier": "प्ली-ये",
};
