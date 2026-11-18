-- Lock learner tables against the Supabase public API (roles anon and authenticated).
-- The app connects as the table owner through DATABASE_URL. Table owners bypass row
-- level security unless it is FORCED, so this does not change how the app reads or writes.
-- Do not add FORCE ROW LEVEL SECURITY. No policies are granted to anon or authenticated.
DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'users', 'sessions', 'profiles', 'content_versions', 'lessons', 'dict_entries', 'content_reports',
    'day_progress', 'study_log', 'attempts', 'saved_words', 'review_cards', 'review_logs',
    'writing_drafts', 'writing_revisions', 'writing_feedback', 'speaking_sessions', 'recordings',
    'mistakes', 'mock_attempts', 'checkpoint_reports', 'web_resources', 'ai_usage', 'ai_cache', 'tts_cache'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', rel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', rel);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', rel);
    END IF;
  END LOOP;
END $$;
