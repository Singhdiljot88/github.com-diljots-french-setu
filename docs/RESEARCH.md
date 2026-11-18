# What would make ShabdSetu more useful

Research for the 18 November 2026 pass. The learner is an adult who speaks English and Hindi, is starting French from zero, and is preparing for TEF Canada. The notes below are about that person, not about a general language app.

## What the app already does well

ShabdSetu is not a thin phrase list. It already has a 120-day course, a dictionary with a conjugation engine, spaced review, listening and reading libraries, a pronunciation lab, speaking and writing practice, three original mocks, a mistake notebook, and Hindi plus approximate Devanagari on almost every item. It refuses to invent a TEF, CEFR or NCLC score. That honesty matters: IRCC decisions use the official certificate, and a fake level would be worse than no number.

The gap was not “add another game”. It was that the useful material was locked inside the day you happened to be on.

## What effective study actually uses

These are the practices with the best evidence for an adult learning a language for an exam, and how they showed up in this codebase.

| Practice | Evidence | Already in ShabdSetu | What was missing |
|---|---|---|---|
| Spaced retrieval | Kim and Webb, *Language Learning* 2022: spacing has a medium-to-large effect on second-language learning. Bahrick and colleagues (1993) found long gaps still help years later. | Review queue, six card types | A way to retrieve a grammar rule on the day you need it, not only on its lesson day |
| Retrieval plus feedback | Yang and colleagues, *International Journal of Multilingualism* 2024: retrieval without feedback can lose to restudy; retrieval with feedback wins. A small Korean-vocabulary study found weekly tests with corrective feedback held words that untested words lost. | Lesson checks, writing checker, mistake drills | Verb forms were a table to read, not a question with a reason |
| A little output, often | TEF writing and speaking are scored on task, grammar, vocabulary and organisation, not on recognition. Swain’s output hypothesis is the practical version: you find the holes when you have to produce. | Writing studio, speaking tutor, sentence builder | Production of the single form (je / elle / nous) with agreement |
| L1 as a bridge, not a crutch | The same retrieval study found first-language to new-language pairs beat second-language pairs. Hindi already has gender, tu/vous-like levels, and a compound past. | Hindi bridges on a few lesson days | Those bridges were easy to miss, and not collected anywhere |
| Real listening, a few minutes a day | TEF listening is 40 questions in 40 minutes, each audio once, no going back (Le français des affaires, candidate pages, checked 18 November 2026). | Listening library with an exam mode, number game | The resource list already points at RFI; no change needed there |
| No fake score | Official results convert raw answers into a calibrated 0–699 score, then CEFR and NCLC. The raw total is not the certificate. | The app shows raw counts only | Kept that rule. The new drill saves a count, not a level |

Sources worth opening:

- TEF Canada format: [examination page](https://www.lefrancaisdesaffaires.fr/en/candidate/test-evaluation-francais/tef-canada/examination/) and [results page](https://www.lefrancaisdesaffaires.fr/en/candidate/test-evaluation-francais/tef-canada/results/). Reading 40 questions / 60 minutes, listening 40 / 40 minutes played once with no going back, writing two tasks / 60 minutes (about 25 + 35, 80 and 200 words), speaking two tasks / 15 minutes (5 + 10). All four on the same day for IRCC.
- Kim, S. K., and Webb, S. (2022). The effects of spaced practice on second language learning: A meta-analysis. *Language Learning*.
- Bahrick, H. P., et al. (1993). Maintenance of foreign language vocabulary and the spacing effect. *Psychological Science*.
- Yang and colleagues (2024). Retrieval practice plus feedback benefits third-language vocabulary learning. *International Journal of Multilingualism*.

## What other apps cover, and what this learner actually needs

Duolingo is strong at daily return and weak at explanation. Babbel and Kwiziq explain grammar, then drill it. Anki is the spacing engine and nothing else. Lawless French and TV5MONDE are references you leave the course to open. LingQ is input. None of them are built for a Hindi-speaking adult aiming at TEF Canada.

For this learner the high-value pieces are:

1. A grammar point you can find by the French name, the English name, or the Hindi name, and open the day it was taught.
2. Verb forms you type, with the reason (ending, elision, auxiliary, agreement). Agreement with être is the Hindi speaker’s own system (गया / गई / गए), and it is exactly where writing marks are lost.
3. Phrases for the situations the course already wrote: the clinic, the flat, the café, work. Not a second course.
4. Feedback that says what to fix, and a demo path that never pretends to be a model.

Those four are what this change adds. They use the lessons and the dictionary that were already there.

## What this pass shipped

- `/grammar` — searchable grammar from all 120 lessons, a verb drill, and the Hindi bridges in one list.
- `/phrases` — lesson phrases grouped by situation, with audio.
- OpenAI calls go through the Vercel AI SDK (`ai` + `@ai-sdk/openai`), server-side only, when `OPENAI_API_KEY` is set. If that variable is empty and `SPEKO_API_KEY` is set, the same chat features use Speko. The labelled demo path runs only when neither key is set.
- A correction of `l'hindi` to `le hindi`. The h is aspiré. The dictionary, the elision list and day 9 disagreed; day 9 was wrong.
- Sign-in no longer returns faster for an unknown email. Guest, sign-in and sign-up are rate-limited per server instance. A migration enables row-level security so the Supabase public API cannot read the tables. See `docs/AUDIT.md`.

## Roadmap, in the order that would help next

1. **Human review of days 1–20 and the 300 most common dictionary words.** Every lesson is still marked AI-drafted. A wrong explanation early on is memorised. `docs/CONTENT_REVIEW_NOTES.md` is the list.
2. **One “weak forms” session.** Mix due review cards with the verb drill and the open mistakes, ten minutes, then stop. The pieces exist; they are not scheduled together.
3. **More mocks, still original.** Three is enough to learn the format. Six would let a learner sit one a week in the last phase without repeating. Do not copy official items.
4. **Dictation from the lesson audio.** Listening is multiple choice. TEF listening is too, but writing what you heard is how numbers and endings stick. The number game is the start.
5. **A printable one-page grammar sheet per phase.** The reference is on screen. A page for the bus ride is a different use.
6. **Pronunciation scoring only with a real provider.** The app correctly shows nothing rather than a guess. Keep that until a provider is chosen.
7. **Do not add a level badge, a streak that punishes a missed day, or a leaderboard.** The streak that exists counts study days and says so. A guilt streak fights the spacing research, which wants people to come back after a gap.

## What not to build

- A second curriculum. The 120 days are the product.
- Automatic CEFR or NCLC from practice scores. The official scale is calibrated. A raw 28/40 is not an NCLC.
- Rewriting the dictionary by model without a reviewer. The hindi fix in this pass was a contradiction inside the repo, checked against the app’s own h-aspiré list, not a fresh generation.
