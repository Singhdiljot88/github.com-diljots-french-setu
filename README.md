# French Setu — 120 Days to TEF

A French course for English- and Hindi-speaking beginners preparing for TEF Canada: 120 scheduled days, a Hindi/English dictionary, spaced review, writing and speaking practice and timed mock exams.

It runs with **no paid keys**. In that mode it is clearly labelled *Demo*: audio uses your device's French voice, writing feedback is a rule-based checker labelled "not AI", and no pronunciation score is shown.

## Run it on your computer

You need [Node.js 20.9 or newer](https://nodejs.org) (the LTS installer is fine).

```bash
cd french-setu
npm install
npm run dev
```

Open http://localhost:3000, then choose **Try it as a guest** or create an account. The first start takes a few seconds while the built-in database is created and the course is loaded.

No database server is needed: data is kept in `.data/pglite` inside the folder. Delete that folder to start over.

For audio, Chrome, Edge and Safari include French voices. On Windows you may need to add one: Settings → Time & language → Speech → Add voices → French.

## Use your own keys (optional)

Copy `.env.example` to `.env.local` and fill in what you have. Restart `npm run dev` afterwards.

| Feature | Without a key | With a key |
|---|---|---|
| Writing feedback | Rule-based checker, labelled "not AI" | `ANTHROPIC_API_KEY` (Claude) or `OPENAI_API_KEY` |
| Database | Embedded PGlite in `.data/` | `DATABASE_URL` (Postgres, Supabase, Neon) |

See [docs/DEPLOY.md](docs/DEPLOY.md) for putting it online, and [BUILD_STATUS.md](BUILD_STATUS.md) for what is built so far.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` then `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run content:validate` | Validate every lesson, dictionary and mock file |
| `npm test` | Unit tests (Vitest) |
| `npm run db:generate` | New SQL migration after editing `src/db/schema.ts` |

## Where things are

- `content/`: the course itself, as JSON (days, dictionary, mock exams), plus `CONVENTIONS.md` for the Devanagari pronunciation scheme. All of it is AI-drafted and marked "editorial review pending" in the app until a human reviewer signs it off.
- `docs/CONTENT_REVIEW_NOTES.md`: specific items flagged for that review.
- `src/db/schema.ts` and `drizzle/`: database schema and migrations.
- `src/server/`: server logic (auth, schedule, SRS, writing, AI adapter in `src/server/ai`).
- `src/app/`: pages and API routes.
