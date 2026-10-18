import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Each run gets a fresh in-memory database and no AI keys, so these tests exercise demo mode.
vi.hoisted(() => {
  process.env.PGLITE_DIR = "memory://";
  delete process.env.DATABASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k: string, v: string) => jar.set(k, v), delete: (k: string) => jar.delete(k) }),
}));

import { and, eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import * as t from "@/db/schema";
import { hashPassword } from "@/server/auth";
import { HttpError } from "@/server/http";
import { getOrCreateDraft, loadDraft, saveDraft } from "@/server/writing";
import { addMistake } from "@/server/progress";
import { answerDrill, listMistakes, setResolved } from "@/server/mistakes";
import { createAttempt, loadAttempt, nextListening, playListening, saveAnswer, startSection, submitSection, readingQuestions } from "@/server/exam";
import { getMock } from "@/server/content";
import { generateJson, AiUnavailable } from "@/server/ai";
import { writingFeedbackFor } from "@/server/writing-feedback";
import { deleteAccount, exportUserData } from "@/server/account";
import { saveWord, rateCard } from "@/server/words";
import { z } from "zod";

let A = "", B = "";
const httpStatus = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { if (e instanceof HttpError) return e.status; throw e; } };

async function makeUser(email: string) {
  const db = await getDb();
  const [u] = await db.insert(t.users).values({ email, passwordHash: await hashPassword("password123") }).returning();
  await db.insert(t.profiles).values({ userId: u.id, startDate: "2026-10-01", timezone: "UTC" });
  return u.id;
}

beforeAll(async () => {
  A = await makeUser("a@test.local");
  B = await makeUser("b@test.local");
});
afterAll(async () => { await closeDb(); });

describe("data isolation between learners", () => {
  it("one learner cannot read or change another learner's records", async () => {
    const d = await getOrCreateDraft(A, { taskType: "free", taskRef: "studio:test", mode: "practice" });
    expect(await httpStatus(loadDraft(B, d.id))).toBe(404);
    expect(await httpStatus(saveDraft(B, d.id, "hacked", "manual"))).toBe(404);

    const mid = await addMistake(A, { category: "gender", source: "writing", original: "la fromage", corrected: "le fromage", explanation: { en: "fromage is masculine" }, drill: { prompt: "___ fromage", answer: "le" } });
    expect(await httpStatus(setResolved(B, mid, true))).toBe(404);
    expect(await httpStatus(answerDrill(B, mid, "le"))).toBe(404);
    expect(await listMistakes(B)).toEqual([]);

    const att = await createAttempt(A, "mock-1", ["reading"], true);
    expect(await httpStatus(loadAttempt(B, att.id))).toBe(404);
    expect(await httpStatus(startSection(B, att.id, "reading"))).toBe(404);
  });
});

describe("spaced review persistence", () => {
  it("rating a saved word's card moves its due date and logs the review", async () => {
    const { id } = await saveWord(A, { fr: "la maison", en: "house", gender: "f", source: "dictionary" });
    const db = await getDb();
    const cards = await db.select().from(t.reviewCards).where(eq(t.reviewCards.savedWordId, id));
    expect(cards.length).toBeGreaterThan(0);
    const now = new Date("2026-10-18T12:00:00Z");
    await rateCard(A, cards[0].id, "easy", "house", now);
    const [after] = await db.select().from(t.reviewCards).where(eq(t.reviewCards.id, cards[0].id));
    expect(after).toMatchObject({ state: "review", intervalDays: 4 });
    expect(after.dueAt.toISOString()).toBe("2026-10-22T12:00:00.000Z");
    expect(await httpStatus(rateCard(B, cards[0].id, "good", undefined))).toBe(404);
    const logs = await db.select().from(t.reviewLogs).where(eq(t.reviewLogs.cardId, cards[0].id));
    expect(logs).toHaveLength(1);
  });
});

describe("writing autosave and timed submission", () => {
  it("saves text and word count, then submits automatically when time runs out", async () => {
    const d = await getOrCreateDraft(A, { taskType: "tef_a", taskRef: "studio:timed", mode: "exam", timeLimitSec: 60 });
    const saved = await saveDraft(A, d.id, "Je suis arrivé hier soir.", "autosave");
    expect(saved).toMatchObject({ text: "Je suis arrivé hier soir.", wordCount: 5, status: "draft" });
    const db = await getDb();
    await db.update(t.writingDrafts).set({ timerStartedAt: new Date(Date.now() - 120_000) }).where(eq(t.writingDrafts.id, d.id));
    const after = await loadDraft(A, d.id);
    expect(after.status).toBe("submitted");
    expect(after.text).toBe("Je suis arrivé hier soir.");
    expect(await httpStatus(saveDraft(A, d.id, "too late", "autosave"))).toBe(409);
  });
});

describe("mistake drills", () => {
  it("a correct drill answer resolves the mistake; repeating the error reopens it", async () => {
    const id = await addMistake(A, { category: "agreement", source: "writing", original: "elle est allé", corrected: "elle est allée", explanation: { en: "agreement with être" }, drill: { prompt: "Elle est (aller) ___", answer: "allée" } });
    expect((await answerDrill(A, id, "alle")).resolved).toBe(false);
    expect((await answerDrill(A, id, "allée")).resolved).toBe(true);
    await addMistake(A, { category: "agreement", source: "writing", original: "elle est allé", corrected: "elle est allée", explanation: { en: "again" } });
    const m = (await listMistakes(A)).find((x) => x.id === id)!;
    expect(m).toMatchObject({ resolved: false, occurrences: 2 });
  });
});

describe("practice exam under exam rules", () => {
  it("auto-submits a section on the server when its time runs out, keeping saved answers", async () => {
    const a = await createAttempt(A, "mock-1", ["reading", "listening"], true);
    await startSection(A, a.id, "reading");
    expect(await httpStatus(startSection(A, a.id, "listening"))).toBe(409); // one section at a time
    const q = readingQuestions(getMock("mock-1")!)[0];
    await saveAnswer(A, a.id, "reading", q.id, q.q.answer);
    const still = await loadAttempt(A, a.id, new Date(Date.now() + 59 * 60_000));
    expect(still.attempt.state.sections.reading.submittedAt).toBeUndefined();
    const later = await loadAttempt(A, a.id, new Date(Date.now() + 61 * 60_000));
    expect(later.attempt.state.sections.reading).toMatchObject({ autoSubmitted: true });
    expect(later.attempt.state.sections.reading.answers[q.id]).toBe(q.q.answer);
    expect(await httpStatus(saveAnswer(A, a.id, "reading", q.id, 0))).toBe(409);
    const db = await getDb();
    const rows = await db.select().from(t.attempts).where(and(eq(t.attempts.userId, A), eq(t.attempts.kind, "mock_reading")));
    expect(rows[0].score).toBeCloseTo(1 / 40);
  });

  it("plays each listening recording once, in order, with no going back", async () => {
    const a = await createAttempt(A, "mock-2", ["listening"], true);
    await startSection(A, a.id, "listening");
    expect(await httpStatus(playListening(A, a.id, 1))).toBe(409);
    expect(await httpStatus(nextListening(A, a.id))).toBe(409);
    expect((await playListening(A, a.id, 0)).lines.length).toBeGreaterThan(0);
    expect(await httpStatus(playListening(A, a.id, 0))).toBe(409);
    await nextListening(A, a.id);
    expect(await httpStatus(saveAnswer(A, a.id, "listening", "l0.0", 0))).toBe(409);
    expect(await httpStatus(saveAnswer(A, a.id, "listening", "l1.0", 0))).toBe(200);
    const done = await submitSection(A, a.id, "listening");
    expect(done.attempt.status).toBe("completed");
  });

  it("relaxed mode shows the clock but never auto-submits or locks replays", async () => {
    const a = await createAttempt(A, "mock-3", ["listening"], false);
    await startSection(A, a.id, "listening");
    await playListening(A, a.id, 3);
    await playListening(A, a.id, 3);
    const later = await loadAttempt(A, a.id, new Date(Date.now() + 5 * 3600_000));
    expect(later.attempt.state.sections.listening.submittedAt).toBeUndefined();
  });
});

describe("demo mode never fakes AI", () => {
  it("refuses AI calls without a key and falls back to the labelled rule checker", async () => {
    await expect(generateJson("writing_feedback", A, { system: "x", prompt: "y", schema: z.object({ a: z.string() }) })).rejects.toBeInstanceOf(AiUnavailable);
    const env = await writingFeedbackFor(A, { text: "Je ai un chien.", prompt: "Décrivez votre animal.", taskType: "free", taskRef: "studio:x", useAi: true });
    expect(env.isDemo).toBe(true);
    expect(env.label).toMatch(/not AI/);
    expect(JSON.stringify(env)).not.toMatch(/\b(CLB|NCLC)\s*\d/);
  });
});

describe("data export and account deletion", () => {
  it("exports the learner's data without the password hash", async () => {
    const data = await exportUserData(A);
    expect(data.account?.email).toBe("a@test.local");
    expect(((data as Record<string, unknown>).mistakes as unknown[]).length).toBeGreaterThan(0);
    expect(((data as Record<string, unknown>).mockAttempts as unknown[]).length).toBeGreaterThan(0);
    expect(JSON.stringify(data)).not.toContain("scrypt");
    expect(JSON.stringify(data)).not.toContain("passwordHash");
  });

  it("deletes everything for that learner only, after the right confirmation", async () => {
    expect(await httpStatus(deleteAccount(A, { confirm: "nope", password: "password123" }))).toBe(400);
    expect(await httpStatus(deleteAccount(A, { confirm: "DELETE", password: "wrong" }))).toBe(403);
    await addMistake(B, { category: "spelling", source: "writing", original: "ecole", corrected: "école", explanation: { en: "accent" } });
    await deleteAccount(A, { confirm: "DELETE", password: "password123" });
    const db = await getDb();
    const tables = [t.profiles, t.mistakes, t.mockAttempts, t.writingDrafts, t.writingRevisions, t.attempts, t.sessions];
    for (const table of tables) {
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.userId, A));
      expect(Number(r.n)).toBe(0);
    }
    expect((await listMistakes(B)).length).toBe(1);
  });
});
