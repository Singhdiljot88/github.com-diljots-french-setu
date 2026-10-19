# Build status

Last updated: 2026-10-18 · All 5 stages built.

Legend: ✅ built and checked in a browser · 🟡 partly built · ⬜ not started · 🔑 needs a paid key to go beyond demo mode

## Stage 1: foundation and the daily lesson ✅

| Area | Status | Notes |
|---|---|---|
| Next.js 16 + TypeScript + Tailwind app, PWA manifest, offline page | ✅ | `npm run build` passes (checked again 2026-10-18 after stage 5). |
| Postgres schema (25 tables) and migration | ✅ | `drizzle/0000_init.sql`. Runs on Postgres/Supabase, or on embedded PGlite with no setup. |
| Accounts | ✅ | Email and password (scrypt), httpOnly session cookie, a guest account option, every query scoped to the signed-in user, cross-site requests blocked. |
| Onboarding | ✅ | Explanation language, daily minutes (45/90/150/180), start and exam dates, TEF variant (only TEF Canada is enabled; others are listed as "not yet supported"), goal, familiarity, optional placement quiz, mic and audio preferences, Devanagari default, time zone. |
| Schedule | ✅ | Days follow the learner's local date. Every 7th day is lighter. Checkpoints fall on days 20/40/60/80/100/120. The 150-minute split is 15/20/25/25/20/25/20. Shorter plans spread a day over 2 or 4 sessions, or trim it. Missed days get a recovery plan (catch up, or shift the schedule). |
| Today dashboard | ✅ | Today's lesson, recovery plan, review count, progress against plan, adaptation notes. |
| Lesson player | ✅ | All seven blocks: learn, listening, speaking, reading, writing, review, assessment. Answers are graded on the server, wrong answers go to the mistake notebook, and lesson words go into spaced review. Every lesson shows its content status and has "Report a problem". |
| English/Hindi teaching | ✅ | Hindi meaning and Devanagari pronunciation are shown separately, the latter labelled "Approx. pronunciation". The scaffolding rule by day range is in place. |
| Audio | ✅ | Normal and slow playback using the device's French voice, labelled as synthetic. |
| Recording | ✅ | Records in the browser, plays back next to the model, and keeps nothing on the server. Handles mic-denied and unsupported browsers. No fake pronunciation score. |
| Writing in lessons | ✅ | Learn, practice and exam modes. Accent keyboard, autosave, word count, timer that survives reload, version history, auto-submit when time is up. |
| Writing feedback | ✅ 🔑 | With `ANTHROPIC_API_KEY` (or OpenAI) the model returns schema-validated corrections in English and Hindi. Without one, a rule-based checker labelled "Rule-based check (not AI)" runs. It catches elision, missing apostrophes, contractions, être/avoir agreement, "j'ai … ans", article gender for dictionary nouns and missing accents. Real errors go to the mistake notebook with a drill. |
| AI adapter | ✅ 🔑 | Server-only. Claude `claude-opus-5-5` (overridable with `AI_MODEL`) or OpenAI. Structured JSON output checked against a schema, 60 s timeout, retries, a per-user daily limit (60), a response cache, and learner and web text passed as data, not instructions. Server-side fallback is on: if Claude declines a request, Anthropic's API retries it on its recommended fallback model. |
| Dictionary data | ✅ | 1,717 entries (the original 1,378 plus 339 added on 2026-10-18 so every word used in the 120 lessons has an entry), each with English, Hindi, IPA, approximate pronunciation, level, examples, collocations and common mistakes. There is a conjugation engine for all tenses, and search by French, English, Hindi, conjugated form or misspelling. Tap-to-look-up works in lesson reading texts. |
| Setup docs | ✅ | `README.md`, `.env.example`, `docs/DEPLOY.md`. |

## Stage 2: course map, dictionary, my words, review ✅

| Area | Status | Notes |
|---|---|---|
| Course map | ✅ | All 120 days by phase, with done, today, started and behind-schedule markers, the scheduled date of each day, and light-day, checkpoint and mock badges. Days that only have an outline so far are marked. |
| Dictionary search | ✅ | Live search in French, English or Hindi. It also finds conjugated forms ("allé" finds aller, labelled as its passé composé), plurals, feminines, misspellings and close spellings. |
| Dictionary entry | ✅ | Gender with article, plural and feminine forms, English and Hindi meanings, IPA, approximate pronunciation, audio, examples, collocations, common mistakes, a full conjugation table for verbs, related words, provenance, and "Report a problem". |
| My words | ✅ | Filter, add your own word, write your own example sentence, add flashcard types, see review history, remove a word. |
| Review | ✅ | Six card types: French → meaning, meaning → French, listen → word, gender, dictation, and fill the gap (using your own example first). Typed answers are checked with accent tolerance and a suggested rating. Again/Hard/Good/Easy show the next interval, and keys 1–4 also rate. Learning cards come back within the session. Daily limits on new and overdue cards depend on your daily minutes. |
| Dictionary coverage check | ✅ | `npx tsx scripts/dictionary-coverage.ts` lists lesson words that have no dictionary entry. |

## Stage 3: listening, reading, pronunciation, speaking ✅

| Area | Status | Notes |
|---|---|---|
| Listening library | ✅ | Every lesson recording, filterable by phase, type and status. Practice mode allows replays, slow playback and the transcript after the questions. Exam mode shows questions first, plays the recording once at normal speed with no pause or replay, and reveals the transcript only after you submit. Wrong answers go to the mistake notebook. |
| Reading library | ✅ | Every lesson text, with tap-to-look-up on any word and the translation unlocked after the questions. Timed mode uses a soft countdown at TEF pace (about 90 s per question). |
| Pronunciation lab | ✅ | 16 sound units, each with IPA, mouth position in English and Hindi, the common trap for Hindi/English speakers, examples with audio at normal and slow speed, and record-and-compare. Also 8 minimal-pair sets with a listening quiz, liaison and enchaînement rules, and shadowing from your lesson dialogues. No pronunciation score is shown (Azure assessment is not wired in yet). |
| Speaking tutor | ✅ 🔑 | Six modes: lesson role-play, answer questions, conversation (the partner sometimes disagrees), short presentation, TEF task A (ask about ten questions; the partner only answers from the advert's fact list) and TEF task B (convince a sceptical friend who raises objections), with timers for the TEF tasks. Speech input uses the browser's recognition, server transcription when configured, or typing. The AI partner needs an AI key. Without one, a scripted partner labelled "not AI" runs; in TEF A it matches your question keywords to the facts. Feedback covers stats (turns, words, questions, connectors), corrections with drills, stronger versions and a retry. Errors go to the mistake notebook. |
| Server voices and transcription | ✅ 🔑 | `/api/tts` (Azure or OpenAI, cached, with fallback to the device voice) and `/api/stt` (OpenAI or Azure). |
| Recordings | ✅ | Kept only when the learner opts in. Size-capped, per-user, can be listed and deleted. |

## Stage 4: writing studio and web discovery ✅

| Area | Status | Notes |
|---|---|---|
| Writing studio | ✅ 🔑 | TEF task A (continue a news story: 80+ words, 25 min) and task B (opinion letter: 200+ words, 35 min, three arguments) for each mock, everyday emails and paragraphs, and every lesson's writing task. All in Learn, Practice and Exam modes, with autosave, word count, a timer that survives reloads, version history, and feedback (AI, or the labelled rule checker). |
| Sentence builder | ✅ | Put the words in order, using grammar sentences from the lessons you've reached. Wrong orders go to the mistake notebook. |
| Recurring-error notebook | ✅ | Writing and speaking errors grouped by category, with how often each comes back, plus a link to practise them. |
| Web discovery | ✅ 🔑 | Search (Brave or Tavily, server-side, needs a key), open any link, paste any text, curated official and learning sites (labelled as curated), and saved texts. Pages are fetched with SSRF protection: only public IPs, checked at connect time, http/https on ports 80/443, re-checked redirects, size and time limits. Page text is treated as data and never as instructions. Only a 600-character excerpt and the link are stored, and the source, publisher, dates and copyright notice are shown. |
| Study kits | ✅ 🔑 | Without AI: dictionary-backed vocabulary, gap-fills from the text and a rough difficulty estimate, labelled "not AI" and "not a CEFR rating". With AI: also a summary in English and Hindi and comprehension questions. A question is dropped unless its evidence quote really appears in the text. |

## Stage 5: practice exams, mistakes, progress, settings, tests ✅

| Area | Status | Notes |
|---|---|---|
| TEF format config | ✅ | `src/content/tef-config.ts` is the one place that states the exam rules. Each rule is marked as from the official handbook (Le français des affaires, Livret du responsable TEF 2026, read on 2026-10-18) or from preparation guides: reading 40 questions in 60 min, listening 40 in 40 min with no going back, writing 2 tasks in 60 min (80+ and 200+ words), speaking 2 tasks in 15 min (about 5 + 10). |
| Practice exam simulator | ✅ | 3 original mocks. Take all four sections or any one. **Exam rules mode:** clocks are kept on the server, so reloading or closing the page does not pause or reset them; a section is submitted automatically when time runs out, with the answers saved so far; one section at a time; listening plays each recording once, in order, and earlier recordings lock; recording scripts are sent only when a recording is played; answers and explanations are hidden until the section is submitted; no word look-up, translation or corrections inside the exam. **Relaxed mode:** same tasks, clocks as a guide only. Results are raw counts by part and question type ("28 / 40"), never a TEF, CEFR or NCLC estimate. Writing gets feedback after the section (AI, or the labelled rule checker). Speaking runs TEF A and B with the partner (AI or scripted), each with its own server clock. |
| Mistake notebook | ✅ | Every error from lessons, checks, writing, speaking, the sentence builder and practice exams, grouped by type with counts, filters, the fix and explanation in English and Hindi, and a short drill. A correct drill marks it resolved; making the same error again reopens it. "Drill my top 10" session. |
| Progress | ✅ | Days done by phase, study time (last 14 days), accuracy per skill (recent vs earlier), words remembered, open mistakes, practice exam counts. Completion is kept separate from accuracy. No readiness percentage. |
| Checkpoint reports | ✅ | For days 20/40/60/80/100/120: what you can do (only days whose check was at least 70%), finished days whose check shows more work is needed, skill accuracy in those 20 days, recurring errors, rule-based next steps, and whether the exam date or daily workload should be looked at again. Saved as a snapshot the first time it is opened after the checkpoint day. |
| Settings | ✅ | All learning preferences, microphone and recording consent (turning "keep recordings" off deletes them), kept recordings list with play, download and delete, sign out. |
| Data export and account deletion | ✅ | One JSON file with everything stored about the learner (no password hash; recordings listed without audio). Deletion needs "DELETE" plus the password, removes every row through cascading keys and the learner's AI cache entries, and signs out. |
| "Say it" practice and printable report | ✅ | New free feature. In the pronunciation lab, say any phrase or word from lessons reached so far. The browser's French speech recognizer (Chrome, Edge) or the phone's voice keyboard writes what it heard, and the app marks which words were recognised. `/pronunciation/report` prints or saves as PDF a "best attempts" report: per phrase the French, English and Hindi meaning, approximate pronunciation, best transcript, words recognised, what improved, what to work on, and a plain note on how it was measured. It measures recognition, not accent, and says so. |
| Automated tests | ✅ | `npm test`: 46 unit and server tests (Vitest, in-memory database): spaced repetition, local dates across time zones and DST, the schedule and recovery plan, answer checking, conjugation, dictionary search with accents, forms, English and Hindi, all 120 days present and distinct, mocks with 40 + 40 questions, exam timers and auto-submit, listening play-once and no going back, relaxed mode, isolation between learners, autosave and timed submission, mistake drills, review scheduling, demo-mode fallbacks, export, deletion, web address safety and text extraction, the rule-based writing check, Say-it word matching. |
| End-to-end journeys | ✅ | `npm run test:e2e` (Playwright, Chromium at Pixel 7 size, fake microphone). 8 of 8 pass on 2026-10-18: the six journeys (Day 1 completed and still done after reload and sign-in; save a dictionary word and review it; listen, record and get labelled feedback; write, study corrections and retry; turn pasted French text into a lesson; a timed mock section that survives reload, then reviewing mistakes), microphone denied, and Hindi and French on a phone without overflow. Journey 5 uses pasted text because live web search needs a key and outside network. |

## Course content ✅

| Content | Status |
|---|---|
| Outline for all 120 days | ✅ Titles, objectives and grammar focus for every day. Days without a full lesson show the outline. |
| Full lessons | ✅ All 120 written and validated. |
| Mock exams | ✅ 3 full TEF-format mocks (reading, listening, writing A/B, speaking A/B). |
| Editorial review | ⬜ All content is AI-drafted and shown as "editorial review pending". Specific items for a reviewer are listed in `docs/CONTENT_REVIEW_NOTES.md`. |

## Free accounts worth gathering

Everything above works with no keys. These free tiers add real features at no cost (checked 2026-10-18; free tiers change, so re-check before relying on one):

| Account | What it unlocks | Free allowance | Card needed? |
|---|---|---|---|
| GitHub | A home for the code, and the source for hosting | Free | No |
| Supabase (free plan) | Hosted Postgres, so progress is kept online and on every device (`DATABASE_URL`) | 500 MB database; pauses after a week with no use | No |
| Vercel (Hobby) | Hosting the app at a web address you can open on your phone | Free for personal use | No |
| Tavily | Live web search in Web discovery (`TAVILY_API_KEY`) | 1,000 searches a month | No |
| Azure Speech (F0 tier) | Natural server voices (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`) and server speech-to-text | 0.5M characters of neural voice and 5 audio hours of speech-to-text a month | An Azure account asks for a card for identity checks; F0 itself is not charged |

Not free, and not needed: AI keys (Anthropic or OpenAI) are pay-as-you-go. Without one the app uses its labelled rule checker and scripted partner. Brave Search dropped its free tier in February 2026 and now needs a card, so Tavily is the free choice.

Azure pronunciation assessment would give real accent feedback, but I could not confirm it is in the free allowance, and the adapter is not built. Until it is, the app shows no accent score.

## Needs credentials to go beyond demo mode

| Integration | Variables | Without it |
|---|---|---|
| AI feedback, speaking partner, web lessons | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Rule-based checker and scripted partner, both labelled |
| Server text-to-speech | `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`, or OpenAI | Device voice (labelled synthetic) |
| Server speech-to-text | OpenAI or Azure | Browser recognition where available |
| Pronunciation scoring | Azure Speech (adapter not built yet) | Not shown at all |
| Web search | `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY` | Curated links and pasted text |
| Hosted database | `DATABASE_URL` | Embedded database on one computer |

## Known limitations

- Fetching real web pages could not be tested from the build environment, whose network only allows traffic through a proxy. The SSRF blocks (private IPs, localhost, metadata address, odd ports, credentials, non-http schemes) were tested and refuse correctly. Fetches go out directly and ignore `HTTPS_PROXY`.

- Every lesson word now has a dictionary entry (`scripts/dictionary-coverage.ts` reports 0 missing). The 339 newest entries are AI-drafted like the rest and are listed for review in `docs/CONTENT_REVIEW_NOTES.md`.
- "Say it" needs Chrome or Edge for built-in recognition. Their recognizers send the audio to Google or Microsoft to turn it into text; the app says so and stores only the text. Firefox and Safari on some systems have none, so the learner uses the phone's voice keyboard set to French instead. A recognizer guesses whole words and sometimes "corrects" a wrong sound into the right word, so a recognised word means the sound was clear enough, not that it was perfect.
- Device voices vary by browser and OS. Firefox on Linux may have no French voice.
- No score predictions or CLB mappings are shown anywhere, by design.

## Hindi fix list v2 work (merged to main 2026-10-19)

Verified on 2026-10-19: `npx tsc --noEmit` clean, `npm test` 52/52, `npx tsx scripts/validate-content.ts` all content valid, `npm run build` succeeds, browser journeys 8/8. Four journeys needed their selectors updated for the bilingual labels (e.g. "Start · शुरू करें", aria-label "Conversation · बातचीत", the rewritten microphone message); what they check is unchanged.

Done: Hindi question text on all lessons; French-voice playback fix; time-zone picker; owner's pronunciation spellings (बों-जूर, सा-ल्यू, मेर-सी, ल) across all guides and teaching texts, one guide per French word; banned-string, mixed-script and old-letter lint; sound-help panels; TEF exam page and exam screens in Hindi; Hindi-only interface sweep; guided one-step lesson view; Hindi bridge boxes (tu/vous, gender, nasals, reflexives, depuis, passé composé); gender note; mnemonic field (no data yet); docs/HINDI_STYLE_GUIDE.md with QA checklist.

Left: native Hindi reviewer sign-off; 100 mnemonics; some server-built text (adaptive tips, checkpoint advice, review interval previews, page titles) is still English in Hindi-only mode; owner decisions (spaced review vs repetition, ग़लत vs गलत spelling, demo notice wording).
