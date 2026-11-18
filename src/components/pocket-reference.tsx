"use client";
import { useMemo, useState } from "react";
import { frenchNumber, numberPron } from "@/lib/nombres";
import { Speak } from "./audio";
import { Bi, useBiLabel } from "./bi";

const TRICKY = [21, 70, 71, 80, 81, 90, 91, 99, 100];

const ARTICLES: { fr: string; en: string; hi: string }[] = [
  { fr: "le / la", en: "the (masculine / feminine singular)", hi: "पुल्लिंग / स्त्रीलिंग, एकवचन" },
  { fr: "l'", en: "the, before a vowel or a mute h (l'ami, l'heure) — not an aspirated h (le hockey)", hi: "स्वर या मौन h से पहले (l'ami, l'heure) — ह-अस्पिरे पर नहीं (le hockey)" },
  { fr: "les", en: "the (plural)", hi: "बहुवचन" },
  { fr: "un / une", en: "a, one", hi: "एक" },
  { fr: "des", en: "some (plural)", hi: "कुछ, बहुवचन" },
  { fr: "du / de la / de l'", en: "some (partitive: du pain, de la soupe)", hi: "कुछ मात्रा (du pain, de la soupe)" },
  { fr: "pas de", en: "not any, after a negative (je n'ai pas de voiture)", hi: "नकारात्मक वाक्य में “कोई नहीं”" },
];

const ETRE = ["je suis", "tu es", "il / elle / on est", "nous sommes", "vous êtes", "ils / elles sont"];
const AVOIR = ["j'ai", "tu as", "il / elle / on a", "nous avons", "vous avez", "ils / elles ont"];

const QUESTIONS: { fr: string; en: string; hi: string }[] = [
  { fr: "qui", en: "who", hi: "कौन" },
  { fr: "que / quoi", en: "what", hi: "क्या" },
  { fr: "où", en: "where", hi: "कहाँ" },
  { fr: "quand", en: "when", hi: "कब" },
  { fr: "comment", en: "how", hi: "कैसे" },
  { fr: "pourquoi", en: "why", hi: "क्यों" },
  { fr: "combien", en: "how much / how many", hi: "कितना / कितने" },
];

/** In-app card for the facts beginners look up constantly: numbers, articles, être, avoir, questions. */
export function PocketReference() {
  const [raw, setRaw] = useState("71");
  const L = useBiLabel();
  const parsed = useMemo(() => {
    const t = raw.trim();
    if (!t) return null;
    if (!/^\d+$/.test(t)) return { error: true as const };
    const n = Number(t);
    if (n > 9999) return { error: true as const };
    const spoken = frenchNumber(n);
    return { error: false as const, n, spoken, pron: numberPron(spoken) };
  }, [raw]);

  return (
    <div className="space-y-4">
      <section className="card space-y-3" aria-labelledby="numbers-h">
        <h3 id="numbers-h" className="font-semibold"><Bi as="span" t={{ en: "Numbers, the France way", hi: "संख्याएँ, फ़्रांस वाले ढंग से" }} /></h3>
        <Bi className="text-sm text-muted" t={{
          en: "TEF recordings mostly use soixante-dix (70), quatre-vingts (80) and quatre-vingt-dix (90). Belgium and Switzerland often say septante and nonante instead.",
          hi: "TEF की रिकॉर्डिंग में ज़्यादातर soixante-dix (70), quatre-vingts (80) और quatre-vingt-dix (90) आता है। बेल्जियम और स्विट्ज़रलैंड में अक्सर septante और nonante कहते हैं।",
        }} />
        <label className="block text-sm font-medium" htmlFor="pocket-n">{L({ en: "Type a number from 0 to 9999", hi: "0 से 9999 तक कोई संख्या लिखें" })}
          <input id="pocket-n" name="pocket-number" inputMode="numeric" className="input mt-1 font-semibold" value={raw} onChange={(e) => setRaw(e.target.value)} autoComplete="off" />
        </label>
        <div className="flex flex-wrap gap-2">
          {TRICKY.map((n) => (
            <button key={n} type="button" className={`chip border ${raw === String(n) ? "border-brand-500 bg-brand-100 text-brand-900" : "border-app"}`} onClick={() => setRaw(String(n))}>{n}</button>
          ))}
        </div>
        {parsed?.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300"><Bi as="span" t={{ en: "Enter a whole number from 0 to 9999.", hi: "0 से 9999 तक एक पूरी संख्या लिखें।" }} /></p>}
        {parsed && !parsed.error && (
          <div className="rounded-xl surface-2 p-3">
            <p className="text-xs text-muted">{parsed.n}</p>
            <p className="flex flex-wrap items-center gap-2 text-xl font-semibold" lang="fr">{parsed.spoken} <Speak text={parsed.spoken} /></p>
            <p lang="hi" className="deva text-lg text-saffron-700 dark:text-saffron-300">{parsed.pron}</p>
            <Bi className="text-xs text-muted" t={{ en: "Approximate pronunciation, not an exact match.", hi: "लगभग उच्चारण है, बिल्कुल सटीक नहीं।" }} />
          </div>
        )}
      </section>

      <section className="card space-y-2" aria-labelledby="articles-h">
        <h3 id="articles-h" className="font-semibold"><Bi as="span" t={{ en: "Articles", hi: "आर्टिकल" }} /></h3>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {ARTICLES.map((a) => (
            <li key={a.fr} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
              <span lang="fr" className="font-semibold">{a.fr}</span>
              <span className="text-muted"><Bi as="span" t={a} /></span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <VerbCard title={{ en: "être — to be", hi: "être — होना" }} forms={ETRE} />
        <VerbCard title={{ en: "avoir — to have", hi: "avoir — पास होना, उम्र बताना" }} forms={AVOIR} />
      </div>

      <section className="card space-y-2" aria-labelledby="q-h">
        <h3 id="q-h" className="font-semibold"><Bi as="span" t={{ en: "Question words", hi: "प्रश्न शब्द" }} /></h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {QUESTIONS.map((q) => (
            <li key={q.fr} className="flex items-center gap-2 rounded-xl surface-2 px-3 py-2 text-sm">
              <Speak text={q.fr.split(" / ")[0]} showSlow={false} />
              <span><span lang="fr" className="font-semibold">{q.fr}</span> <span className="text-muted">· <Bi as="span" t={q} /></span></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function VerbCard({ title, forms }: { title: { en: string; hi: string }; forms: string[] }) {
  return (
    <section className="card space-y-2">
      <h3 className="font-semibold"><Bi as="span" t={title} /></h3>
      <ul className="space-y-1 text-sm">
        {forms.map((f) => (
          <li key={f} className="flex items-center gap-2"><Speak text={f.replaceAll(" / ", " ")} showSlow={false} /><span lang="fr">{f}</span></li>
        ))}
      </ul>
    </section>
  );
}
