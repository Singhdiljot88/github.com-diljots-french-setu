import {
  pgTable, text, uuid, timestamp, integer, boolean, jsonb, real, date, primaryKey, index, uniqueIndex, customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => Buffer.from(v),
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

// ───────────────────────── Accounts ─────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  isGuest: boolean("is_guest").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const sessions = pgTable("sessions", {
  /** sha256 of the session token; the raw token only lives in the cookie */
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default(""),
  explanationLang: text("explanation_lang").$type<"en" | "hi" | "both">().notNull().default("both"),
  dailyMinutes: integer("daily_minutes").$type<45 | 90 | 150 | 180>().notNull().default(150),
  pace: text("pace").$type<"compact" | "complete">().notNull().default("complete"),
  /** Local calendar date (YYYY-MM-DD) in the learner's time zone */
  startDate: date("start_date", { mode: "string" }).notNull(),
  examDate: date("exam_date", { mode: "string" }),
  examVariant: text("exam_variant").notNull().default("tef_canada"),
  examVariantConfirmed: boolean("exam_variant_confirmed").notNull().default(false),
  desiredOutcome: text("desired_outcome").notNull().default(""),
  experience: text("experience").$type<"none" | "other_language" | "some_french">().notNull().default("none"),
  entryPath: text("entry_path").$type<"absolute_beginner" | "placement">().notNull().default("absolute_beginner"),
  placementDay: integer("placement_day").notNull().default(1),
  micOptIn: boolean("mic_opt_in").notNull().default(false),
  slowAudioDefault: boolean("slow_audio_default").notNull().default(true),
  /** auto = follow the course scaffolding schedule; always / never override it */
  devanagariMode: text("devanagari_mode").$type<"auto" | "always" | "never">().notNull().default("auto"),
  showIpa: boolean("show_ipa").notNull().default(false),
  keepRecordings: boolean("keep_recordings").notNull().default(false),
  timezone: text("timezone").notNull().default("UTC"),
  /** Days the schedule was shifted by recovery plans (keeps completed work, moves future days) */
  scheduleShiftDays: integer("schedule_shift_days").notNull().default(0),
  onboardedAt: ts("onboarded_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ───────────────────────── Versioned content ─────────────────────────

export const contentVersions = pgTable("content_versions", {
  id: text("id").primaryKey(), // e.g. "curriculum-v1", "dictionary-v1"
  kind: text("kind").notNull(),
  hash: text("hash").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: createdAt(),
});

export const lessons = pgTable("lessons", {
  curriculumVersion: text("curriculum_version").notNull(),
  day: integer("day").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  contentHash: text("content_hash").notNull(),
  /** draft_ai = AI-drafted, not yet reviewed by a human editor */
  reviewStatus: text("review_status").$type<"draft_ai" | "in_review" | "reviewed">().notNull().default("draft_ai"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.curriculumVersion, t.day] })]);

export const dictEntries = pgTable("dict_entries", {
  id: text("id").primaryKey(), // lemma|pos slug
  version: text("version").notNull(),
  lemma: text("lemma").notNull(),
  pos: text("pos").notNull(),
  data: jsonb("data").notNull(),
  source: text("source").notNull(),
  reviewStatus: text("review_status").notNull().default("draft_ai"),
}, (t) => [index("dict_lemma_idx").on(t.lemma)]);

export const contentReports = pgTable("content_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ref: text("ref").notNull(),
  contentVersion: text("content_version").notNull(),
  message: text("message").notNull(),
  createdAt: createdAt(),
});

// ───────────────────────── Learning progress ─────────────────────────

export const dayProgress = pgTable("day_progress", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  curriculumVersion: text("curriculum_version").notNull(),
  status: text("status").$type<"in_progress" | "completed">().notNull().default("in_progress"),
  /** Completed activity blocks: { review: true, listening: true, ... } */
  activities: jsonb("activities").$type<Record<string, boolean>>().notNull().default({}),
  assessmentScore: real("assessment_score"),
  startedAt: ts("started_at").notNull().defaultNow(),
  completedAt: ts("completed_at"),
}, (t) => [primaryKey({ columns: [t.userId, t.day] })]);

export const studyLog = pgTable("study_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  localDate: date("local_date", { mode: "string" }).notNull(),
  activity: text("activity").notNull(),
  minutes: real("minutes").notNull(),
  createdAt: createdAt(),
}, (t) => [index("study_log_user_date_idx").on(t.userId, t.localDate)]);

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: integer("day"),
  kind: text("kind").notNull(), // assessment | listening | reading | dictation | gapfill | drill | minimal_pair | review
  itemRef: text("item_ref").notNull(),
  skill: text("skill").$type<Skill>().notNull(),
  correct: boolean("correct"),
  score: real("score"),
  response: jsonb("response"),
  contentVersion: text("content_version"),
  createdAt: createdAt(),
}, (t) => [index("attempts_user_skill_idx").on(t.userId, t.skill, t.createdAt)]);
export type Skill = "reading" | "listening" | "speaking" | "writing" | "vocabulary" | "grammar" | "pronunciation";

// ───────────────────────── Vocabulary & spaced repetition ─────────────────────────

export const savedWords = pgTable("saved_words", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entryId: text("entry_id"),
  fr: text("fr").notNull(),
  en: text("en").notNull(),
  hi: text("hi").notNull().default(""),
  gender: text("gender"),
  isPhrase: boolean("is_phrase").notNull().default(false),
  source: text("source").$type<"dictionary" | "lesson" | "web" | "custom" | "mistake">().notNull(),
  sourceRef: text("source_ref"),
  personalExample: text("personal_example"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("saved_words_user_fr_idx").on(t.userId, t.fr)]);

export const reviewCards = pgTable("review_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  savedWordId: uuid("saved_word_id").references(() => savedWords.id, { onDelete: "cascade" }),
  /** recall mode */
  kind: text("kind").$type<CardKind>().notNull(),
  state: text("state").$type<"new" | "learning" | "review" | "relearning">().notNull().default("new"),
  ease: real("ease").notNull().default(2.5),
  intervalDays: real("interval_days").notNull().default(0),
  step: integer("step").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  dueAt: ts("due_at").notNull().defaultNow(),
  firstAddedAt: createdAt(),
  firstReviewedAt: ts("first_reviewed_at"),
  lastReviewedAt: ts("last_reviewed_at"),
}, (t) => [index("review_cards_due_idx").on(t.userId, t.dueAt), uniqueIndex("review_cards_word_kind_idx").on(t.savedWordId, t.kind)]);
export type CardKind = "fr_to_meaning" | "meaning_to_fr" | "audio" | "gender" | "dictation" | "cloze";

export const reviewLogs = pgTable("review_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").notNull().references(() => reviewCards.id, { onDelete: "cascade" }),
  rating: text("rating").$type<"again" | "hard" | "good" | "easy">().notNull(),
  answer: text("answer"),
  prevState: text("prev_state").notNull(),
  prevDueAt: ts("prev_due_at").notNull(),
  prevIntervalDays: real("prev_interval_days").notNull(),
  nextDueAt: ts("next_due_at").notNull(),
  nextIntervalDays: real("next_interval_days").notNull(),
  reviewedAt: createdAt(),
}, (t) => [index("review_logs_card_idx").on(t.cardId)]);

// ───────────────────────── Writing ─────────────────────────

export const writingDrafts = pgTable("writing_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskType: text("task_type").notNull(),
  taskRef: text("task_ref").notNull(),
  mode: text("mode").$type<"learn" | "practice" | "exam">().notNull(),
  text: text("text").notNull().default(""),
  wordCount: integer("word_count").notNull().default(0),
  status: text("status").$type<"draft" | "submitted">().notNull().default("draft"),
  timerStartedAt: ts("timer_started_at"),
  timeLimitSec: integer("time_limit_sec"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("writing_drafts_user_idx").on(t.userId, t.updatedAt)]);

export const writingRevisions = pgTable("writing_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftId: uuid("draft_id").notNull().references(() => writingDrafts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  reason: text("reason").$type<"autosave" | "manual" | "submit" | "retry">().notNull(),
  createdAt: createdAt(),
});

export const writingFeedback = pgTable("writing_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftId: uuid("draft_id").notNull().references(() => writingDrafts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id").references(() => writingRevisions.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  isDemo: boolean("is_demo").notNull(),
  feedback: jsonb("feedback").notNull(),
  createdAt: createdAt(),
});

// ───────────────────────── Speaking ─────────────────────────

export const speakingSessions = pgTable("speaking_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  scenarioRef: text("scenario_ref").notNull(),
  turns: jsonb("turns").$type<SpeakingTurn[]>().notNull().default([]),
  feedback: jsonb("feedback"),
  provider: text("provider").notNull(),
  isDemo: boolean("is_demo").notNull(),
  createdAt: createdAt(),
  endedAt: ts("ended_at"),
});
export type SpeakingTurn = { role: "learner" | "partner"; text: string; at: string; via?: "typed" | "speech_browser" | "speech_server"; help?: { en?: string; hi?: string } };

/** Only written when the learner has opted in to keeping recordings. */
export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  ref: text("ref").notNull(),
  mime: text("mime").notNull(),
  audio: bytea("audio").notNull(),
  createdAt: createdAt(),
});

// ───────────────────────── Mistakes ─────────────────────────

export const mistakes = pgTable("mistakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").$type<MistakeCategory>().notNull(),
  source: text("source").notNull(),
  sourceRef: text("source_ref"),
  original: text("original").notNull(),
  corrected: text("corrected").notNull(),
  explanation: jsonb("explanation").$type<{ en: string; hi?: string }>().notNull(),
  /** Short practice exercise derived from the mistake */
  drill: jsonb("drill").$type<{ prompt: string; answer: string; accept?: string[] } | null>(),
  occurrences: integer("occurrences").notNull().default(1),
  resolved: boolean("resolved").notNull().default(false),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [index("mistakes_user_idx").on(t.userId, t.category)]);
export type MistakeCategory = "grammar" | "spelling" | "gender" | "agreement" | "tense" | "vocabulary" | "organization" | "comprehension" | "pronunciation";

// ───────────────────────── Exams ─────────────────────────

export const mockAttempts = pgTable("mock_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mockId: text("mock_id").notNull(),
  variant: text("variant").notNull(),
  configVersion: text("config_version").notNull(),
  /** Which sections this attempt includes, e.g. ["reading","listening"] */
  sections: jsonb("sections").$type<string[]>().notNull(),
  state: jsonb("state").$type<MockState>().notNull(),
  status: text("status").$type<"in_progress" | "completed">().notNull().default("in_progress"),
  createdAt: createdAt(),
  completedAt: ts("completed_at"),
}, (t) => [index("mock_attempts_user_idx").on(t.userId)]);

export type SectionState = {
  startedAt?: string;
  deadline?: string;
  submittedAt?: string;
  autoSubmitted?: boolean;
  /** question id → chosen option index (reading/listening) or task key → text (writing) */
  answers: Record<string, number | string>;
  /** listening: index of the current recording; earlier ones are locked */
  position?: number;
  /** listening: recording indexes whose audio has been started */
  played?: number[];
  /** speaking: one conversation per task, each with its own server deadline */
  tasks?: Record<string, { sessionId: string; startedAt: string; deadline: string; endedAt?: string }>;
  /** writing: feedback per task, requested after the section closes */
  feedback?: Record<string, unknown>;
};
export type MockState = { strict: boolean; sections: Record<string, SectionState> };

export const checkpointReports = pgTable("checkpoint_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  report: jsonb("report").notNull(),
  createdAt: createdAt(),
});

// ───────────────────────── Web discovery ─────────────────────────

export const webResources = pgTable("web_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url"),
  title: text("title").notNull(),
  publisher: text("publisher"),
  publishedAt: text("published_at"),
  retrievedAt: ts("retrieved_at").notNull().defaultNow(),
  excerpt: text("excerpt").notNull(),
  origin: text("origin").$type<"search" | "url" | "pasted">().notNull(),
  difficultyEstimate: text("difficulty_estimate"),
  lesson: jsonb("lesson"),
  lessonProvider: text("lesson_provider"),
  createdAt: createdAt(),
});

// ───────────────────────── AI plumbing ─────────────────────────

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  provider: text("provider").notNull(),
  ok: boolean("ok").notNull(),
  createdAt: createdAt(),
}, (t) => [index("ai_usage_user_idx").on(t.userId, t.createdAt)]);

export const aiCache = pgTable("ai_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: createdAt(),
});

export const ttsCache = pgTable("tts_cache", {
  key: text("key").primaryKey(),
  provider: text("provider").notNull(),
  mime: text("mime").notNull(),
  audio: bytea("audio").notNull(),
  createdAt: createdAt(),
});
