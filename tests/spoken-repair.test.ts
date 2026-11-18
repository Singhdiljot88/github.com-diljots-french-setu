import { describe, expect, it } from "vitest";
import { spokenFixes, spokenReaction, spokenRecast } from "@/lib/spoken-repair";
import { ruleBasedFeedback } from "@/server/writing-check";

describe("spoken repairs", () => {
  it("turns 'je bien montague' into a real sentence, not a capital or a full stop", () => {
    const fixes = spokenFixes("je bien montague");
    expect(fixes.map((f) => f.corrected)).toContain("Je vais bien.");
    expect(fixes.map((f) => f.corrected)).toContain("la montagne");
    expect(fixes.some((f) => /capital|full stop|period/i.test(f.en))).toBe(false);
    expect(spokenRecast("je bien montague")).toBe("Je vais bien.");
    expect(spokenReaction("je bien montague")).toMatch(/tu vas bien/i);
    expect(spokenReaction("je bien montague")).toMatch(/montagne/i);
    const name = fixes.find((f) => f.corrected === "Je vais bien.");
    expect(name?.en).toMatch(/Je m'appelle/);
    expect(name?.hi).toMatch(/Je m'appelle/);
  });

  it("does not nitpick capitals or punctuation on a short spoken turn", async () => {
    const spoken = await ruleBasedFeedback("hi", { spoken: true });
    expect(spoken.corrections.some((c) => /capital|full stop/i.test(c.explanation.en))).toBe(false);
    const written = await ruleBasedFeedback("hi");
    expect(written.corrections.some((c) => /capital/i.test(c.explanation.en))).toBe(true);
  });
});
