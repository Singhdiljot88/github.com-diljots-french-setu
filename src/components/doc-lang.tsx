"use client";
import { useEffect } from "react";
import { usePrefs } from "./prefs";

/** Screen readers should use Hindi when the learner asked for a Hindi-only interface. */
export function DocLang() {
  const { explanationLang } = usePrefs();
  useEffect(() => {
    const lang = explanationLang === "hi" ? "hi" : "en";
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = "en"; };
  }, [explanationLang]);
  return null;
}
