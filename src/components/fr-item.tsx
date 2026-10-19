"use client";
import { useState } from "react";
import Link from "next/link";
import { Speak } from "./audio";
import { Bi } from "./bi";
import { usePrefs, useScaffold } from "./prefs";
import { SaveWordButton } from "./save-word";

export type FrItemData = { fr: string; en: string; hi: string; pron?: string; ipa?: string; note?: { en: string; hi: string }; gender?: string; pos?: string; lemma?: string; mnemonic?: { hi: string; en?: string; reviewed?: boolean } };

/** Sounds in the Devanagari guide that work differently from Hindi; each tip shows only when the guide uses it. */
const SOUND_TIPS: { test: RegExp; en: string; hi: string; href?: string }[] = [
  { test: /र/, en: "र is the French r: soft, from the back of the throat. Do not roll it.", hi: "र यहाँ फ़्रेंच r है: गले के पीछे से, हल्का। इसे हिंदी र की तरह घुमाएँ नहीं।" },
  { test: /यू/, en: "यू / ्यू: say ई with your lips rounded as for ऊ. It is not the English word \"you\".", hi: "यू / ्यू: होंठ ऊ की तरह गोल करके ई बोलें। यह अंग्रेज़ी \"you\" नहीं है।" },
  { test: /ज/, en: "ज is often the soft French j, as in English \"measure\". Check the audio.", hi: "ज अक्सर फ़्रेंच का नरम j है, जैसे अंग्रेज़ी \"measure\" में। ऑडियो सुनकर जाँचें।" },
  { test: /[ँं]/, en: "ँ / ं: a nasal vowel. Push the air through the nose and do not say a full न or म at the end.", hi: "ँ / ं: नाक से निकलने वाला स्वर। आख़िर में पूरा न या म न बोलें।", href: "/pronunciation?sound=on" },
  { test: /(^|[\s-])[क-ह](?=$|[\s-])|अ/, en: "A bare letter such as ल or द has a short, relaxed, slightly rounded vowel, lighter than Hindi अ.", hi: "ल या द जैसा अकेला अक्षर: छोटा, ढीला, हल्का गोल स्वर, हिंदी अ से हल्का।" },
];

function SoundHelp({ pron }: { pron: string }) {
  const [open, setOpen] = useState(false);
  const tips = SOUND_TIPS.filter((t) => t.test.test(pron));
  if (!tips.length) return null;
  return (
    <span className="text-xs">
      <button type="button" className="underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Bi as="span" t={{ en: "Sound help", hi: "कैसे बोलें" }} /></button>
      {open && <span className="mt-1 block space-y-0.5">{tips.map((t) => <span key={t.en} className="block">• <Bi as="span" t={t} />{t.href && <> <Link className="underline" href={t.href}><Bi as="span" t={{ en: "Practise nasal vowels", hi: "अनुनासिक स्वरों का अभ्यास करें" }} /></Link></>}</span>)}</span>}
    </span>
  );
}

/** Approximate Devanagari pronunciation, kept visually separate from the Hindi meaning. */
export function Pron({ pron, day, examPractice }: { pron?: string; day?: number; examPractice?: boolean }) {
  const scaffold = useScaffold(day, examPractice);
  const [open, setOpen] = useState(false);
  if (!pron || scaffold === "off") return null;
  const box = (
    <span className="inline-flex flex-wrap items-baseline gap-1.5 rounded-md border border-dashed border-saffron-500/60 bg-saffron-100/60 px-1.5 py-0.5 text-sm dark:bg-saffron-700/20">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-saffron-700 dark:text-saffron-100"><Bi as="span" t={{ en: "Pronunciation guide (approx.)", hi: "उच्चारण सहायता" }} /></span>
      <span lang="hi" className="deva">{pron}</span>
      <SoundHelp pron={pron} />
    </span>
  );
  if (scaffold === "visible") return box;
  if (open) return <span className="inline-flex items-center gap-1">{box}<button type="button" className="text-xs underline" onClick={() => setOpen(false)}><Bi as="span" t={{ en: "hide", hi: "छिपाएँ" }} /></button></span>;
  return (
    <button type="button" className="text-xs text-saffron-700 underline dark:text-saffron-100" onClick={() => setOpen(true)} aria-label="Show approximate Devanagari pronunciation">
      <Bi as="span" t={scaffold === "audio_first" ? { en: "Listen first, then show pronunciation help", hi: "पहले सुनें, फिर उच्चारण सहायता देखें" } : { en: "Show pronunciation help", hi: "उच्चारण सहायता देखें" }} />
    </button>
  );
}

/** The meanings. The Hindi meaning always shows; Hindi-only mode drops the English. */
function EnHi({ en, hi }: { en: string; hi: string }) {
  const { explanationLang } = usePrefs();
  return (
    <>
      {explanationLang !== "hi" && <span><span className="text-muted text-xs">English: </span><span lang="en">{en}</span></span>}
      {<span><span className="text-muted text-xs">{explanationLang === "hi" ? <span lang="hi" className="deva">हिंदी अर्थ: </span> : "Hindi meaning: "}</span><span lang="hi" className="deva">{hi}</span></span>}
    </>
  );
}

/** A short "English · Hindi" meaning line; the Hindi always shows, the English is dropped in Hindi-only mode. */
export function Meaning({ en, hi }: { en: string; hi: string }) {
  const { explanationLang } = usePrefs();
  return <>{explanationLang !== "hi" && <>{en} · </>}<span lang="hi" className="deva">{hi}</span></>;
}

export function FrItem({ item, day, save = true, source = "lesson", sourceRef, compact = false }: { item: FrItemData; day?: number; save?: boolean; source?: "lesson" | "web" | "dictionary"; sourceRef?: string; compact?: boolean }) {
  const { showIpa } = usePrefs();
  const genderLabel = item.gender === "m" ? { en: "masc.", hi: "पुल्लिंग" } : item.gender === "f" ? { en: "fem.", hi: "स्त्रीलिंग" } : item.gender === "mf" ? { en: "masc./fem.", hi: "पुल्लिंग/स्त्रीलिंग" } : null;
  return (
    <div className={`flex flex-col gap-1 ${compact ? "" : "py-2"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span lang="fr" className="fr text-lg">{item.fr}</span>
        {genderLabel && <span className={`chip ${item.gender === "f" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100" : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100"}`}><Bi as="span" t={genderLabel} /></span>}
        <Speak text={item.fr} label={item.fr} />
        {save && <SaveWordButton word={{ fr: item.fr, en: item.en, hi: item.hi, gender: item.gender, isPhrase: item.fr.trim().includes(" ") && !item.lemma, lemma: item.lemma }} source={source} sourceRef={sourceRef ?? (day ? `day:${day}` : undefined)} />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <EnHi en={item.en} hi={item.hi} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pron pron={item.pron} day={day} />
        {showIpa && item.ipa && <span className="text-xs text-muted">IPA /{item.ipa}/</span>}
      </div>
      {item.note && !compact && <Bi t={item.note} className="text-sm text-muted" />}
      {item.mnemonic && !compact && (
        <p className="text-sm"><span className="font-semibold"><Bi as="span" t={{ en: "Memory tip", hi: "याद करने की तरकीब" }} />:</span> <Bi as="span" t={{ en: item.mnemonic.en ?? item.mnemonic.hi, hi: item.mnemonic.hi }} />{!item.mnemonic.reviewed && <span className="text-xs text-muted"> (<Bi as="span" t={{ en: "AI-drafted, not yet reviewed", hi: "AI से बना, अभी जाँचा नहीं गया" }} />)</span>}</p>
      )}
    </div>
  );
}
