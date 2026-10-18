"use client";
import { usePrefs } from "./prefs";

type BiText = { en: string; hi?: string };

/** Shows an explanation in the learner's chosen language(s): English, Hindi or both. */
export function Bi({ t, className = "", as: As = "p" }: { t: BiText; className?: string; as?: "p" | "span" | "div" | "h2" | "h3" | "li" }) {
  const { explanationLang } = usePrefs();
  const showEn = explanationLang !== "hi" || !t.hi;
  const showHi = explanationLang !== "en" && !!t.hi;
  if (As === "span") {
    return (
      <span className={className}>
        {showEn && <span lang="en">{t.en}</span>}
        {showEn && showHi && <span aria-hidden> · </span>}
        {showHi && <span lang="hi" className="deva">{t.hi}</span>}
      </span>
    );
  }
  return (
    <As className={className}>
      {showEn && <span lang="en" className="block">{t.en}</span>}
      {showHi && <span lang="hi" className={`deva block ${showEn ? "text-muted mt-0.5" : ""}`}>{t.hi}</span>}
    </As>
  );
}

/** Pick a single string for short UI labels. */
export function useBiLabel() {
  const { explanationLang } = usePrefs();
  return (t: BiText) => (explanationLang === "hi" && t.hi ? t.hi : explanationLang === "both" && t.hi ? `${t.en} · ${t.hi}` : t.en);
}
