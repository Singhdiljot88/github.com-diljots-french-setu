"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bi, useBiLabel } from "./bi";
import { Speak } from "./audio";
import { AccentBar } from "./accent-bar";
import { Pron } from "./practice-arcade";
import { HINDI_BRIDGES, BRIDGE_DAYS } from "@/lib/hindi-bridges";
import { filterGrammar, type GrammarPoint } from "@/lib/grammar-ref";
import { PHASES } from "@/content/outline";
import { api } from "@/lib/api-client";
import { buildDrill, gradeDrill, unlockedTenses, DRILL_TENSES, TENSE_FROM_DAY, type DrillVerb } from "@/lib/verb-drill";
import { TENSE_LABELS, type Tense } from "@/lib/conjugate";

type Tab = "lookup" | "drill" | "bridges";

export function GrammarStudio({ points, total, showAll, verbs, courseDay, initialVerb }: { points: GrammarPoint[]; total: number; showAll: boolean; verbs: DrillVerb[]; courseDay: number; initialVerb: string }) {
  const [tab, setTab] = useState<Tab>(initialVerb ? "drill" : "lookup");
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h === "drill" || h === "bridges" || h === "lookup") setTab(h);
  }, []);
  const open = (t: Tab) => { setTab(t); history.replaceState(null, "", t === "lookup" ? "/grammar" : `/grammar#${t}`); };
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="eyebrow"><Bi as="span" t={{ en: "Look it up, then drill it", hi: "देखें, फिर अभ्यास करें" }} /></p>
        <h1 className="text-3xl font-bold tracking-tight"><Bi as="span" t={{ en: "Grammar and verbs", hi: "व्याकरण और क्रियाएँ" }} /></h1>
        <Bi className="text-muted" t={{ en: "Every grammar point from the 120 days, in one place, plus a verb drill that tells you why a form is right or wrong.", hi: "120 दिनों का हर व्याकरण बिंदु एक जगह, और क्रिया-अभ्यास जो बताता है रूप क्यों सही या ग़लत है।" }} />
      </header>
      <div className="flex flex-wrap gap-2" role="tablist">
        {(["lookup", "drill", "bridges"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`toggle-chip ${tab === t ? "border-brand-600 bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-50" : ""}`} onClick={() => open(t)}>
            <Bi as="span" t={t === "lookup" ? { en: "Grammar", hi: "व्याकरण" } : t === "drill" ? { en: "Verb drill", hi: "क्रिया अभ्यास" } : { en: "From Hindi", hi: "हिंदी से" }} />
          </button>
        ))}
      </div>
      {tab === "lookup" && <Lookup points={points} total={total} showAll={showAll} courseDay={courseDay} />}
      {tab === "drill" && <Drill verbs={verbs} courseDay={courseDay} initialVerb={initialVerb} />}
      {tab === "bridges" && <Bridges />}
    </div>
  );
}

function Lookup({ points, total, showAll, courseDay }: { points: GrammarPoint[]; total: number; showAll: boolean; courseDay: number }) {
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState(0);
  const L = useBiLabel();
  const shown = useMemo(() => filterGrammar(points, { q, phase, maxDay: null }), [points, q, phase]);
  const hidden = Math.max(0, total - points.length);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input id="gram-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ en: "Search: passé, negation, depuis, लिंग…", hi: "खोजें: passé, negation, depuis, लिंग…" })} />
        {hidden > 0 && <Link className="btn btn-secondary btn-sm whitespace-nowrap" href="/grammar?all=1"><Bi as="span" t={{ en: `Show all ${total}`, hi: `सभी ${total} दिखाएँ` }} /></Link>}
        {showAll && <Link className="btn btn-secondary btn-sm whitespace-nowrap" href="/grammar"><Bi as="span" t={{ en: `Only up to day ${courseDay}`, hi: `सिर्फ़ दिन ${courseDay} तक` }} /></Link>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`toggle-chip ${phase === 0 ? "border-brand-600 bg-brand-100 dark:bg-brand-900" : ""}`} onClick={() => setPhase(0)}><Bi as="span" t={{ en: "All phases", hi: "सभी चरण" }} /></button>
        {PHASES.map((p) => (
          <button key={p.phase} type="button" className={`toggle-chip ${phase === p.phase ? "border-brand-600 bg-brand-100 dark:bg-brand-900" : ""}`} onClick={() => setPhase(p.phase)}>
            <Bi as="span" t={{ en: `${p.phase}. ${p.en}`, hi: `${p.phase}. ${p.hi}` }} />
          </button>
        ))}
      </div>
      <p className="text-sm text-muted"><Bi as="span" t={{ en: `${shown.length} grammar points`, hi: `${shown.length} व्याकरण बिंदु` }} />{hidden > 0 && <Bi as="span" t={{ en: ` · ${hidden} more after day ${courseDay}`, hi: ` · दिन ${courseDay} के बाद ${hidden} और` }} />}</p>
      <ul className="space-y-3">
        {shown.map((p) => (
          <li key={p.day} className="card space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold"><Bi as="span" t={p.title} /></h2>
              <Link className="text-sm underline" href={`/lesson/${p.day}`}><Bi as="span" t={{ en: `Day ${p.day}`, hi: `दिन ${p.day}` }} /></Link>
            </div>
            <Bi className="text-xs text-muted" t={p.lessonTitle} />
            <Bi t={p.explanation} />
            {p.comparison && <div className="rounded-lg surface-2 p-3"><Bi className="text-xs font-semibold uppercase text-muted" t={{ en: "Compare with English and Hindi", hi: "अंग्रेज़ी और हिंदी से तुलना" }} /><Bi t={p.comparison} /></div>}
            <ul className="space-y-2">
              {p.examples.map((e) => (
                <li key={e.fr}>
                  <p className="flex items-center gap-2 font-medium" lang="fr"><span>{e.fr}</span><Speak text={e.fr} /></p>
                  {e.pron && <Pron text={e.pron} />}
                  <p className="text-sm">{e.en}</p>
                  <p className="text-sm deva" lang="hi">{e.hi}</p>
                </li>
              ))}
            </ul>
            <details>
              <summary className="cursor-pointer text-sm font-semibold"><Bi as="span" t={{ en: "Watch out", hi: "ध्यान दें" }} /></summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{p.pitfalls.map((pit, i) => <Bi key={i} as="li" t={pit} />)}</ul>
            </details>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <Bi className="text-sm text-muted" t={{ en: "No grammar point matches. Clear the day limit or try another word.", hi: "कोई व्याकरण बिंदु नहीं मिला। दिन की सीमा हटाएँ या दूसरा शब्द आज़माएँ।" }} />}
    </div>
  );
}

function Drill({ verbs, courseDay, initialVerb }: { verbs: DrillVerb[]; courseDay: number; initialVerb: string }) {
  const available = unlockedTenses(courseDay, false);
  const [preview, setPreview] = useState(false);
  const [tense, setTense] = useState<Tense | "mix">("mix");
  const [lemma, setLemma] = useState(initialVerb);
  const [seed, setSeed] = useState(1);
  const [started, setStarted] = useState(false);
  const questions = useMemo(() => started ? buildDrill({ verbs, courseDay, preview, seed, tense, lemma, count: 8 }) : [], [started, verbs, courseDay, preview, seed, tense, lemma]);
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [mark, setMark] = useState<ReturnType<typeof gradeDrill> | null>(null);
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState<{ original: string; corrected: string; en: string; hi: string }[]>([]);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saved" | "error">("idle");
  const startedAt = useRef(Date.now());
  const L = useBiLabel();
  const q = questions[i];

  const begin = () => { startedAt.current = Date.now(); setSeed((s) => s + 1 + Math.floor(Math.random() * 1000)); setStarted(true); setI(0); setValue(""); setMark(null); setCorrect(0); setMisses([]); setDone(false); setSaved("idle"); };
  const check = () => {
    if (!q || mark) return;
    const g = gradeDrill(value, q);
    setMark(g);
    if (g.result !== "wrong") setCorrect((n) => n + 1);
    else setMisses((m) => [...m, { original: value.trim() || q.subject.fr, corrected: q.answer, en: g.feedback.en, hi: g.feedback.hi }]);
  };
  const next = async () => {
    if (i + 1 >= questions.length) {
      setDone(true);
      try {
        await api("/api/practice", { method: "POST", body: { game: "verb_drill", correct, total: questions.length, seconds: Math.min(3600, Math.max(1, (Date.now() - startedAt.current) / 1000)), misses: misses.slice(0, 5) } });
        setSaved("saved");
      } catch { setSaved("error"); }
      return;
    }
    setI((n) => n + 1); setValue(""); setMark(null);
  };

  return (
    <div className="space-y-4">
      <Bi className="text-sm text-muted" t={{ en: "Type the full form, including je, tu, il… The accent bar is under the box. An accent-only slip is marked, not failed.", hi: "पूरा रूप लिखें, je, tu, il सहित। Accent पट्टी बॉक्स के नीचे है। सिर्फ़ accent की चूक असफल नहीं गिनी जाती।" }} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`toggle-chip ${tense === "mix" ? "border-brand-600 bg-brand-100 dark:bg-brand-900" : ""}`} onClick={() => setTense("mix")}><Bi as="span" t={{ en: "Mix", hi: "मिश्रित" }} /></button>
        {DRILL_TENSES.map((t) => {
          const openT = preview || available.includes(t);
          return (
            <button key={t} type="button" disabled={!openT} className={`toggle-chip ${tense === t ? "border-brand-600 bg-brand-100 dark:bg-brand-900" : ""} disabled:opacity-40`} onClick={() => setTense(t)}>
              {TENSE_LABELS[t].fr}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="block flex-1 text-sm font-medium"><Bi as="span" t={{ en: "Verb", hi: "क्रिया" }} />
          <select className="input mt-1" value={lemma} onChange={(e) => setLemma(e.target.value)}>
            <option value="">{L({ en: "Any verb I've reached", hi: "जो क्रिया मैं तक पहुँचा हूँ" })}</option>
            {verbs.map((v) => <option key={v.lemma} value={v.lemma}>{v.lemma} — {v.en}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> <Bi as="span" t={{ en: "Preview later tenses", hi: "आगे के काल देखें" }} /></label>
      </div>
      {!started && <button type="button" className="btn btn-primary" onClick={begin}><Bi as="span" t={{ en: "Start 8 forms", hi: "8 रूप शुरू करें" }} /></button>}
      {started && !done && q && (
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); mark ? next() : check(); }}>
          <p className="text-sm text-muted">{i + 1} / {questions.length}{q.ahead && <Bi as="span" t={{ en: ` · taught on day ${q.taughtDay}`, hi: ` · दिन ${q.taughtDay} पर पढ़ाया जाता है` }} />}</p>
          <h2 className="text-2xl font-bold" lang="fr">{q.subject.fr} + {q.lemma}</h2>
          <p className="text-sm">{q.tenseLabel.fr} · {q.en} · <span lang="hi" className="deva">{q.hi}</span></p>
          {q.pron && <Pron text={q.pron} />}
          <label className="block text-sm font-medium" htmlFor="verb-answer"><Bi as="span" t={{ en: "Your form", hi: "आपका रूप" }} /></label>
          <input id="verb-answer" className="input text-lg" lang="fr" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} disabled={!!mark} autoFocus />
          <AccentBar targetId="verb-answer" />
          {mark && <div role="status" className={`rounded-lg p-3 text-sm ${mark.result === "wrong" ? "bg-red-50 dark:bg-red-950" : "bg-brand-50 dark:bg-brand-950"}`}><Bi t={mark.feedback} />{mark.result !== "wrong" && <p className="mt-2"><Speak text={q.answer} label={q.answer} /></p>}</div>}
          <div className="flex gap-2">
            {!mark ? <button className="btn btn-primary" type="submit"><Bi as="span" t={{ en: "Check", hi: "जाँचें" }} /></button> : <button className="btn btn-primary" type="submit"><Bi as="span" t={{ en: i + 1 >= questions.length ? "Finish" : "Next", hi: i + 1 >= questions.length ? "समाप्त" : "आगे" }} /></button>}
          </div>
        </form>
      )}
      {started && questions.length === 0 && <Bi className="text-sm" t={{ en: "No forms match these filters. Turn on later tenses, or pick another verb.", hi: "इन फ़िल्टरों पर कोई रूप नहीं। आगे के काल चालू करें, या दूसरी क्रिया चुनें।" }} />}
      {done && (
        <section className="card space-y-2">
          <h2 className="text-xl font-semibold"><Bi as="span" t={{ en: `${correct} / ${questions.length}`, hi: `${correct} / ${questions.length}` }} /></h2>
          <Bi t={saved === "saved" ? { en: "Saved to your practice record. Repeated misses are in the mistake notebook.", hi: "आपके अभ्यास रिकॉर्ड में सहेजा गया। बार-बार की चूक ग़लतियों की कॉपी में है।" } : saved === "error" ? { en: "The score could not be saved. Your answers on this page still stand.", hi: "अंक सहेजे नहीं जा सके। इस पृष्ठ के उत्तर फिर भी आपके पास हैं।" } : { en: "Saving…", hi: "सहेजा जा रहा है…" }} />
          <button type="button" className="btn btn-secondary" onClick={begin}><Bi as="span" t={{ en: "Another round", hi: "एक और दौर" }} /></button>
        </section>
      )}
      <p className="text-xs text-muted"><Bi as="span" t={{ en: `Present from day ${TENSE_FROM_DAY.present}, imperative ${TENSE_FROM_DAY.imperatif}, passé composé ${TENSE_FROM_DAY.passe_compose}, imparfait ${TENSE_FROM_DAY.imparfait}, futur ${TENSE_FROM_DAY.futur}, conditionnel ${TENSE_FROM_DAY.conditionnel}, subjonctif ${TENSE_FROM_DAY.subjonctif}.`, hi: `वर्तमान दिन ${TENSE_FROM_DAY.present} से, आज्ञार्थ ${TENSE_FROM_DAY.imperatif}, passé composé ${TENSE_FROM_DAY.passe_compose}, imparfait ${TENSE_FROM_DAY.imparfait}, futur ${TENSE_FROM_DAY.futur}, conditionnel ${TENSE_FROM_DAY.conditionnel}, subjonctif ${TENSE_FROM_DAY.subjonctif}।` }} /></p>
    </div>
  );
}

function Bridges() {
  const rows = Object.entries(BRIDGE_DAYS);
  return (
    <ul className="space-y-3">
      {(Object.keys(HINDI_BRIDGES) as (keyof typeof HINDI_BRIDGES)[]).map((key) => {
        const b = HINDI_BRIDGES[key];
        const day = rows.find(([, k]) => k === key)?.[0];
        return (
          <li key={key} className="card space-y-2">
            <h2 className="font-semibold"><Bi as="span" t={b.title} /></h2>
            <Bi t={b.text} />
            {day && <Link className="text-sm underline" href={`/lesson/${day}`}><Bi as="span" t={{ en: `Open day ${day}`, hi: `दिन ${day} खोलें` }} /></Link>}
          </li>
        );
      })}
    </ul>
  );
}
