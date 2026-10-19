# Hindi style guide

Every new or changed Hindi string follows these rules. They come from the owner's Hindi fix list (v2, sections 3, 9 and the appendix). Content authors also follow [content/CONVENTIONS.md](../content/CONVENTIONS.md), which covers the pronunciation guides in detail.

## The six rules

1. **Address the learner as आप.** Instructions, notices and explanations use आप and its verb endings (देखें, पढ़ें, चुनें). Never mix आप and तुम in one flow. The app should model the respect level it teaches in the tu/vous lesson.
2. **Avoid masculine defaults.** Vocabulary glosses use the infinitive (चलना, not चलता हूँ). Where an example sentence needs a conjugated form, use a neutral construction or rely on the once-per-lesson gender note the lesson page shows automatically when a gloss ends in ता/ते + हूँ/है/हैं/हो.
3. **One term per concept.** Use the glossary below. Synonyms across screens read as different features to a beginner.
4. **Transcribe from the existing guides only.** Do not type a Devanagari pronunciation freehand. If the French word or phrase already has a `pron` anywhere in `content/`, copy it exactly; `npm run validate` fails when the same French has two different guides. New words follow CONVENTIONS.md section 3.
5. **Nukta per the glossary.** French /f/ and /z/ in transcriptions always take the nukta (फ़्रांस, काफ़े, ज़ेरो). Established loanwords keep it (फ़्रेंच, ज़रूर, ख़त्म, ग़लत). Fully naturalised words follow the standard dictionary spelling: इस्तेमाल has no nukta. Never add a nukta to a word without one of these sounds.
6. **Translate meaning, not English words.** Ask: would a Hindi-medium textbook write this without the English beside it? Loanwords Hindi users really say (सेटिंग्स, डेमो, रिकॉर्डिंग, ऑडियो) are preferred over invented formal words.

Terms of art stay in French with a Hindi gloss on first use per lesson: passé composé (पूर्ण भूतकाल), imparfait (अपूर्ण भूतकाल).

## Glossary

| English | Hindi | Note |
|---|---|---|
| Reveal / show meaning | अर्थ देखें | button |
| Mark done | पूर्ण चिह्नित करें | tight space: हो गया |
| Review (spaced review) | दोहराव | never दोहराई |
| Course map | पाठ्यक्रम | never कोर्स नक्शा |
| Settings | सेटिंग्स | |
| Next / Previous | आगे / पीछे | |
| Save | सहेजें | |
| Start lesson | पाठ शुरू करें | |
| Continue | जारी रखें | |
| Listen | सुनें | |
| Speak / Record | बोलें / रिकॉर्ड करें | noun: रिकॉर्डिंग |
| Check answer | उत्तर जाँचें | |
| Correct / Incorrect | सही / ग़लत | the fix list prints गलत; the app keeps the dictionary spelling ग़लत (owner to confirm) |
| Score | अंक | |
| Exam practice | परीक्षा अभ्यास | |
| Section (exam) | खंड | |
| Time allowed | समय सीमा | |
| Rules and instructions | नियम और निर्देश | |
| Result | परिणाम | |
| Listening / Reading / Speaking / Writing | सुनना (श्रवण) / पढ़ना (पठन) / बोलना (मौखिक) / लिखना (लेखन) | exam sections |
| Demo notice | यह डेमो मोड है। आपकी प्रगति इस डिवाइस पर सहेजी जाती है। | full text |
| What you'll learn | इस पाठ में आप सीखेंगे | heading |
| Spelling trap | वर्तनी की चेतावनी | never वर्तनी का जाल |
| Memory tip | याद करने की तरकीब | mnemonics, always labelled as a memory aid |
| Pronunciation guide (approx.) | उच्चारण सहायता | |
| Sound help | कैसे बोलें | |

## Where Hindi lives in code

- Interface text uses `Bi` (`src/components/bi.tsx`) with `{ en, hi }`, or `useBiLabel()` for plain strings such as aria-labels and placeholders. Hard-coded English in a component is a bug: Hindi-only mode must show Hindi.
- Lesson questions carry `q.hi` (and `optionsHi` when the options are English). The content lint fails when a lesson question has no `q.hi`.
- Hindi bridge boxes (French ideas Hindi grammar already teaches) are one component, `HindiBridge`, with text in `src/lib/hindi-bridges.ts`.
- Exam rules and section names are in `src/content/tef-config.ts`, each with its Hindi.

## Automated checks (`npx tsx scripts/validate-content.ts`)

- Mixed script: no Latin letters (ü, ö, a-z) inside a Devanagari guide.
- Old guide letters: no ग़, झ़, ü or ö in a `pron`.
- Banned strings (`BANNED_STRINGS` in `src/content/lint.ts`), checked in all content and all of `src/`. The list only grows.
- One guide per French word or phrase across the whole course.
- Lesson questions have Hindi.

## Release QA checklist

- [ ] Hindi-only mode: open every route; no English sentence outside French learning content.
- [ ] `npx tsx scripts/validate-content.ts` passes (banned strings, guides, mixed script).
- [ ] Three screens showing the same French word show the identical guide.
- [ ] Exam practice page in Hindi-only mode: rules, table and buttons fully in Hindi.
- [ ] A native Hindi reviewer reads the changed screens in context (not in a spreadsheet) and signs off.
