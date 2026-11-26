CREATE TABLE "evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "skill" text NOT NULL,
  "source_ref" text NOT NULL,
  "provider" text NOT NULL,
  "is_demo" boolean NOT NULL,
  "overall" real NOT NULL,
  "nclc" integer NOT NULL,
  "evaluation" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
  "user_id" uuid NOT NULL,
  "key" text NOT NULL,
  "note" jsonb NOT NULL,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "milestones_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "evaluations_user_idx" ON "evaluations" USING btree ("user_id","created_at");
--> statement-breakpoint
DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['evaluations', 'milestones']
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
