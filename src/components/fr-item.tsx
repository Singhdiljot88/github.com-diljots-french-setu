"use client";
import { useState } from "react";
import { Speak } from "./audio";
import { Bi } from "./bi";
import { usePrefs, useScaffold } from "./prefs";
import { SaveWordButton } from "./save-word";

export type FrItemData = { fr: string; en: string; hi: string; pron?: string; ipa?: string; note?: { en: string; hi: string }; gender?: string; pos?: string; lemma?: string };

/** Approximate Devanagari pronunciation, kept visually separate from the Hindi meaning. */
export function Pron({ pron, day, examPractice }: { pron?: string; day?: number; examPractice?: boolean }) {
  const scaffold = useScaffold(day, examPractice);
  const [open, setOpen] = useState(false);
  if (!pron || scaffold === "off") return null;
  const box = (
    <span className="inline-flex items-baseline gap-1.5 rounded-md border border-dashed border-saffron-500/60 bg-saffron-100/60 px-1.5 py-0.5 text-sm dark:bg-saffron-700/20">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-saffron-700 dark:text-saffron-100">Approx. pronunciation</span>
      <span lang="hi" className="deva">{pron}</span>
    </span>
  );
  if (scaffold === "visible") return box;
  if (open) return <span className="inline-flex items-center gap-1">{box}<button type="button" className="text-xs underline" onClick={() => setOpen(false)}>hide</button></span>;
  return (
    <button type="button" className="text-xs text-saffron-700 underline dark:text-saffron-100" onClick={() => setOpen(true)} aria-label="Show approximate Devanagari pronunciation">
      {scaffold === "audio_first" ? "Listen first, then show pronunciation help" : "Show pronunciation help"}
    </button>
  );
}

export function FrItem({ item, day, save = true, source = "lesson", sourceRef, compact = false }: { item: FrItemData; day?: number; save?: boolean; source?: "lesson" | "web" | "dictionary"; sourceRef?: string; compact?: boolean }) {
  const { showIpa } = usePrefs();
  const genderLabel = item.gender === "m" ? "masc." : item.gender === "f" ? "fem." : item.gender === "mf" ? "masc./fem." : null;
  return (
    <div className={`flex flex-col gap-1 ${compact ? "" : "py-2"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span lang="fr" className="fr text-lg">{item.fr}</span>
        {genderLabel && <span className={`chip ${item.gender === "f" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100" : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100"}`}>{genderLabel}</span>}
        <Speak text={item.fr} label={item.fr} />
        {save && <SaveWordButton word={{ fr: item.fr, en: item.en, hi: item.hi, gender: item.gender, isPhrase: item.fr.trim().includes(" ") && !item.lemma, lemma: item.lemma }} source={source} sourceRef={sourceRef ?? (day ? `day:${day}` : undefined)} />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span><span className="text-muted text-xs">English: </span><span lang="en">{item.en}</span></span>
        <span><span className="text-muted text-xs">Hindi meaning: </span><span lang="hi" className="deva">{item.hi}</span></span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pron pron={item.pron} day={day} />
        {showIpa && item.ipa && <span className="text-xs text-muted">IPA /{item.ipa}/</span>}
      </div>
      {item.note && !compact && <Bi t={item.note} className="text-sm text-muted" />}
    </div>
  );
}
