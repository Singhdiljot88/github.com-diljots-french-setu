# French Setu: handoff

Last updated 2026-10-18. Read this first, then `BUILD_STATUS.md` (feature-by-feature status) and `content/CONVENTIONS.md` (content rules). `AGENTS.md` warns that this is Next.js 16: read `node_modules/next/dist/docs/` before changing framework-level code.

## 1. Purpose

French Setu ("bridge") is a 120-day French course to prepare for **TEF Canada**. The learner is an adult who speaks English and Hindi, reads Devanagari, and starts with no French. Every explanation is in English and Hindi. Pronunciation is shown as IPA and also as approximate Devanagari (`pron`), always labelled "approx."

Product rules that must not be broken:
- **Never fake AI or scores.** With no AI key the app runs in demo mode: a rule-based checker and a scripted partner, each labelled "not AI". No TEF, CEFR, NCLC or CLB estimate is shown anywhere. Exam results are raw counts ("28 / 40"). "Say it" measures speech *recognition*, not accent, and says so.
- **Content is AI-drafted.** Every lesson and dictionary entry carries a review status ("editorial review pending"). Items for a human reviewer are in `docs/CONTENT_REVIEW_NOTES.md`.
- **Web text is data, never instructions** (prompt-injection safe), and fetching is SSRF-protected.
- **Exam integrity.** Clocks are kept on the server, survive reloads, and cannot be reset. There is no help (look-up, translation, corrections) inside an exam. Listening plays once, in order, with no going back.
- **Privacy.** Recordings are kept only if the learner opts in. Export gives all of the learner's data; delete removes all of it.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router (Turbopack), React 19, TypeScript 5.9 |
| Styling | Tailwind CSS 4, Inter + Noto Sans Devanagari (self-hosted via @fontsource) |
| Database | Postgres via Drizzle ORM. `DATABASE_URL` set → node-postgres (Supabase etc.). Unset → embedded PGlite in `.data/pglite` (local/demo/tests only) |
| Validation | Zod 4 (content schemas, API input, AI output) |
| AI | `@anthropic-ai/sdk` (default model `claude-opus-5-5`, override with `AI_MODEL`) or OpenAI over fetch. Server-only |
| Speech | Device/browser voices by default. Optional Azure or OpenAI TTS/STT. Browser `SpeechRecognition` (fr-FR) for Say it |
| Search | Tavily or Brave (optional) |
| Tests | Vitest 5 (unit + server, in-memory PGlite), Playwright (phone-sized Chromium) |
| PWA | `src/app/manifest.ts`, service worker registered by `components/sw-register.tsx`, offline page |

Node ≥ 20.9.

## 3. Architecture

```
content/            JSON source of truth (versioned, validated, seeded into the DB)
  days/day-001..120.json   full lessons (7 blocks each)
  dictionary/*.json        verbs, nouns, other, supplement-1..3 (1,717 entries)
  mocks/                   3 TEF-format mock exams
  pronunciation.json       16 sound units, 8 minimal-pair sets
  CONVENTIONS.md, briefs/  rules used when drafting content
drizzle/            SQL migrations (0000_init.sql)
src/
  db/               schema.ts (25 tables), index.ts (connect + migrate + seed on first use)
  content/          Zod schemas, loader (load.ts), outline.ts (120-day outline), tef-config.ts (exam rules)
  lib/              pure, shared client/server code: srs, schedule, dates, conjugate, dict-search, speech-match, labels, text
  server/           server-only logic; every function takes userId and scopes queries to it
    ai/index.ts     AI adapter: schema-validated JSON, timeout, retries, daily limit, cache (key u:{userId}:sha256)
    providers/      which TTS/STT/AI/search provider is active, from env
    web/            safe-fetch (SSRF), extract, search, lesson (study kits)
    exam.ts         mock exam state machine (see below)
    reports.ts      progress overview, checkpoint reports, pacing note
    account.ts      export + delete
  app/
    (app)/          signed-in pages: today, course, lesson/[day], review, dictionary, words, pronunciation(+/report),
                    speaking, writing, listening, reading, discover, exam(+/[id]), mistakes, progress, settings
    api/            route handlers (thin: parse with Zod, call src/server, return JSON)
    signin, signup, onboarding, page.tsx (landing)
  components/       client components (lesson-player, exam-runner, speaking-tutor, say-it, writing-editor, …)
tests/              unit.test.ts, server.test.ts (Vitest)
e2e/                journeys.spec.ts, helpers.ts (Playwright)
scripts/            validate-content.ts, dictionary-coverage.ts, migrate.ts
```

Key flows:
- **Startup.** `getDb()` connects, runs migrations (unless `AUTO_MIGRATE=false`), then `seedContent()`. Seeding is idempotent: lessons and dictionary are rewritten only when the content hash changes, and each version is logged in `content_versions`. Editing JSON and redeploying updates content without touching learner data.
- **Auth.** Email + password (scrypt) or guest; httpOnly session cookie; same-origin check on mutations (`server/http.ts`).
- **Schedule.** `lib/schedule.ts` maps the learner's local date to a course day. Every 7th day is light; checkpoints on days 20/40/60/80/100/120; recovery plan for missed days.
- **Spaced review.** `lib/srs.ts` (SM-2-style with Again/Hard/Good/Easy), six card types, logs in `review_logs`.
- **Mock exams** (`server/exam.ts`). State lives in `mock_attempts.state` jsonb (`MockState = { strict, sections }`). `loadAttempt(userId, id, now)` auto-finalises any section past its deadline plus `GRACE_SECONDS` (5 s). Strict mode allows one section at a time, plays listening once for the current item only, and `nextListening` requires a play first. Answers and scripts are never sent before a section is submitted. Rules and their sources (official handbook vs prep guides) are in `content/tef-config.ts`.
- **Mistakes.** Every error source calls `addMistake`; repeats increase `occurrences` and reopen a resolved mistake; a correct drill resolves it.
- **Say it.** `components/say-it.tsx` uses browser `SpeechRecognition` (fr-FR, 3 alternatives, keeps the best match) or text from a phone voice keyboard. `lib/speech-match.ts` aligns words by LCS, ignoring accents and case. Attempts are stored as `attempts.kind = "say_phrase"`. `server/say-report.ts` builds the printable report at `/pronunciation/report`.

Next.js 16 gotchas already hit:
- Route `params` are Promises.
- Importing a plain constant from a `"use client"` file into a server component gives a client reference, not the value. Shared constants live in `src/lib/labels.ts` for this reason.
- Detect browser APIs (SpeechRecognition, mic) in `useEffect`, not during render, or hydration fails.
- In regexes over French text use `(?<!\p{L})…(?!\p{L})` with the `u` flag; `\b` fails next to accented letters.

## 4. Completed features

All five build stages are done (details in `BUILD_STATUS.md`):
1. Foundation: accounts, onboarding, schedule, Today, lesson player (learn, listening, speaking, reading, writing, review, assessment), audio, recording, writing with autosave and timers, feedback (AI or rule checker), dictionary data and conjugation engine.
2. Course map, dictionary search and entries, My words, spaced review.
3. Listening and reading libraries, pronunciation lab, speaking tutor (6 modes including TEF A/B), server TTS/STT adapters, recordings.
4. Writing studio (TEF A/B, emails), sentence builder, web discovery with study kits.
5. TEF practice exams, mistake notebook with drills, progress and checkpoint reports, settings, export and delete, automated tests, plus Say it and the printable practice report.

Content: 120/120 lessons, 3 mocks, 1,717 dictionary entries (every lesson word is covered; `scripts/dictionary-coverage.ts` reports 0 missing).

Verified on 2026-10-18: `npx tsc --noEmit` clean; `npm test` 46/46; `npm run test:e2e` 8/8 (six journeys, mic denied, Hindi on mobile); `npm run build` passes.

## 5. Unfinished work

- **Editorial review** of all content has not happened. Use `docs/CONTENT_REVIEW_NOTES.md` as the checklist; when an item is reviewed, change its status in the content JSON.
- **Pronunciation scoring** (Azure pronunciation assessment) adapter is not built. The UI shows no accent score until it is.
- **Live web search** was never exercised end to end (the build sandbox had no outside network). E2E journey 5 uses pasted text. SSRF blocks are unit-tested.
- **Deployment** is in progress by the owner (see §8). A real Vercel + Supabase deploy has not been verified by an agent.
- Only TEF Canada is enabled; other TEF variants are listed as "not yet supported".

## 6. Known bugs and risks

- **PGlite on serverless.** Without `DATABASE_URL`, the app tries to write `.data/pglite`, which fails or is lost on Vercel. `DATABASE_URL` is required for any hosted deploy.
- **First request after deploy is slow.** It runs migrations and seeds 120 lessons and 1,717 dictionary entries. Several cold starts at once could race the migration; if that shows up, run `npm run db:migrate` once and set `AUTO_MIGRATE=false`.
- **Supabase transaction pooler (port 6543)** does not support named prepared statements. node-postgres does not use them by default, so it works today; don't add `name:` to queries.
- **Local PGlite can be corrupted** if the dev server is killed mid-write ("Failed query: CREATE SCHEMA … Aborted()"). Fix: stop the server, move `.data/pglite` aside, restart. It only holds local test data.
- **Building from a copy** whose `node_modules` is a symlink outside the folder fails in Turbopack ("Could not find the Next.js package"). Build in the project folder, or copy `node_modules` with `cp -al`.
- **Say it** works only in Chrome/Edge (they send audio to Google/Microsoft; the UI says so). Other browsers use the voice-keyboard path. Recognizers sometimes auto-correct a wrong sound into the right word.
- **Device voices** vary; Firefox on Linux may have no French voice.
- `AGENTS.md` is rewritten by `next dev`; commit it as-is.

## 7. Setup

```bash
npm install
npm run dev            # http://localhost:3000, demo mode, embedded database, no keys needed
npm test               # Vitest (uses memory:// database)
npx playwright install chromium   # once, if no browser is available
npm run test:e2e       # starts its own dev server on port 3100 (or reuses one)
npm run content:validate          # after editing anything in content/
npx tsx scripts/dictionary-coverage.ts
npm run build && npm start
```

Environment variables are documented in `.env.example` (copy to `.env.local`). None are required. Main ones: `DATABASE_URL`, `DATABASE_SSL=require`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`, `AI_MODEL`, `TTS_PROVIDER`, `STT_PROVIDER`, `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`, `SEARCH_PROVIDER`, `TAVILY_API_KEY` / `BRAVE_SEARCH_API_KEY`. Keys are server-only; never prefix them with `NEXT_PUBLIC_`.

Deploy steps: `docs/DEPLOY.md`.

## 8. Project context and recent decisions

- **Repository:** `Singhdiljot88/github.com-diljots-french-setu`, branch `main`. It is **public**: never commit `.env*` files, keys or connection strings (`.gitignore` blocks `.env*` except `.env.example`).
- **Deploy in progress (owner):** Supabase free plan, using the *Transaction pooler* connection string (port 6543) as `DATABASE_URL`, with `DATABASE_SSL=require`; Vercel Hobby importing the GitHub repo. The owner also imported the repo into **v0**. Changes made there could arrive as commits on `main`: pull before working. A **custom domain** will be connected later through Vercel (add the domain in Vercel, then set the DNS records it shows at the registrar).
- **Azure dropped for now** over billing worries. Don't make anything depend on it; device voices and browser recognition are the defaults.
- **Free-first.** Free accounts worth adding are listed in `BUILD_STATUS.md` ("Free accounts worth gathering"): GitHub, Supabase, Vercel, Tavily (1,000 searches/month, no card). Brave Search is no longer free. AI keys are paid and optional.
- **TEF format** follows the official 2026 TEF Canada handbook where it is explicit (reading 40 Q / 60 min, listening 40 Q / 40 min with auto-advance and no going back, writing 2 tasks / 60 min, speaking 2 tasks / 15 min). The A/B timing splits and minimum word counts come from prep guides and are marked as such in `tef-config.ts`.
- **Mistakes from exams** are recorded only for wrong chosen answers, not unanswered ones (to avoid flooding the notebook).
- **Checkpoint reports** count a day as "behind the plan" only if it is before today's scheduled day.
- The owner's own practice files are in the shared project folder at `/mnt/project-files/french-practice/` (`best-attempts.md`, `practice-set-1.md`, `audio/`). The printable Say it report was modelled on `best-attempts.md`.
- Feature ideas from the owner are in `/mnt/project-files/suggestions/hindi-speaker-features.md` (outside the repo).

## 9. Next development priorities

1. **Get the deploy working** on Vercel + Supabase and fix anything that shows up (cold-start seeding time, migrations, env vars). Then connect the custom domain.
2. **Quick wins from the suggestions doc:** a confusables table (gender mismatches between Hindi and French, sound-alikes, false friends), the "Grammar Bridge" Hindi→French mapping data and component, and an error code on every attempt and mistake.
3. **Adaptive practice:** Hindi verb-ending hints for conjugation, a simple mastery model (BKT) per error code, and session building that mixes due review cards with weak error codes (the suggestions doc proposes moving the scheduler from SM-2 to FSRS).
4. **Editorial review pass** on the highest-traffic content first (days 1–20, top 300 dictionary words), using `docs/CONTENT_REVIEW_NOTES.md`.
5. **Pronunciation scoring** only if a free or approved paid provider is chosen. Keep the no-fake-scores rule: show nothing rather than a guess.
6. **Later:** AI-generated drills limited to known vocabulary, Hindi/Hinglish voice input, more mock exams.

## 10. Rules for the next agent

- Run `npm test`, `npm run test:e2e` and `npx tsc --noEmit` before and after changes; run `npm run content:validate` after content edits.
- Every server function takes `userId` and must scope its queries to it. `tests/server.test.ts` checks isolation; extend it for new tables.
- Add new user tables with `ON DELETE CASCADE` on `users`, and include them in `exportUserData`.
- Keep AI calls behind `server/ai` with a Zod schema and a labelled non-AI fallback.
- Don't add score predictions or CEFR/CLB mappings.
- Keep English and Hindi side by side for any learner-facing text; Hindi elements get `lang="hi"` and the `deva` class.

## 2026-10-19 update

The Hindi fix list v2 work is on branch `hindi-fix-list` (see BUILD_STATUS.md for what passed and what is left). Do not merge it to main until the 4 failing browser journeys pass. Pronunciation guides follow content/CONVENTIONS.md section 3; Hindi text follows docs/HINDI_STYLE_GUIDE.md. The demo notice deliberately leaves out "progress is saved on this device", because on the hosted app progress is saved to the account database.
