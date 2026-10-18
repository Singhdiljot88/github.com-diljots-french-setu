# Deploying French Setu

The app is a standard Next.js server. It needs a Node.js host and, online, a real Postgres database. The embedded PGlite database is only for running on one computer.

## Free option: Vercel + Supabase

1. **Database.** Create a free project at https://supabase.com. In Project settings → Database, copy the connection string labelled *Transaction pooler* (port 6543).
2. **Code.** Put this folder in a GitHub repository.
3. **Host.** At https://vercel.com, choose Add New → Project and import the repository. Under Environment Variables add:
   - `DATABASE_URL`: the Supabase string, with your password filled in.
   - `DATABASE_SSL`: `require`
   - Optionally `ANTHROPIC_API_KEY` for AI writing feedback.
4. Deploy. On the first request, the tables are created and the course is loaded.

## Other hosts

Render, Railway and Fly.io work the same way: build command `npm run build`, start command `npm start`, and the same environment variables. Any Postgres 14+ works for `DATABASE_URL`.

## Notes

- Migrations run at startup unless `AUTO_MIGRATE=false`. To run them separately, use `DATABASE_URL=… npm run db:migrate`.
- Content is loaded into the database when its hash changes, so redeploying with edited JSON updates lessons without touching learner data.
- Recordings are not stored on the server unless a learner opts in under Settings.
- API keys are read only on the server. Never prefix them with `NEXT_PUBLIC_`.
