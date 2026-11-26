"use client";
import { Bi } from "./bi";
import { Speak } from "./audio";
import type { ScoredEvaluation } from "@/lib/score";

const CRITERIA = [
  ["grammar", { en: "Grammar", hi: "व्याकरण" }],
  ["vocabulary", { en: "Vocabulary", hi: "शब्दावली" }],
  ["fluency", { en: "Fluency", hi: "प्रवाह" }],
  ["task", { en: "Task", hi: "कार्य" }],
] as const;

export function EvaluationCard({ ev }: { ev: ScoredEvaluation }) {
  const e = ev.evaluation;
  return (
    <section className="card score-card space-y-3" aria-labelledby={`ev-${ev.id}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id={`ev-${ev.id}`} className="font-semibold"><Bi as="span" t={{ en: "Practice score", hi: "अभ्यास अंक" }} /></h3>
          <p className="text-xs text-muted"><Bi as="span" t={ev.label} /></p>
        </div>
        <p className="text-right">
          <span className="block text-3xl font-semibold tabular-nums">{e.overall.toFixed(1)}<span className="text-base text-muted">/10</span></span>
          <span className="chip bg-brand-100 text-brand-900">NCLC {e.nclc} <Bi as="span" t={{ en: "estimate", hi: "अनुमान" }} /></span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CRITERIA.map(([key, label]) => (
          <div key={key} className="stat-tile">
            <p className="text-xs text-muted"><Bi as="span" t={label} /></p>
            <p className="text-lg font-semibold tabular-nums">{e[key].toFixed(1)}</p>
            <div className="phase-meter" aria-hidden><span style={{ ["--p" as string]: e[key] / 10 }} /></div>
          </div>
        ))}
      </div>
      <Bi t={e.encouragement} className="text-sm" />
      <Bi t={e.summary} className="text-sm" />
      {e.corrections.length > 0 && (
        <ol className="space-y-2">
          {e.corrections.map((c, i) => (
            <li key={i} className="rounded-lg surface-2 p-2 text-sm">
              <p><span lang="fr" className="line-through text-muted">{c.original}</span></p>
              <p lang="fr" className="font-medium">{c.corrected} <Speak text={c.corrected} /></p>
              <Bi t={c.why} />
            </li>
          ))}
        </ol>
      )}
      <div>
        <Bi as="h3" className="font-semibold" t={{ en: "Next steps", hi: "अगले कदम" }} />
        <ol className="mt-1 list-decimal pl-5 text-sm">{e.nextSteps.map((s, i) => <li key={i}><Bi t={s} /></li>)}</ol>
      </div>
      <div className="rounded-lg surface-2 p-3 text-sm">
        <Bi as="h3" className="font-semibold" t={{ en: "A model answer", hi: "एक नमूना उत्तर" }} />
        <p lang="fr" className="mt-1 font-medium">{e.modelAnswer.fr} <Speak text={e.modelAnswer.fr} /></p>
        <Bi t={{ en: e.modelAnswer.en, hi: e.modelAnswer.hi }} className="text-muted" />
      </div>
      <Bi className="text-xs text-muted" t={{ en: "This estimate is for practice only. It is not an official TEF score, CLB level, or NCLC result.", hi: "यह अनुमान केवल अभ्यास के लिए है। यह आधिकारिक TEF अंक, CLB स्तर, या NCLC परिणाम नहीं है।" }} />
    </section>
  );
}
