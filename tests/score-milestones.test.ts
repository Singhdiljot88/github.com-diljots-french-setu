import { describe, expect, it } from "vitest";
import { demoEvaluation, estimateNclc, overallFromSubs, parseEvaluation } from "@/lib/score";
import { earnedKeys, newlyEarned } from "@/lib/milestones";

describe("practice score parser", () => {
  it("averages the four criteria and maps them to an estimated NCLC band", () => {
    expect(overallFromSubs({ grammar: 8, vocabulary: 6, fluency: 7, task: 7 })).toBe(7);
    expect(estimateNclc(1)).toBe(3);
    expect(estimateNclc(4)).toBe(5);
    expect(estimateNclc(7)).toBe(7);
    expect(estimateNclc(10)).toBe(10);
    expect(estimateNclc(99)).toBe(10);
  });

  it("drops capital and punctuation nits on spoken input and recomputes the level", () => {
    const ev = parseEvaluation({
      grammar: 4, vocabulary: 6, fluency: 5, task: 5,
      summary: { en: "A short turn.", hi: "एक छोटा उत्तर।" },
      corrections: [
        { original: "hi", corrected: "Hi", why: { en: "Start with a capital letter.", hi: "बड़े अक्षर से शुरू करें।" } },
        { original: "je bien", corrected: "Je vais bien.", why: { en: "The verb aller is missing.", hi: "क्रिया aller नहीं है।" } },
      ],
      nextSteps: [
        { en: "Say je vais bien.", hi: "je vais bien बोलिए।" },
        { en: "Add your name.", hi: "अपना नाम जोड़िए।" },
      ],
      modelAnswer: { fr: "Je vais bien.", en: "I am well.", hi: "मैं ठीक हूँ।" },
      encouragement: { en: "Good try.", hi: "अच्छी कोशिश।" },
    }, { spoken: true });
    expect(ev.corrections.map((c) => c.corrected)).toEqual(["Je vais bien."]);
    expect(ev.overall).toBe(5);
    expect(ev.nclc).toBe(estimateNclc(5));
  });

  it("turns je bien into a real correction without mentioning capitals", () => {
    const ev = demoEvaluation("je bien montague", { spoken: true });
    expect(ev.corrections[0]?.corrected).toBe("Je vais bien.");
    expect(ev.corrections.some((c) => /capital|full stop/i.test(c.why.en))).toBe(false);
    expect(ev.nextSteps.length).toBeGreaterThanOrEqual(2);
    expect(ev.modelAnswer.fr.length).toBeGreaterThan(0);
    expect(ev.nclc).toBe(estimateNclc(ev.overall));
  });
});

describe("milestone logic", () => {
  it("awards the first lesson, streaks, course days, a perfect check, and level steps", () => {
    expect(earnedKeys({ completedDays: [], streak: 0, perfectScores: 0, highestNclc: 0 })).toEqual([]);
    expect(earnedKeys({ completedDays: [1], streak: 3, perfectScores: 0, highestNclc: 3 })).toEqual(["first_lesson", "streak_3"]);
    expect(earnedKeys({ completedDays: [10, 30], streak: 7, perfectScores: 1, highestNclc: 6 })).toEqual([
      "first_lesson", "streak_3", "streak_7", "day_10", "day_30", "first_perfect", "nclc_4", "nclc_5", "nclc_6",
    ]);
  });

  it("returns only milestones that are not already saved", () => {
    const fresh = newlyEarned({ completedDays: [12], streak: 8, perfectScores: 0, highestNclc: 4 }, ["first_lesson", "streak_3"]);
    expect(fresh.map((m) => m.key)).toEqual(["streak_7", "day_10", "nclc_4"]);
  });
});
