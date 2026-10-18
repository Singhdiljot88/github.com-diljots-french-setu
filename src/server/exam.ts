import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mockAttempts, speakingSessions, type MockState, type SectionState } from "@/db/schema";
import { getMock, getMocks } from "./content";
import { HttpError } from "./http";
import { addMistake, recordAttempt } from "./progress";
import { endSession, resolveScenario, startSession, takeTurn, type SpeakingReport } from "./speaking";
import { writingFeedbackFor } from "./writing-feedback";
import { aiProvider } from "./providers/config";
import { GRACE_SECONDS, SECTION_ORDER, TEF_CANADA, sectionSeconds, type SectionKey } from "@/content/tef-config";
import type { Mock } from "@/content/mock-schema";
import type { Mcq } from "@/content/schema";

export type Attempt = typeof mockAttempts.$inferSelect;
type SpeakingTask = "a" | "b";

// ───────────── Question indexing ─────────────

export type FlatQuestion = { id: string; section: string; sectionTitle: string; itemIndex: number; q: Mcq };

/** Reading questions get ids r<section>.<item>.<question>; the order matches the exam booklet. */
export function readingQuestions(m: Mock): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  m.reading.sections.forEach((s, si) => s.items.forEach((it, ii) => it.questions.forEach((q, qi) =>
    out.push({ id: `r${si}.${ii}.${qi}`, section: s.key, sectionTitle: s.title, itemIndex: ii, q }))));
  return out;
}

/** Listening recordings in play order, each with its questions (ids l<recording>.<question>). */
export function listeningItems(m: Mock) {
  return m.listening.sections.flatMap((s) => s.items.map((it) => ({ section: s, item: it }))).map((x, n) => ({
    n, sectionKey: x.section.key, sectionTitle: x.section.title, instruction: x.section.instruction, item: x.item,
    questions: x.item.questions.map((q, qi) => ({ id: `l${n}.${qi}`, q })),
  }));
}
export function listeningQuestions(m: Mock): FlatQuestion[] {
  return listeningItems(m).flatMap((r) => r.questions.map(({ id, q }) => ({ id, section: r.sectionKey, sectionTitle: r.sectionTitle, itemIndex: r.n, q })));
}

const wordCount = (t: string) => (t.trim().match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

// ───────────── Timing ─────────────

export function isOpen(s: SectionState | undefined) { return !!s?.startedAt && !s.submittedAt; }

/** True when a strict-mode deadline has passed (with a short grace period for network delay). */
export function pastDeadline(deadline: string | undefined, now = new Date()) {
  return !!deadline && now.getTime() > new Date(deadline).getTime() + GRACE_SECONDS * 1000;
}

// ───────────── Loading and finalising ─────────────

async function row(userId: string, id: string) {
  const db = await getDb();
  const [r] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.id, id), eq(mockAttempts.userId, userId)));
  if (!r) throw new HttpError(404, "Practice exam not found");
  const m = getMock(r.mockId);
  if (!m) throw new HttpError(404, "This practice exam is no longer available");
  return { r, m };
}

async function save(r: Attempt, state: MockState) {
  const db = await getDb();
  const done = r.sections.every((k) => !!state.sections[k]?.submittedAt);
  const [u] = await db.update(mockAttempts).set({ state, status: done ? "completed" : "in_progress", completedAt: done ? (r.completedAt ?? new Date()) : null })
    .where(eq(mockAttempts.id, r.id)).returning();
  return u;
}

/** Loads an attempt and closes any section whose server-side time has run out. Safe to call on every request. */
export async function loadAttempt(userId: string, id: string, now = new Date()) {
  const { r, m } = await row(userId, id);
  const state = structuredClone(r.state);
  let changed = false;
  for (const k of r.sections as SectionKey[]) {
    const s = state.sections[k];
    if (!isOpen(s)) continue;
    if (k === "speaking") {
      for (const t of Object.values(s.tasks ?? {})) if (!t.endedAt && state.strict && pastDeadline(t.deadline, now)) { t.endedAt = now.toISOString(); changed = true; }
      const ended = (["a", "b"] as const).every((t) => s.tasks?.[t]?.endedAt);
      if (ended) { await finalise(userId, r, m, k, state, true); changed = true; }
    } else if (state.strict && pastDeadline(s.deadline, now)) {
      await finalise(userId, r, m, k, state, true);
      changed = true;
    }
  }
  return { attempt: changed ? await save(r, state) : r, mock: m };
}

async function finalise(userId: string, r: Attempt, m: Mock, k: SectionKey, state: MockState, auto: boolean) {
  const s = state.sections[k];
  s.submittedAt = new Date().toISOString();
  s.autoSubmitted = auto;
  if (k === "reading" || k === "listening") {
    const qs = k === "reading" ? readingQuestions(m) : listeningQuestions(m);
    let correct = 0;
    for (const fq of qs) {
      const choice = typeof s.answers[fq.id] === "number" ? (s.answers[fq.id] as number) : -1;
      const ok = choice === fq.q.answer;
      if (ok) correct++;
      // Unanswered questions are not mistakes to drill; only wrong choices go to the notebook.
      else if (choice >= 0) await addMistake(userId, {
        category: "comprehension", source: `mock_${k}`, sourceRef: `${m.id}:${fq.id}`,
        original: fq.q.options[choice], corrected: fq.q.options[fq.q.answer],
        explanation: { en: `${fq.q.q.en} ${fq.q.explanation.en}`, hi: fq.q.explanation.hi },
      });
    }
    await recordAttempt(userId, { kind: `mock_${k}`, itemRef: m.id, skill: k, correct: null, score: correct / qs.length, response: { attemptId: r.id, correct, total: qs.length, auto } });
  }
  if (k === "writing") {
    const words = { a: wordCount(String(s.answers.a ?? "")), b: wordCount(String(s.answers.b ?? "")) };
    await recordAttempt(userId, { kind: "mock_writing", itemRef: m.id, skill: "writing", response: { attemptId: r.id, words, auto } });
  }
  if (k === "speaking") {
    for (const t of Object.values(s.tasks ?? {})) {
      t.endedAt ??= s.submittedAt;
      try { await endSession(userId, t.sessionId); } catch (e) { if (!(e instanceof HttpError && e.status === 400)) console.warn("[exam] could not end speaking session", e); }
    }
    await recordAttempt(userId, { kind: "mock_speaking", itemRef: m.id, skill: "speaking", response: { attemptId: r.id, tasks: Object.keys(s.tasks ?? {}), auto } });
  }
}

// ───────────── Commands ─────────────

export async function listAttempts(userId: string) {
  const db = await getDb();
  return db.select().from(mockAttempts).where(eq(mockAttempts.userId, userId)).orderBy(desc(mockAttempts.createdAt)).limit(50);
}

export function examCatalog() {
  return getMocks().map((m) => ({ id: m.id, title: m.title, disclaimer: m.disclaimer }));
}

export async function createAttempt(userId: string, mockId: string, sections: SectionKey[], strict: boolean) {
  if (!getMock(mockId)) throw new HttpError(404, "Practice exam not found");
  const keys = SECTION_ORDER.filter((k) => sections.includes(k));
  if (!keys.length) throw new HttpError(400, "Choose at least one section.");
  const db = await getDb();
  const state: MockState = { strict, sections: Object.fromEntries(keys.map((k) => [k, { answers: {} }])) };
  const [a] = await db.insert(mockAttempts).values({ userId, mockId, variant: TEF_CANADA.variant, configVersion: TEF_CANADA.version, sections: keys, state }).returning();
  return a;
}

function requireOpen(state: MockState, k: SectionKey) {
  const s = state.sections[k];
  if (!s) throw new HttpError(400, "This section is not part of this attempt.");
  if (!s.startedAt) throw new HttpError(409, "Start the section first.");
  if (s.submittedAt) throw new HttpError(409, s.autoSubmitted ? "Time is up. This section was submitted automatically." : "This section has been submitted.");
  if (state.strict && k !== "speaking" && pastDeadline(s.deadline)) throw new HttpError(409, "Time is up for this section.");
  return s;
}

export async function startSection(userId: string, id: string, k: SectionKey) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = state.sections[k];
  if (!s) throw new HttpError(400, "This section is not part of this attempt.");
  if (s.submittedAt) throw new HttpError(409, "This section has been submitted.");
  if (s.startedAt) return { attempt: r, mock: m };
  const other = (r.sections as SectionKey[]).find((x) => x !== k && isOpen(state.sections[x]));
  if (other) throw new HttpError(409, `Finish the ${TEF_CANADA.sections[other].en.toLowerCase()} section first.`);
  const now = new Date();
  s.startedAt = now.toISOString();
  if (k !== "speaking") s.deadline = new Date(now.getTime() + sectionSeconds(k) * 1000).toISOString();
  if (k === "listening") { s.position = 0; s.played = []; }
  return { attempt: await save(r, state), mock: m };
}

export async function saveAnswer(userId: string, id: string, k: SectionKey, qid: string, value: number | string) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = requireOpen(state, k);
  if (k === "reading") {
    const q = readingQuestions(m).find((x) => x.id === qid);
    if (!q || typeof value !== "number" || value < -1 || value >= q.q.options.length) throw new HttpError(400, "Unknown question or option.");
  } else if (k === "listening") {
    const q = listeningQuestions(m).find((x) => x.id === qid);
    if (!q || typeof value !== "number" || value < -1 || value >= q.q.options.length) throw new HttpError(400, "Unknown question or option.");
    if (state.strict && q.itemIndex !== s.position) throw new HttpError(409, "You can only answer the questions for the current recording.");
  } else if (k === "writing") {
    if ((qid !== "a" && qid !== "b") || typeof value !== "string") throw new HttpError(400, "Unknown writing task.");
    value = value.slice(0, 8000);
  } else throw new HttpError(400, "Speaking answers are recorded through the conversation.");
  if (value === -1) delete s.answers[qid]; else s.answers[qid] = value;
  await save(r, state);
  return { ok: true, deadline: s.deadline };
}

/** Listening: hands out the recording's script for the device voice. In strict mode only once, and only for the current recording. */
export async function playListening(userId: string, id: string, n: number) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = requireOpen(state, "listening");
  const items = listeningItems(m);
  if (!items[n]) throw new HttpError(404, "No such recording.");
  if (state.strict) {
    if (n !== s.position) throw new HttpError(409, "You can only play the current recording.");
    if (s.played?.includes(n)) throw new HttpError(409, "Under exam rules each recording plays only once.");
  }
  s.played = [...new Set([...(s.played ?? []), n])];
  await save(r, state);
  return { lines: items[n].item.lines.map((l) => ({ voice: l.voice, text: l.fr })) };
}

export async function nextListening(userId: string, id: string) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = requireOpen(state, "listening");
  const total = listeningItems(m).length;
  if (state.strict && !s.played?.includes(s.position ?? 0)) throw new HttpError(409, "Play the recording before moving on.");
  s.position = Math.min(total - 1, (s.position ?? 0) + 1);
  await save(r, state);
  return { position: s.position };
}

export async function submitSection(userId: string, id: string, k: SectionKey) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = state.sections[k];
  if (!s?.startedAt) throw new HttpError(409, "Start the section first.");
  if (s.submittedAt) return { attempt: r, mock: m };
  await finalise(userId, r, m, k, state, false);
  return { attempt: await save(r, state), mock: m };
}

// ───────────── Speaking ─────────────

export async function startSpeakingTask(userId: string, id: string, task: SpeakingTask) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = requireOpen(state, "speaking");
  if (task === "b" && !s.tasks?.a?.endedAt) throw new HttpError(409, "Finish section A first.");
  const existing = s.tasks?.[task];
  if (existing) return { sessionId: existing.sessionId };
  const { session, scenario } = await startSession(userId, task === "a" ? "tef_a" : "tef_b", `mock:${m.id}`, true);
  const now = new Date();
  s.tasks = { ...(s.tasks ?? {}), [task]: { sessionId: session.id, startedAt: now.toISOString(), deadline: new Date(now.getTime() + TEF_CANADA.sections.speaking.tasks[task].minutes * 60_000).toISOString() } };
  await save(r, state);
  return { sessionId: session.id, scenario, isDemo: session.isDemo };
}

export async function speakingTurn(userId: string, id: string, task: SpeakingTask, text: string, via: "typed" | "speech_browser" | "speech_server") {
  const { attempt: r } = await loadAttempt(userId, id);
  const s = requireOpen(r.state, "speaking");
  const t = s.tasks?.[task];
  if (!t) throw new HttpError(409, "Start this task first.");
  if (t.endedAt) throw new HttpError(409, "This task has ended.");
  if (r.state.strict && pastDeadline(t.deadline)) throw new HttpError(409, "Time is up for this task.");
  return takeTurn(userId, t.sessionId, text, via);
}

export async function endSpeakingTask(userId: string, id: string, task: SpeakingTask) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = state.sections.speaking;
  const t = s?.tasks?.[task];
  if (!s || !t) throw new HttpError(409, "Start this task first.");
  t.endedAt ??= new Date().toISOString();
  let report: SpeakingReport | null = null;
  try { report = await endSession(userId, t.sessionId); }
  catch (e) { if (!(e instanceof HttpError && e.status === 400)) throw e; /* nothing was said: the task ends without feedback */ }
  if (!s.submittedAt && (["a", "b"] as const).every((x) => s.tasks?.[x]?.endedAt)) await finalise(userId, r, m, "speaking", state, false);
  await save(r, state);
  return report;
}

// ───────────── Writing feedback (after the section closes) ─────────────

export async function writingFeedback(userId: string, id: string, task: "a" | "b", useAi: boolean) {
  const { attempt: r, mock: m } = await loadAttempt(userId, id);
  const state = structuredClone(r.state);
  const s = state.sections.writing;
  if (!s?.submittedAt) throw new HttpError(409, "Feedback is available after the writing section is submitted.");
  const text = String(s.answers[task] ?? "");
  if (!text.trim()) throw new HttpError(400, "There is no text for this task.");
  const w = m.writing[task];
  const prompt = task === "a" ? `${w.instruction.en}\n\n${m.writing.a.articleStart}` : `${w.instruction.en}\n\n${m.writing.b.statement}`;
  const env = await writingFeedbackFor(userId, { text, prompt, minWords: w.minWords, taskType: task === "a" ? "tef_a" : "tef_b", taskRef: `mock:${m.id}:${r.id}:${task}`, useAi: useAi && aiProvider() !== "demo" });
  s.feedback = { ...(s.feedback ?? {}), [task]: env };
  await save(r, state);
  return env;
}

// ───────────── Client view ─────────────

export type SectionResult = { correct: number; total: number; byKind: Record<string, { correct: number; total: number }>; bySection: { key: string; title: string; correct: number; total: number }[] };

function grade(qs: FlatQuestion[], answers: SectionState["answers"]): SectionResult {
  const byKind: SectionResult["byKind"] = {};
  const bySection = new Map<string, { key: string; title: string; correct: number; total: number }>();
  let correct = 0;
  for (const fq of qs) {
    const ok = answers[fq.id] === fq.q.answer;
    if (ok) correct++;
    const kind = fq.q.kind ?? "other";
    byKind[kind] ??= { correct: 0, total: 0 };
    byKind[kind].total++; if (ok) byKind[kind].correct++;
    const b = bySection.get(fq.section) ?? { key: fq.section, title: fq.sectionTitle, correct: 0, total: 0 };
    b.total++; if (ok) b.correct++;
    bySection.set(fq.section, b);
  }
  return { correct, total: qs.length, byKind, bySection: [...bySection.values()] };
}

const publicQ = (q: Mcq, reveal: boolean) => ({
  q: q.q, options: q.options, kind: q.kind,
  ...(reveal ? { answer: q.answer, explanation: q.explanation, evidence: q.evidence } : {}),
});

/** Everything the exam screen needs, without answers or listening scripts until a section is submitted. */
export function attemptView(r: Attempt, m: Mock, now = new Date()) {
  const st = r.state;
  const sec = (k: SectionKey) => st.sections[k];
  const out: Record<string, unknown> = {};
  for (const k of r.sections as SectionKey[]) {
    const s = sec(k);
    const reveal = !!s.submittedAt;
    const base = { startedAt: s.startedAt ?? null, deadline: s.deadline ?? null, submittedAt: s.submittedAt ?? null, autoSubmitted: !!s.autoSubmitted, answers: s.answers };
    if (k === "reading") {
      out.reading = {
        ...base,
        parts: s.startedAt ? m.reading.sections.map((p, si) => ({
          key: p.key, title: p.title, instruction: p.instruction,
          items: p.items.map((it, ii) => ({ document: it.document, questions: it.questions.map((q, qi) => ({ id: `r${si}.${ii}.${qi}`, ...publicQ(q, reveal) })) })),
        })) : [],
        result: reveal ? grade(readingQuestions(m), s.answers) : null,
      };
    } else if (k === "listening") {
      const items = listeningItems(m);
      out.listening = {
        ...base, position: s.position ?? 0, played: s.played ?? [], count: items.length,
        items: s.startedAt ? items.map((it) => ({
          n: it.n, sectionKey: it.sectionKey, sectionTitle: it.sectionTitle, instruction: it.instruction, context: it.item.context,
          questions: it.questions.map(({ id, q }) => ({ id, ...publicQ(q, reveal) })),
          ...(reveal ? { transcript: it.item.lines.map((l) => ({ speaker: l.speaker, voice: l.voice, fr: l.fr })) } : {}),
        })) : [],
        result: reveal ? grade(listeningQuestions(m), s.answers) : null,
      };
    } else if (k === "writing") {
      out.writing = {
        ...base,
        tasks: {
          a: { ...TEF_CANADA.sections.writing.tasks.a, instruction: m.writing.a.instruction, stimulus: m.writing.a.articleStart },
          b: { ...TEF_CANADA.sections.writing.tasks.b, instruction: m.writing.b.instruction, stimulus: m.writing.b.statement },
        },
        words: { a: wordCount(String(s.answers.a ?? "")), b: wordCount(String(s.answers.b ?? "")) },
        feedback: s.feedback ?? {},
      };
    } else if (k === "speaking") {
      out.speaking = {
        ...base,
        tasks: {
          a: { ...TEF_CANADA.sections.speaking.tasks.a, instruction: m.speaking.a.instruction, document: m.speaking.a.document, state: s.tasks?.a ?? null },
          b: { ...TEF_CANADA.sections.speaking.tasks.b, instruction: m.speaking.b.instruction, document: m.speaking.b.document, state: s.tasks?.b ?? null },
        },
      };
    }
  }
  return {
    id: r.id, mockId: m.id, title: m.title, disclaimer: m.disclaimer, strict: st.strict, status: r.status,
    sectionKeys: r.sections as SectionKey[], configVersion: r.configVersion, createdAt: r.createdAt, completedAt: r.completedAt,
    serverNow: now.toISOString(), sections: out,
  };
}

/** attemptView plus, for speaking, each task's conversation so a reload picks up where it was. */
export async function examView(userId: string, r: Attempt, m: Mock) {
  const v = attemptView(r, m);
  const sp = r.state.sections.speaking;
  if (!sp) return { ...v, speakingSessions: {} };
  const db = await getDb();
  const out: Record<string, { id: string; isDemo: boolean; scenario: Awaited<ReturnType<typeof resolveScenario>>; turns: { role: "learner" | "partner"; text: string; help?: { en?: string; hi?: string } }[]; report: SpeakingReport | null }> = {};
  for (const [task, t] of Object.entries(sp.tasks ?? {})) {
    const [row] = await db.select().from(speakingSessions).where(and(eq(speakingSessions.id, t.sessionId), eq(speakingSessions.userId, userId)));
    if (!row) continue;
    out[task] = {
      id: row.id, isDemo: row.isDemo, scenario: await resolveScenario(row.mode as "tef_a" | "tef_b", row.scenarioRef),
      turns: row.turns.map((x) => ({ role: x.role, text: x.text, help: x.help })), report: (row.feedback as SpeakingReport | null) ?? null,
    };
  }
  return { ...v, speakingSessions: out };
}
export type AttemptView = Awaited<ReturnType<typeof examView>>;

/** Short summary for lists and progress reports: raw counts only, never a TEF/CEFR/NCLC estimate. */
export function attemptSummary(r: Attempt) {
  const m = getMock(r.mockId);
  const scores: Partial<Record<SectionKey, { correct: number; total: number } | { words: { a: number; b: number } } | { done: boolean }>> = {};
  if (m) for (const k of r.sections as SectionKey[]) {
    const s = r.state.sections[k];
    if (!s?.submittedAt) continue;
    if (k === "reading" || k === "listening") { const g = grade(k === "reading" ? readingQuestions(m) : listeningQuestions(m), s.answers); scores[k] = { correct: g.correct, total: g.total }; }
    if (k === "writing") scores[k] = { words: { a: wordCount(String(s.answers.a ?? "")), b: wordCount(String(s.answers.b ?? "")) } };
    if (k === "speaking") scores[k] = { done: true };
  }
  return { id: r.id, mockId: r.mockId, title: m?.title ?? r.mockId, strict: r.state.strict, status: r.status, sections: r.sections as SectionKey[], createdAt: r.createdAt, completedAt: r.completedAt, scores };
}

export type { SpeakingReport };
