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
  Follow the [Hindi style guide](../docs/HINDI_STYLE_GUIDE.md): आप register, one glossary
  term per concept, the nukta rule, and the release QA checklist.
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
| è, ê, -ais, -et | ɛ | ए / े | open "e"; written like é (merci = मेर-सी). Only the nasal ɛ̃ uses ऐं |
| a | a | आ / ा | short, open |
| o (closed) | o | ओ | |
| o (open) | ɔ | ऑ | as in "ऑफ़िस" |
| ou | u | ऊ / उ | |
| **u** (tu, rue) | y | **यू** (after a consonant **्यू**) | tu = त्यू, salut = सा-ल्यू, une = यून. Not English "you": say ई with lips rounded as for ऊ, one pure sound, no य glide |
| eu (deux), e muet (le) | ø, ə | **inherent vowel** (bare consonant), **अ** when alone | le = ल, de = द, je = ज, deux = द. A bare consonant means a short, relaxed vowel said with rounded lips |
| eu (heure, peur) | œ | **inherent vowel**, **अ** when alone | sœur = सर, heure = अर. Round the lips more for eu; the lab teaches the ø/œ difference |
| on / om | ɔ̃ | ओं / ों | nasal; do **not** pronounce an "n/m" (bon = बों) |
| an / en / am / em | ɑ̃ | आँ / ाँ | nasal |
| in / ain / ein / un | ɛ̃ | ऐं / ैं | nasal (vin = वैं) |
| r | ʁ | **र** | in our guides र is the French r: soft, at the back of the throat, tongue tip down behind the lower teeth (mouth position close to the ग़ in "ग़लत"). Never the rolled Hindi र, never a hard ग |
| j, g+e/i | ʒ | **ज** | the soft French j: a continuous buzz as in the middle of "measure" / टेलीविज़न, not the Hindi ज with a stop (bonjour = बों-जूर) |
| ch | ʃ | श | |
| gn | ɲ | न्य | |
| ill / y / i+vowel | j | य | |
| oi | wa | वा | moi = मवा |
| ui | ɥi | यूइ / ्यूइ | huit = यूइत, la nuit = ला न्यूई |
| p, t, k | p t k | प त क | unaspirated, dental त (never ट) |
| d | d | द | dental (never ड) |
| s / ss / ç | s | स | |
| s between vowels, z | z | ज़ | keep the nukta (ज़ = z, ज = French j) |
| f / v | f v | फ़ / व | keep the nukta on फ़ |
| silent letters | — | omit | e.g. "petit" = प्ती (final t silent) |

Nasals: chandrabindu (ँ) is written as anusvara (ं) on any letter that already has a
mark above the line (ों, ैं, ओं, ऐं); आँ / ाँ and ऊँ keep the chandrabindu. A nasal never
has an n/m sound at the end.

Examples: `bonjour` → `बों-जूर`, `merci` → `मेर-सी`, `Je m'appelle Priya` →
`ज मा-पेल प्रिया`, `vous avez` → `वू ज़ा-वे` (liaison), `deux euros` → `द ज़-रो`,
`tu` → `त्यू`, `salut` → `सा-ल्यू`, `une heure` → `यून अर`, `ma sœur` → `मा सर`,
`un vin blanc` → `ऐं वैं ब्लाँ`.

Explanatory texts (tips, notes, explanations) must use the same letters when they quote a
pronunciation, and say what a guide letter means when they teach a sound (e.g. "यू in our
guides is not English 'you'"; "र here is the French r"). Ordinary Hindi words keep their
nukta (ग़लत, काग़ज़).

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
