import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkNumber, frenchNumber, makeChallenge, numberPron } from "@/lib/nombres";
import { summarise } from "@/server/activity";
import { coerceToSchema } from "@/server/ai";
import { TutorAnswer } from "@/server/lesson-tutor";
import { CONFUSABLES } from "@/lib/confusables";

describe("French numbers", () => {
  it("spells the tricky ones the France way", () => {
    expect(frenchNumber(71)).toBe("soixante et onze");
    expect(frenchNumber(80)).toBe("quatre-vingts");
    expect(frenchNumber(81)).toBe("quatre-vingt-un");
    expect(frenchNumber(92)).toBe("quatre-vingt-douze");
    expect(frenchNumber(200)).toBe("deux cents");
    expect(frenchNumber(280)).toBe("deux cent quatre-vingts");
    expect(frenchNumber(1998)).toBe("mille neuf cent quatre-vingt-dix-huit");
    expect(frenchNumber(80000)).toBe("quatre-vingt mille");
  });
  it("gives Devanagari guides with liaison", () => {
    expect(numberPron("deux euros cinquante")).toBe("द ज़-रो सैं-काँत");
    expect(numberPron("une heure")).toBe("यून अर");
    expect(numberPron("neuf heures")).toBe("न वर");
    expect(numberPron("dix-neuf")).toBe("दीज़-नफ़");
    expect(numberPron("dix-huit")).toBe("दी-ज़ूइत");
  });
  it("accepts reasonable ways of typing an answer", () => {
    for (const kind of ["small", "seventies", "big", "price", "time", "phone", "year"] as const) {
      for (let i = 0; i < 25; i++) {
        const c = makeChallenge(kind);
        expect(checkNumber(c, c.answer)).toBe(true);
        expect(checkNumber(c, c.display)).toBe(true);
        expect(c.pron.length).toBeGreaterThan(0);
      }
    }
    const t = { kind: "time" as const, spoken: "", display: "14 h 30", answer: "14:30", accept: ["14h30"], pron: "" };
    expect(checkNumber(t, "14h30")).toBe(true);
    expect(checkNumber(t, "14:31")).toBe(false);
    expect(checkNumber(t, "")).toBe(false);
  });
});

describe("study streak", () => {
  const m = (entries: [string, number][]) => new Map(entries.map(([d, min]) => [d, { minutes: min, answers: 0 }]));
  it("counts consecutive days ending today", () => {
    const s = summarise("2026-11-15", m([["2026-11-13", 10], ["2026-11-14", 5], ["2026-11-15", 20]]));
    expect(s.streak).toBe(3);
    expect(s.studiedToday).toBe(true);
    expect(s.days).toHaveLength(84);
  });
  it("keeps yesterday's streak alive until today ends", () => {
    const s = summarise("2026-11-15", m([["2026-11-13", 10], ["2026-11-14", 5]]));
    expect(s.streak).toBe(2);
    expect(s.studiedToday).toBe(false);
  });
  it("breaks on a missed day and remembers the best run", () => {
    const s = summarise("2026-11-15", m([["2026-11-01", 5], ["2026-11-02", 5], ["2026-11-03", 5], ["2026-11-04", 5], ["2026-11-15", 5]]));
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(4);
  });
});

describe("AI answer coercion", () => {
  const good = { answer: { en: "Because of elision.", hi: "elision की वजह से।" }, examples: [{ fr: "je m'appelle", pron: "ज मा-पेल", hi: "मेरा नाम है" }], outOfScope: false };
  it("accepts a valid answer", () => expect(coerceToSchema(TutorAnswer, good).success).toBe(true));
  it("parses a JSON string and double-encoded fields", () => {
    expect(coerceToSchema(TutorAnswer, JSON.stringify(good)).success).toBe(true);
    expect(coerceToSchema(TutorAnswer, { ...good, answer: JSON.stringify(good.answer) }).success).toBe(true);
  });
  it("unwraps one extra key and drops nulls", () => {
    expect(coerceToSchema(TutorAnswer, { result: { ...good, followUps: null } }).success).toBe(true);
  });
  it("trims texts and lists that are slightly too long", () => {
    const r = coerceToSchema(TutorAnswer, { ...good, answer: { en: "x".repeat(3000), hi: "क".repeat(3000) }, examples: Array(7).fill(good.examples[0]) });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.answer.en.length).toBe(1400); expect(r.data.examples).toHaveLength(4); }
  });
  it("still rejects missing or wrong fields", () => {
    expect(coerceToSchema(TutorAnswer, { answer: { en: "hi" } }).success).toBe(false);
    expect(coerceToSchema(z.object({ n: z.number() }), { n: "five" }).success).toBe(false);
    expect(coerceToSchema(TutorAnswer, "{not json").success).toBe(false);
  });
});

describe("false friends data", () => {
  it("has no duplicates and every entry is complete", () => {
    expect(new Set(CONFUSABLES.map((c) => c.fr)).size).toBe(CONFUSABLES.length);
    for (const c of CONFUSABLES) { expect(c.means.en && c.means.hi && c.example.fr && c.example.en).toBeTruthy(); }
    expect(CONFUSABLES.filter((c) => c.kind === "false_friend").length).toBeGreaterThanOrEqual(10);
  });
});

import { definite, elides } from "@/lib/elision";
import { blockMinutes } from "@/lib/schedule";

describe("elision and h aspiré", () => {
  it("elides before vowels and h muet only", () => {
    expect(definite("hockey", "m")).toBe("le hockey");
    expect(definite("hausse", "f")).toBe("la hausse");
    expect(definite("hindi", "m")).toBe("le hindi");
    expect(definite("homme", "m")).toBe("l'homme");
    expect(definite("hôtel", "m")).toBe("l'hôtel");
    expect(definite("eau", "f")).toBe("l'eau");
    expect(definite("maison", "f")).toBe("la maison");
    expect(elides("huit")).toBe(false);
    expect(elides("heure")).toBe(true);
  });
});

describe("45-minute plan", () => {
  it("has writing at 0 minutes, so it is optional for completion", () => {
    expect(blockMinutes(2, 45, "compact").writing).toBe(0);
    expect(blockMinutes(2, 150, "complete").writing).toBeGreaterThan(0);
  });
});
