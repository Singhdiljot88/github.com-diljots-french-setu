import { describe, expect, it } from "vitest";
import { newCard, schedule, suggestRating, MIN_EASE, previewIntervals, type SrsCard } from "@/lib/srs";
import { addDays, diffDays, isValidDate, isValidTimeZone, localDate } from "@/lib/dates";
import { blockMinutes, blocksForPart, dateForDay, partsPerLesson, recoveryPlan, slotForDate, scaffoldForDay, type ScheduleInput } from "@/lib/schedule";
import { checkAnswer, wordCount, searchKey } from "@/lib/text";
import { conjugate, inflectedForms } from "@/lib/conjugate";
import { buildIndex, search } from "@/lib/dict-search";
import { loadDaysFromDisk, loadDictionaryFromDisk, loadMocksFromDisk, loadPronunciationFromDisk } from "@/content/load";
import { OUTLINE, CHECKPOINT_DAYS } from "@/content/outline";
import { isPublicAddress, safeFetch, FetchBlocked } from "@/server/web/safe-fetch";
import { extractReadable, frenchScore } from "@/server/web/extract";
import { ruleBasedFeedback } from "@/server/writing-check";
import { TEF_CANADA, SECTION_ORDER } from "@/content/tef-config";
import { pastDeadline, readingQuestions, listeningQuestions, listeningItems } from "@/server/exam";
import { recommendations } from "@/server/reports";
import { toClientLesson } from "@/server/lesson-view";
import { Mcq } from "@/content/schema";
import { lintPron } from "@/content/lint";
import { BRIDGE_DAYS, HINDI_BRIDGES } from "@/lib/hindi-bridges";

const T0 = new Date("2026-10-18T12:00:00Z");
const MIN = 60_000, DAY = 86_400_000;

describe("spaced repetition", () => {
  it("moves a new card through the learning steps, then graduates", () => {
    let c = newCard(T0);
    c = schedule(c, "good", T0);
    expect(c.state).toBe("learning");
    expect(c.dueAt.getTime() - T0.getTime()).toBe(10 * MIN);
    c = schedule(c, "good", T0);
    expect(c.state).toBe("review");
    expect(c.intervalDays).toBe(1);
  });
  it("easy on a new card graduates straight to four days", () => {
    const c = schedule(newCard(T0), "easy", T0);
    expect(c).toMatchObject({ state: "review", intervalDays: 4 });
  });
  it("again in review is a lapse: relearning, shorter interval, lower ease", () => {
    const r: SrsCard = { state: "review", ease: 2.5, intervalDays: 20, step: 0, reps: 5, lapses: 0, dueAt: T0 };
    const c = schedule(r, "again", T0);
    expect(c).toMatchObject({ state: "relearning", lapses: 1, intervalDays: 10 });
    expect(c.ease).toBeCloseTo(2.3);
    expect(c.dueAt.getTime() - T0.getTime()).toBe(10 * MIN);
  });
  it("intervals grow with good and never fall below the ease floor", () => {
    let c: SrsCard = { state: "review", ease: 1.35, intervalDays: 3, step: 0, reps: 3, lapses: 2, dueAt: T0 };
    c = schedule(c, "hard", T0);
    expect(c.ease).toBe(MIN_EASE);
    const before = c.intervalDays;
    c = schedule(c, "good", T0);
    expect(c.intervalDays).toBeGreaterThan(before);
    expect(c.dueAt.getTime() - T0.getTime()).toBe(c.intervalDays * DAY);
  });
  it("caps intervals at a year", () => {
    const c = schedule({ state: "review", ease: 3, intervalDays: 300, step: 0, reps: 9, lapses: 0, dueAt: T0 }, "easy", T0);
    expect(c.intervalDays).toBe(365);
  });
  it("suggests ratings from checked answers and previews every button", () => {
    expect(suggestRating("wrong")).toBe("again");
    expect(suggestRating("accent")).toBe("hard");
    expect(suggestRating("correct", 2)).toBe("easy");
    expect(suggestRating("correct", 10)).toBe("good");
    expect(previewIntervals(newCard(T0), T0)).toEqual({ again: "1 min", hard: "6 min", good: "10 min", easy: "4 d" });
  });
});

describe("dates", () => {
  it("uses the learner's own calendar date", () => {
    const late = new Date("2026-10-18T23:30:00Z");
    expect(localDate("UTC", late)).toBe("2026-10-18");
    expect(localDate("Asia/Kolkata", late)).toBe("2026-10-19");
    expect(localDate("America/Toronto", new Date("2026-10-19T02:00:00Z"))).toBe("2026-10-18");
  });
  it("counts days across DST changes and month and year ends", () => {
    expect(diffDays("2026-03-07", "2026-03-09")).toBe(2); // North American DST starts 8 March
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(diffDays("2026-10-18", addDays("2026-10-18", 120))).toBe(120);
  });
  it("validates dates and time zones", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});

describe("schedule", () => {
  const s: ScheduleInput = { startDate: "2026-10-01", dailyMinutes: 150, pace: "complete", scheduleShiftDays: 0, placementDay: 1 };
  it("maps calendar dates to course days", () => {
    expect(slotForDate(s, "2026-09-30").beforeStart).toBe(true);
    expect(slotForDate(s, "2026-10-01").courseDay).toBe(1);
    expect(slotForDate(s, "2026-10-10").courseDay).toBe(10);
    expect(slotForDate(s, "2027-06-01").finished).toBe(true);
    expect(dateForDay(s, 10)).toBe("2026-10-10");
  });
  it("spreads a lesson over several days with less daily time, unless the pace is compact", () => {
    expect(partsPerLesson(90, "complete")).toBe(2);
    expect(partsPerLesson(45, "complete")).toBe(4);
    expect(partsPerLesson(45, "compact")).toBe(1);
    const s45 = { ...s, dailyMinutes: 45 as const };
    expect(slotForDate(s45, "2026-10-05")).toMatchObject({ courseDay: 2, part: 1, parts: 4 });
    expect(blocksForPart(4, 4)).toEqual(["writing", "assessment"]);
  });
  it("uses the 150-minute split and lightens every seventh day", () => {
    expect(blockMinutes(1, 150, "complete")).toEqual({ review: 15, learn: 20, listening: 25, speaking: 25, reading: 20, writing: 25, assessment: 20 });
    const light = blockMinutes(7, 150, "complete");
    expect(light.learn).toBeLessThan(20);
    expect(light.review).toBeGreaterThan(15);
    expect(Object.values(light).reduce((a, b) => a + b)).toBe(150);
  });
  it("offers a recovery plan only when two or more days behind, and warns about the exam date", () => {
    expect(recoveryPlan(s, "2026-10-05", 4)).toBeNull();
    const r = recoveryPlan({ ...s, examDate: "2027-01-28" }, "2026-10-10", 3);
    expect(r?.behindBy).toBe(6);
    expect(r?.options.map((o) => o.key)).toEqual(["catch_up", "shift"]);
    expect(r?.examWarning).toBeDefined();
  });
  it("fades Devanagari scaffolding over the course unless overridden", () => {
    expect(scaffoldForDay(10, "auto")).toBe("visible");
    expect(scaffoldForDay(50, "auto")).toBe("collapsible");
    expect(scaffoldForDay(110, "auto", true)).toBe("off");
    expect(scaffoldForDay(110, "always")).toBe("visible");
  });
});

describe("answer checking", () => {
  it("accepts exact answers, flags accent-only slips, rejects wrong ones", () => {
    expect(checkAnswer("  J’ai  ", "j'ai").result).toBe("correct");
    expect(checkAnswer("ecole", "école").result).toBe("accent");
    expect(checkAnswer("le", "la").result).toBe("wrong");
    expect(checkAnswer("bonsoir", "bonjour", ["bonsoir"]).result).toBe("correct");
  });
  it("counts French words with elisions as one", () => {
    expect(wordCount("J'ai vingt-cinq ans , et toi ?")).toBe(5);
    expect(searchKey("Œuf  É")).toBe("oeuf e");
  });
});

describe("conjugation", () => {
  const dict = loadDictionaryFromDisk().entries;
  const verb = (lemma: string) => dict.find((e) => e.entry.lemma === lemma && e.entry.verb)!.entry;
  it("conjugates aller with être in the passé composé", () => {
    const v = verb("aller");
    const t = conjugate(v.lemma, v.verb!)!;
    expect(t.present.map((x) => x.form)).toContain("je vais");
    expect(t.passe_compose[0].form).toMatch(/^je suis allé/);
  });
  it("conjugates a regular -er verb and lists its forms for search", () => {
    const v = verb("parler");
    const t = conjugate(v.lemma, v.verb!)!;
    expect(t.present.map((x) => x.form)).toEqual(["je parle", "tu parles", "il parle", "nous parlons", "vous parlez", "ils parlent"]);
    expect(t.futur.map((x) => x.form)).toContain("je parlerai");
    expect(inflectedForms(v.lemma, v.verb!)).toEqual(expect.arrayContaining(["parlé", "parlais"]));
  });
});

describe("dictionary search", () => {
  const index = buildIndex(loadDictionaryFromDisk().entries.map((e) => ({ ...e, source: "seed" })));
  const top = (q: string) => search(index, q, 5)[0];
  it("has over 1,000 entries", () => expect(index.entries.length).toBeGreaterThan(1000));
  it("finds words without accents and with misspellings", () => {
    expect(top("ecole")?.entry.lemma).toBe("école");
    expect(top("ECOLE")?.entry.lemma).toBe("école");
  });
  it("finds the infinitive from a conjugated form", () => {
    const h = top("allé");
    expect(h?.entry.lemma).toBe("aller");
    expect(h?.match).toBe("form");
  });
  it("searches by English and by Hindi", () => {
    expect(search(index, "house", 10).some((h) => h.entry.lemma === "maison")).toBe(true);
    expect(search(index, "घर", 10).some((h) => h.entry.lemma === "maison")).toBe(true);
  });
});

describe("course content", () => {
  const days = loadDaysFromDisk();
  it("has a valid lesson for every one of the 120 days", () => {
    expect(days.map((d) => d.day.day)).toEqual(Array.from({ length: 120 }, (_, i) => i + 1));
    expect(OUTLINE.length).toBe(120);
  });
  it("gives every day distinct content", () => {
    expect(new Set(days.map((d) => d.day.title.fr)).size).toBe(120);
    expect(new Set(days.map((d) => d.day.reading.text)).size).toBe(120);
    expect(new Set(days.map((d) => d.day.listening.lines.map((l) => l.fr).join(" "))).size).toBe(120);
  });
  it("marks checkpoints and light days", () => {
    for (const d of CHECKPOINT_DAYS) expect(days[d - 1].day.checkpoint).toBe(true);
  });
  it("has 3 mocks with 40 reading and 40 listening questions each", () => {
    const mocks = loadMocksFromDisk();
    expect(mocks.length).toBe(3);
    for (const m of mocks) {
      expect(readingQuestions(m).length).toBe(TEF_CANADA.sections.reading.questions);
      expect(listeningQuestions(m).length).toBe(TEF_CANADA.sections.listening.questions);
      expect(new Set(readingQuestions(m).map((q) => q.id)).size).toBe(40);
      expect(listeningItems(m).every((it, n) => it.n === n)).toBe(true);
    }
  });
  it("loads the pronunciation lab", () => {
    const p = loadPronunciationFromDisk();
    expect(p.sounds.length).toBeGreaterThanOrEqual(16);
  });
  it("gives every lesson question Hindi text", () => {
    for (const { day: d } of days) for (const q of [...d.listening.questions, ...d.reading.questions]) expect(q.q.hi, `day ${d.day}: ${q.q.en}`).toBeTruthy();
  });
  it("sends questions with Hindi to the browser but never the answer", () => {
    const c = toClientLesson(days[0].day);
    const q = c.listening.questions[0] as Record<string, unknown>;
    expect((q.q as { hi?: string }).hi).toBeTruthy();
    expect(q).not.toHaveProperty("answer");
    expect(q).not.toHaveProperty("explanation");
  });
  it("rejects Hindi options that do not match the English options", () => {
    const base = { q: { en: "Where?" }, options: ["here", "there", "nowhere"], answer: 0, explanation: { en: "x", hi: "क" } };
    expect(Mcq.safeParse({ ...base, optionsHi: ["यहाँ", "वहाँ", "कहीं नहीं"] }).success).toBe(true);
    expect(Mcq.safeParse({ ...base, optionsHi: ["यहाँ", "वहाँ"] }).success).toBe(false);
  });
  it("uses the owner's pronunciation spellings", () => {
    const vocab = new Map(days.flatMap(({ day: d }) => [...d.vocabulary, ...d.phrases]).map((v) => [v.fr.toLowerCase(), v.pron]));
    expect(vocab.get("bonjour")).toBe("बों-जूर");
    expect(vocab.get("salut")).toBe("सा-ल्यू");
    expect(vocab.get("merci")).toBe("मेर-सी");
    const out: string[] = [];
    lintPron("test", "सा-लü", out);
    lintPron("test", "बोँ-झ़ूग़", out);
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
  it("puts Hindi bridge boxes on real lessons with both languages", () => {
    for (const [day, key] of Object.entries(BRIDGE_DAYS)) {
      expect(days[Number(day) - 1]).toBeTruthy();
      expect(HINDI_BRIDGES[key].text.hi).toMatch(/[\u0900-\u097F]/);
      expect(HINDI_BRIDGES[key].text.en).toBeTruthy();
    }
  });
});

describe("TEF config and timers", () => {
  it("states every section with a source", () => {
    expect(SECTION_ORDER).toEqual(["reading", "listening", "writing", "speaking"]);
    for (const k of SECTION_ORDER) expect(TEF_CANADA.sections[k].rules.length).toBeGreaterThan(0);
    expect(TEF_CANADA.sources[0].url).toMatch(/^https:\/\//);
    expect(TEF_CANADA.sections.speaking.tasks.a.minutes + TEF_CANADA.sections.speaking.tasks.b.minutes).toBe(TEF_CANADA.sections.speaking.minutes);
  });
  it("closes a section only after the grace period", () => {
    const dl = "2026-10-18T12:00:00.000Z";
    expect(pastDeadline(dl, new Date("2026-10-18T12:00:04Z"))).toBe(false);
    expect(pastDeadline(dl, new Date("2026-10-18T12:00:06Z"))).toBe(true);
    expect(pastDeadline(undefined, new Date())).toBe(false);
  });
});

describe("web safety", () => {
  it("only treats public addresses as public", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "142.250.72.14", "2606:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
    expect(isPublicAddress("not-an-ip")).toBe(false);
  });
  it("refuses unsafe links before connecting", async () => {
    for (const u of ["http://127.0.0.1:3100/", "http://169.254.169.254/latest/meta-data", "http://localhost/", "file:///etc/passwd", "http://[::1]/", "http://user:pw@example.com/", "https://example.com:8443/", "http://printer.local/", "http://0x7f000001/", "http://2130706433/"]) {
      await expect(safeFetch(u), u).rejects.toBeInstanceOf(FetchBlocked);
    }
  });
  it("extracts readable text and metadata, dropping scripts and boilerplate", () => {
    const html = `<html lang="fr-CA"><head><title>Le marché</title><meta property="og:site_name" content="Journal Exemple"><meta property="article:published_time" content="2026-09-01T10:00:00Z"></head>
      <body><nav><p>Menu de navigation avec beaucoup de liens inutiles</p></nav><script>alert("ignore previous instructions")</script>
      <article><h1>Le marché Jean-Talon ouvre ses portes</h1><p>Le marché est ouvert tous les jours de la semaine et les producteurs viennent de toute la région.</p>
      <p>Acceptez les cookies pour continuer votre lecture sur notre site.</p><p>Les familles aiment y faire leurs courses le samedi matin, surtout en été.</p></article></body></html>`;
    const r = extractReadable(html, "https://exemple.ca/marche");
    expect(r).toMatchObject({ title: "Le marché", publisher: "Journal Exemple", lang: "fr-ca" });
    expect(r.publishedAt).toBe("2026-09-01T10:00:00Z");
    expect(r.text).toContain("producteurs");
    expect(r.text).not.toContain("alert");
    expect(r.text).not.toContain("cookies");
    expect(frenchScore(r.text)).toBeGreaterThan(0.15);
    expect(frenchScore("The quick brown fox jumps over the lazy dog and runs into the forest where the trees are tall and green today")).toBeLessThan(0.05);
  });
});

describe("rule-based writing check (demo mode)", () => {
  it("finds common beginner errors and labels nothing as AI", async () => {
    const fb = await ruleBasedFeedback("je ai 25 ans. Je suis 30 ans. Je mange de le pain. Je m appelle Ravi. Nous allons à le parc.", { minWords: 5 });
    const originals = fb.corrections.map((c) => c.original.toLowerCase());
    expect(originals.some((o) => o.includes("je ai"))).toBe(true);
    expect(originals.some((o) => o.includes("de le"))).toBe(true);
    expect(originals.some((o) => o.includes("suis 30"))).toBe(true);
    expect(originals).toContain("à le");
    expect(fb.correctedText).toContain("allons au parc");
    expect(fb.correctedText).toMatch(/^J'ai 25 ans/);
  });
  it("does not flag correct text", async () => {
    const fb = await ruleBasedFeedback("J'habite à Montréal avec ma famille. Nous aimons le marché.", { minWords: 5 });
    expect(fb.corrections.filter((c) => c.isError)).toEqual([]);
  });
});

describe("checkpoint recommendations", () => {
  it("points at the weakest skills and catch-up days, never at a score", () => {
    const recs = recommendations([{ skill: "listening", attempts: 20, accuracy: 0.4 }, { skill: "reading", attempts: 20, accuracy: 0.9 }], [12, 13], [{ category: "gender", open: 5 }]);
    const text = recs.map((r) => r.text).join(" ");
    expect(recs[0].href).toBe("/lesson/12");
    expect(recs.some((r) => r.href === "/listening")).toBe(true);
    expect(recs.some((r) => r.href === "/reading")).toBe(false);
    expect(text).not.toMatch(/\b(CLB|NCLC|CEFR|score of|ready)\b/i);
  });
});

describe("Say it word matching", () => {
  it("counts words the recognizer wrote, in order, ignoring case, accents and punctuation", async () => {
    const { matchPhrase, statusFor } = await import("@/lib/speech-match");
    expect(matchPhrase("Je m'appelle Diljot.", "je m'appelle diljot")).toMatchObject({ heard: 4, total: 4, exact: true });
    expect(matchPhrase("Comment vous appelez-vous ?", "comment vous appelez vous")).toMatchObject({ heard: 4, total: 4 });
    expect(matchPhrase("Ça va bien, merci.", "sa va bien mercy").heard).toBe(2);
    expect(matchPhrase("Et vous ?", "vous et").heard).toBe(1);
    expect(matchPhrase("Je viens d'Inde.", "So when then").heard).toBe(0);
    expect(matchPhrase("Très bien", "tres bien").heard).toBe(2);
    expect(matchPhrase("Comment vous appelez-vous ?", "").words.map((w) => w.word)).toEqual(["Comment", "vous", "appelez", "vous"]);
    expect([statusFor(4, 4), statusFor(3, 4), statusFor(1, 4), statusFor(0, 4)]).toEqual(["all", "most", "some", "none"]);
  });
});

describe("database setup errors", async () => {
  const { asDbSetupError, DbSetupError } = await import("@/db/errors");
  it("explains common Supabase connection mistakes in plain words", () => {
    expect(asDbSetupError({ code: "28P01", message: "password authentication failed for user" })?.message).toMatch(/password/);
    expect(asDbSetupError({ code: "XX000", message: "Tenant or user not found" })?.message).toMatch(/Transaction pooler/);
    expect(asDbSetupError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND db.example" })?.message).toMatch(/could not connect/);
    expect(asDbSetupError(new DbSetupError("x"))).toBeInstanceOf(DbSetupError);
    expect(asDbSetupError(new Error("syntax error at or near"))).toBeNull();
  });
});
