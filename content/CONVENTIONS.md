# French Setu content conventions

These rules apply to every lesson, dictionary entry and mock exam. The validator
(`npm run content:validate`) enforces the structural parts; the rest is editorial.

## 1. Who the learner is
An adult who speaks English and Hindi, reads Devanagari, knows zero French, and is
preparing for TEF Canada (immigration to Canada is a common motivation, so Canadian
contexts — Montréal, Québec, Toronto, Ottawa, Gatineau, Moncton, winters, transit,
rental housing, job hunting, healthcare, school — are good settings, mixed with
France and India).

## 2. Languages
- **French**: correct accents (é è ê à ù ç ô î ï ë û œ), correct gender and agreement,
  natural standard French. Use typographic apostrophes consistently as `'` (ASCII).
  Use a normal space before `?` `!` `:` `;` only if you are consistent; the house style
  is **French spacing with a regular space**: `Comment ça va ?`
- **English**: natural, idiomatic meaning, not word-for-word.
- **Hindi**: natural, idiomatic Hindi in Devanagari as an educated Hindi speaker would
  write it. Prefer everyday Hindi over Sanskritised jargon. Grammar terms may use the
  common Hindi word with the English term in brackets once, e.g. "लिंग (gender)",
  "क्रिया (verb)", "सर्वनाम (pronoun)", "उपपद / आर्टिकल (article)".
  Never leave instructional text in English inside a `hi` field.
- **Hindi meaning (`hi`) and approximate pronunciation (`pron`) are different things.**
  `hi` = what it means in Hindi. `pron` = how the French roughly sounds, written in
  Devanagari. Never put a transliteration in `hi`.

## 3. Approximate Devanagari pronunciation (`pron`)
The app labels these "Approximate pronunciation". Write the whole phrase as it is
actually said (with liaison, elision, enchaînement and silent letters applied), not a
concatenation of isolated words. Separate syllables of a word with `-` only when it
helps; separate rhythm groups with spaces.

| French sound | IPA | Write | Note |
|---|---|---|---|
| é, -er, -ez | e | ए | tense "e" |
| è, ê, -ais, -et | ɛ | ऐ | open "e" like Hindi ऐ (ऐसा) |
| a | a | आ / ा | short, open |
| o (closed) | o | ओ | |
| o (open) | ɔ | ऑ | as in "ऑफ़िस" |
| ou | u | ऊ / उ | |
| **u** (tu, rue) | y | **ü** | no Hindi letter: say ई with lips rounded as for ऊ |
| eu (deux), e muet (le) | ø, ə | **ö** | no Hindi letter: say ए with rounded lips |
| eu (heure, peur) | œ | **ö** | more open; the lab teaches the ø/œ difference |
| on / om | ɔ̃ | ओँ | nasal; do **not** pronounce an "n/m" |
| an / en / am / em | ɑ̃ | आँ | nasal |
| in / ain / ein / un | ɛ̃ | ऐँ | nasal |
| r | ʁ | **ग़** | throaty, close to Urdu/Hindi ग़ (as in "ग़लत"), never a rolled र |
| j, g+e/i | ʒ | झ़ | as in "टेलीविझ़न" |
| ch | ʃ | श | |
| gn | ɲ | न्य | |
| ill / y / i+vowel | j | य | |
| oi | wa | वा | moi = मवा |
| ui | ɥi | üइ | huit = üईत |
| p, t, k | p t k | प त क | unaspirated, dental त (never ट) |
| d | d | द | dental (never ड) |
| s / ss / ç | s | स | |
| s between vowels, z | z | ज़ | |
| f / v | f v | फ़ / व | |
| silent letters | — | omit | e.g. "petit" = प्ती (final t silent) |

Examples: `bonjour` → `बोँ-झ़ूग़`, `merci` → `मैग़-सी`, `Je m'appelle Priya` →
`झ़ö मा-पैल प्रिया`, `vous avez` → `वू ज़ा-वे` (liaison), `deux euros` → `दö ज़ö-ग़ो`,
`tu` → `तü`, `un vin blanc` → `ऐँ वैँ ब्लाँ`.

Pronunciation scaffolding is provided for: all vocabulary, phrases, grammar examples,
pronunciation words, speaking prompts and review items. Dialogue lines and reading
texts do **not** carry `pron` (learners use audio there). After Day 60, `pron` remains
in the data but the app hides it by default.

IPA (`ipa`) is optional; include it for vocabulary and pronunciation words when you
are confident. Use standard French IPA with /ʁ/, slashes omitted: `bɔ̃ʒuʁ`.

## 4. Pedagogy
- Days 1–20: no unexplained French in instructions. Dialogues short (4–8 lines),
  slow `pedagogical` mode, readings 20–80 words.
- Days 21–40: dialogues 6–12 lines, readings 60–150 words.
- Days 41–60: dialogues/monologues 8–16 lines, some `natural` mode, readings 120–220 words.
- Days 61–80: 10–18 lines, mostly `natural`, readings 180–300 words, opinion texts.
- Days 81–120: TEF-like documents, readings 200–400 words, natural speed.
- Reuse vocabulary from earlier days in dialogues, readings and review items.
- Every listening question must be answerable from the transcript; put the exact
  supporting quote in `evidence`. Same for reading questions.
- Distractors must be plausible and unambiguous. Vary the position of the right answer.
- `light: true` days (7, 14, 21, … 119) have fewer new words (5–7), heavier review
  (12+ review items), and recap grammar rather than new grammar.
- Checkpoints (20, 40, 60, 80, 100, 120) have 10–12 assessment questions covering
  the whole phase.
- Writing `model` answers must respect `minWords` and use only grammar taught so far.
- Explanations: short, concrete, friendly. Compare with English and Hindi when it
  really helps (gender, word order, tu/vous ↔ तू/तुम/आप, articles, partitives,
  word-for-word translation traps). Hindi grammatical gender often differs from
  French — say so explicitly when comparing.
- Practice questions are original. Never claim they are official TEF items.

## 5. Voices for audio
Dialogue lines use `voice`: `f1`, `m1`, `f2`, `m2` or `narrator`. Keep each speaker
on one voice within a dialogue.
