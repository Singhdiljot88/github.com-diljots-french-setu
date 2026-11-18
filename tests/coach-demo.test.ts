import { describe, expect, it } from "vitest";
import { demoDrills, demoExplain, demoScene } from "@/lib/coach-demo";

describe("labelled non-AI coach", () => {
  it("explains a line from the glosses it was given", () => {
    const r = demoExplain({ fr: "Je m'appelle Asha.", en: "My name is Asha.", hi: "मेरा नाम आशा है।" });
    expect(r.en).toContain("My name is Asha");
    expect(r.hi).toContain("मेरा नाम आशा है");
    expect(r.focus).toContain("Je m'appelle");
  });
  it("turns saved mistakes into drills without inventing a score", () => {
    const items = demoDrills([{
      original: "je suis 30 ans",
      corrected: "j'ai 30 ans",
      explanation: { en: "Age uses avoir.", hi: "उम्र के लिए avoir।" },
      drill: { prompt: "Say you are 30", answer: "j'ai 30 ans" },
    }]);
    expect(items).toHaveLength(1);
    expect(items[0].answer).toBe("j'ai 30 ans");
    expect(items[0].whyHi).toContain("avoir");
  });
  it("builds a role-play from lesson phrases", () => {
    const scene = demoScene({
      title: { en: "Café", hi: "कैफ़े" },
      blurb: { en: "Order a coffee.", hi: "कॉफ़ी मँगवाएँ।" },
      lines: [
        { fr: "Je voudrais un café.", en: "I would like a coffee.", hi: "मुझे एक कॉफ़ी चाहिए।" },
        { fr: "L'addition, s'il vous plaît.", en: "The bill, please.", hi: "बिल लाइए।" },
      ],
    });
    expect(scene.openingFr).toBe("Je voudrais un café.");
    expect(scene.prompts).toHaveLength(2);
    expect(scene.goalHi).toContain("कॉफ़ी");
  });
});
