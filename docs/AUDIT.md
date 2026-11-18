# Audit — 18 November 2026

Scope: the French Setu codebase, a local build and test run, and the live sites `https://shabdsetu.diljots.com` and `https://github-com-diljots-french-setu.vercel.app`. Supabase and the Vercel runtime-error API could not be opened from this session (Supabase MCP needs a login; Vercel returned 403 for team `team_EeoH9xE6oUqbkiMGMAWUj8wB`). Findings that need those consoles are marked as Diljot's action.

Severity: **high** can expose data or teach the wrong French. **medium** misleads or blocks a learner. **low** is rough but not harmful.

## Fixed in this branch

| Severity | Where | What | Status |
|---|---|---|---|
| High | `content/days/day-009.json`, `content/dictionary/nouns.json` (`langue`), `content/dictionary/supplement-2.json` (`hindi`) | Day 9 taught `l'hindi` (“silent h, so elide”). The dictionary and `src/lib/elision.ts` treat `hindi` as h aspiré: `le hindi`, never `l'hindi`. The reading, the evidence quote and the dictionary notes now agree. | Fixed |
| High | `src/server/auth.ts` `signIn` | An unknown email returned before the password hash ran, so it answered faster than a wrong password. A dummy scrypt verify now runs in the unknown-email path. | Fixed |
| High | `drizzle/0001_rls.sql` | Tables live in `public` and the init migration never enabled row-level security. Supabase grants `public` tables to `anon` and `authenticated` by default, and those roles reach PostgREST with the anon key. The app itself does not use that key (it uses `DATABASE_URL` as the table owner, which bypasses RLS). The new migration enables RLS and revokes `anon` / `authenticated` when those roles exist. It does not `FORCE` RLS, so the owner's connection keeps working. Local PGlite has no `anon` role; the revoke is skipped there. | Fixed in the migration. Applied on the next deploy because `AUTO_MIGRATE` defaults to true. See “Diljot” below before merging if you want to run it by hand first. |
| Medium | `src/app/api/auth/signin/route.ts`, `signup/route.ts`, `guest/route.ts`, `src/lib/rate-limit.ts` | Sign-in, sign-up and guest creation had no limit. A guest account is a full user row. There is now a per-instance limit (10 sign-ins / 10 minutes per address and email, 8 sign-ups or guest sessions / 10 minutes per address). On Vercel each instance has its own counter, so this slows a burst, it does not stop a distributed one. | Fixed, with that limit |
| Medium | `src/app/api/auth/guest/route.ts` | A failed `signUp` still returned `{ ok: true }` and set no cookie. It now returns 503. | Fixed |
| Low | `src/app/layout.tsx` | The skip link was English only. It now includes Hindi. | Fixed |
| Low | `src/components/doc-lang.tsx`, `src/app/(app)/layout.tsx` | `<html lang>` stayed `en` in Hindi-only mode, so a screen reader used the wrong language. Signed-in pages now set `lang` from the explanation language. | Fixed |
| Low | `next.config.ts` | `X-Powered-By: Next.js` was sent. `poweredByHeader` is now false. The live site still sends it until this deploys. | Fixed |
| Medium | Grammar was only inside each day. Verb tables were read-only. Situation phrases were scattered. | `/grammar` and `/phrases` are the learner-facing fix. They are described in `docs/RESEARCH.md`. | Fixed |

## Checked and not a defect

| Severity | Where | What |
|---|---|---|
| — | Live responses, 18 November 2026 | Both hosts returned HTTP 200. Headers already include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (microphone self only), and HSTS (`max-age=63072000`). HSTS is added by Vercel, not by `next.config.ts`. |
| — | `src/server/http.ts`, `src/server/auth.ts` | Mutations check `Origin` against the host. The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. The token stored in the database is a SHA-256 of the cookie, not the cookie itself. Passwords are scrypt. |
| — | `src/server/web/safe-fetch.ts` | Web discovery blocks private addresses, odd ports and non-http schemes. Covered by unit tests. |
| — | Keys | No `NEXT_PUBLIC_` secret. `OPENAI_API_KEY` is read only in server modules and route handlers. |
| — | Speech routing | Left as it was. With `OPENAI_API_KEY` set and `STT_PROVIDER` unset, transcription already uses OpenAI (unless a Speko key is also set, which wins). This branch does not change that. |
| — | `content/days/day-104.json` writing prompt | The paragraph with `les gens fait` and `plus bon` is the text the learner is asked to correct. The hints name those errors. |
| — | `personne n'a été blessé` in day 104 | Traditional agreement: `personne` is masculine. Not changed. |
| — | `payer` / `essayer` future stem `paier` / `essaier` | Both `je paierai` and `je payerai` are accepted French. The engine teaches one. Noted in `docs/CONTENT_REVIEW_NOTES.md`. Not changed. |
| — | Gender “mismatches” from a script | Day 33’s season list is lemmatised as `saison` (feminine) while the four seasons are masculine; the French and the note are right. `l'institutrice` points at the masculine headword `instituteur`, which stores the feminine form. `un poste` (a job, masculine) and `la poste` (the post office, feminine) share one dictionary entry; the entry’s mistake note says so. |

## Open — needs Diljot

| Severity | Where | What | Action |
|---|---|---|---|
| High | Supabase project, not visible from here | Confirm the migration actually landed and that the app still reads data. Then confirm PostgREST as `anon` cannot `select` from `users` (that table holds password hashes). | After deploy, open the Supabase SQL editor and run `select relname, relrowsecurity from pg_class where relname = 'users';` Expect `relrowsecurity = true`. A request with the anon key to `/rest/v1/users` should return no rows. If the app itself starts returning 500s, the connection role is not the table owner: do not `FORCE` RLS; say so and we can grant that role. |
| High | Vercel runtime logs | This session could not call `get_runtime_errors` (403, team `singhdiljots-projects`). | Approve the Vercel team link if it is still offered, or open the project’s runtime errors for the last 7 days. Nothing in the local test run suggests a crash, but production logs were not read. |
| Medium | `AUTO_MIGRATE` | The RLS migration runs on the next boot. A cold start also reseeds content when the lesson hash changes (day 9 and two dictionary files changed). | Expected. The first request after deploy will be slow. If two cold starts race, run `npm run db:migrate` once and set `AUTO_MIGRATE=false`, as `HANDOFF.md` already says. |
| Medium | Content review | All 120 lessons and the dictionary are still `draft_ai`. The audit script found no other article/gender clash of the `l'hindi` kind, but that is not a native-speaker review. | `docs/CONTENT_REVIEW_NOTES.md`. Days 1–20 and the most common nouns first. |
| Medium | `src/lib/rate-limit.ts` | The limiter is in memory. It will not stop a distributed flood of guest accounts. | If guest rows grow, add a database counter or turn guest creation off. No schema was added for that, on purpose. |
| Low | `/grammar?all=1` | Loading every grammar point at once is about 2 MB. The default page sends only days the learner has reached (about 55 KB on day 1). | Leave the full list as an explicit click. |
| Low | `src/app/privacy/page.tsx` | Still a draft: no operator name or contact. | Add those before any paid launch. The OpenAI paragraph was updated to match the code. |
| Low | Days 101–120 | `BUILD_STATUS.md` already notes some readings under the 200-word target. | Content work, not done in this pass. |
| Info | Env var | AI chat features read **`OPENAI_API_KEY`**. That is the name already used by `/api/tts` and `/api/stt`. It is already set on the Vercel project. This branch does not rename it, does not add a second variable, and does not change the value. | No action. If the variable is removed, those features fall back to the labelled demo checker and the scripted speaking partner. |

## How the checks were run

- Header check of both public hosts with `curl -sI`.
- A script over all 120 lessons and 1,717 dictionary entries for noun-gender clashes and `l'` plus an h-aspiré word. The only aspiré hit was `l'hindi`, which is fixed.
- `npm test`, `npm run typecheck`, `npm run content:validate`, and `npm run build` on this branch. Results are in the pull request.
- Browser pass of the new grammar and phrasebook pages against the local server, described in the pull request.
