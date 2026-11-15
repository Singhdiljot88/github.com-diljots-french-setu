"use client";
import { useState } from "react";
import { Speak } from "@/components/audio";

export type TryWord = { fr: string; pron: string; en: string; hi: string };

export function TryWords({ words }: { words: TryWord[] }) {
  const [phase, setPhase] = useState<"learn" | "check" | "done">("learn");
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  // Fixed, simple order: the same for everyone, so the server and browser render alike.
  const quiz = words.slice(0, 3).map((w, i) => ({ w, options: [w, words[(i + 1) % words.length], words[(i + 3) % words.length]].sort((a, b) => a.fr.localeCompare(b.fr)) }));

  if (phase === "learn") return (
    <section className="space-y-3">
      <ol className="space-y-2">
        {words.map((w, i) => (
          <li key={w.fr} className="card flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-900">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span lang="fr" className="block text-xl font-semibold">{w.fr}</span>
              <span lang="hi" className="deva block text-lg font-medium text-saffron-700 dark:text-saffron-300">{w.pron}</span>
              <span className="block text-sm text-muted">{w.en} · <span lang="hi" className="deva">{w.hi}</span></span>
            </span>
            <Speak text={w.fr} />
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">Devanagari shows the approximate sound; listening teaches the rest. · <span lang="hi" className="deva">देवनागरी लगभग आवाज़ बताती है; बाक़ी सुनकर सीखें।</span></p>
      <button type="button" className="btn btn-primary w-full" onClick={() => setPhase("check")}>I've got them: check me · <span lang="hi" className="deva">याद हो गए: जाँचें</span></button>
    </section>
  );

  if (phase === "done") return (
    <section className="card space-y-2 text-center animate-pop" aria-live="polite">
      <p className="text-4xl font-bold">{score} / {quiz.length}</p>
      <p className="font-semibold">{score === quiz.length ? "Très bien ! You already know some French." : "Bien ! A little listening practice and they'll stick."}</p>
      <p lang="hi" className="deva text-muted">{score === quiz.length ? "बहुत बढ़िया! आप कुछ फ़्रेंच जान गए।" : "अच्छा! थोड़ा सुनने का अभ्यास करें, फिर ये याद रहेंगे।"}</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPhase("learn"); setQ(0); setScore(0); setPicked(null); }}>See the words again · <span lang="hi" className="deva">शब्द फिर देखें</span></button>
    </section>
  );

  const cur = quiz[q];
  return (
    <section className="card space-y-4" aria-live="polite">
      <p className="text-sm text-muted">Question {q + 1} of {quiz.length} · <span lang="hi" className="deva">सवाल {q + 1} / {quiz.length}</span></p>
      <p className="text-lg font-semibold">Which word means “{cur.w.en.split(" / ")[0]}”? · <span lang="hi" className="deva">“{cur.w.hi.split(" / ")[0]}” के लिए कौन-सा शब्द है?</span></p>
      <ul className="grid gap-2">
        {cur.options.map((o) => {
          const state = !picked ? "" : o.fr === cur.w.fr ? "is-right" : picked === o.fr ? "is-wrong" : "is-dim";
          return <li key={o.fr}><button type="button" className={`choice-btn w-full flex-col ${state}`} disabled={!!picked} onClick={() => { setPicked(o.fr); if (o.fr === cur.w.fr) setScore((s) => s + 1); }}>
            <span lang="fr" className="text-lg">{o.fr}</span>
            {picked && <span lang="hi" className="deva text-sm font-normal text-saffron-700 dark:text-saffron-300">{o.pron}</span>}
          </button></li>;
        })}
      </ul>
      {picked && (
        <div className="flex items-center gap-2">
          <Speak text={cur.w.fr} showSlow={false} />
          <button type="button" className="btn btn-primary btn-sm ml-auto" autoFocus onClick={() => { setPicked(null); if (q + 1 >= quiz.length) setPhase("done"); else setQ(q + 1); }}>Next → · <span lang="hi" className="deva">आगे</span></button>
        </div>
      )}
    </section>
  );
}
