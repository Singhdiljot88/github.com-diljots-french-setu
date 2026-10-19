"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { checkAnswer, type AnswerCheck } from "@/lib/text";
import { Speak } from "./audio";
import { ResultLine } from "./exercises";
import { Bi, useBiLabel } from "./bi";

export type BuilderItem = { day: number; fr: string; en: string; hi: string };

const tokens = (s: string) => s.replace(/\s+([?!:;])/g, " $1").split(/\s+/).filter(Boolean);
function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export function SentenceBuilder({ items }: { items: BuilderItem[] }) {
  // Shuffled after mount only, so server and client render the same HTML.
  const [order, setOrder] = useState<number[] | null>(null);
  useEffect(() => { setOrder(shuffle(items.map((_, i) => i))); }, [items]);
  const [k, setK] = useState(0);
  if (!items.length) return <Bi className="text-sm text-muted" t={{ en: "Sentences appear once you have started the course.", hi: "पाठ्यक्रम शुरू करने के बाद यहाँ वाक्य दिखेंगे।" }} />;
  if (!order) return <Bi className="text-sm text-muted" t={{ en: "Loading…", hi: "लोड हो रहा है…" }} />;
  const item = items[order[k % order.length]];
  return <Round key={k} item={item} onNext={() => setK(k + 1)} />;
}

function Round({ item, onNext }: { item: BuilderItem; onNext: () => void }) {
  const words = useMemo(() => { const t = tokens(item.fr); let s = shuffle(t.map((w, i) => ({ w, i }))); if (s.every((x, i) => x.i === i) && t.length > 1) s = [...s.slice(1), s[0]]; return s; }, [item]);
  const [picked, setPicked] = useState<number[]>([]);
  const [res, setRes] = useState<AnswerCheck | null>(null);
  const L = useBiLabel();
  const built = picked.map((p) => words[p].w).join(" ");
  const check = () => {
    const r = checkAnswer(built, item.fr);
    setRes(r);
    api("/api/attempts", { body: { day: item.day, kind: "sentence_builder", itemRef: `builder:${item.day}:${item.fr.slice(0, 60)}`, skill: "grammar", correct: r.result === "correct",
      mistake: r.result === "wrong" ? { category: "grammar", original: built, corrected: item.fr, explanation: { en: `Word order: ${item.en}`, hi: `शब्द क्रम: ${item.hi}` } } : undefined } }).catch(() => {});
  };
  return (
    <div className="space-y-3">
      <Bi t={{ en: item.en, hi: item.hi }} />
      <div>
        <Bi as="h3" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted" t={{ en: "Your sentence", hi: "आपका वाक्य" }} />
        <div className="min-h-12 rounded-lg border-2 border-brand-500/60 bg-brand-50 p-2 dark:bg-brand-900/30" aria-live="polite" aria-label={L({ en: "Your sentence", hi: "आपका वाक्य" })} role="group" lang="fr">
          {picked.length === 0 ? <Bi as="span" className="text-sm text-muted" t={{ en: "Tap the words below in order.", hi: "नीचे दिए शब्दों को सही क्रम में टैप करें।" }} /> : (
            <div className="flex flex-wrap gap-1">{picked.map((p, i) => <button key={i} type="button" className="btn btn-primary btn-sm" disabled={!!res} onClick={() => setPicked(picked.filter((_, j) => j !== i))} aria-label={L({ en: `Remove ${words[p].w}`, hi: `${words[p].w} हटाएँ` })}>{words[p].w}</button>)}</div>
          )}
        </div>
      </div>
      <div>
        <Bi as="h3" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted" t={{ en: "Words to use", hi: "इस्तेमाल के लिए शब्द" }} />
        <div className="flex min-h-10 flex-wrap gap-1 rounded-lg border border-dashed border-app p-2" role="group" aria-label={L({ en: "Words to use", hi: "इस्तेमाल के लिए शब्द" })} lang="fr">
          {words.map((w, i) => {
            const used = picked.includes(i);
            return (
              <button key={i} type="button" aria-pressed={used} className={`btn btn-sm ${used ? "btn-ghost border border-dashed border-app text-muted line-through opacity-50" : "btn-secondary"}`} disabled={used || !!res} onClick={() => setPicked([...picked, i])}>
                {w.w}{used && <span className="sr-only"> ({L({ en: "used", hi: "इस्तेमाल हो गया" })})</span>}
              </button>
            );
          })}
        </div>
      </div>
      {!res ? (
        <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={picked.length !== words.length} onClick={check}><Bi as="span" t={{ en: "Check", hi: "उत्तर जाँचें" }} /></button><button className="btn btn-ghost btn-sm" onClick={() => setPicked([])}><Bi as="span" t={{ en: "Clear", hi: "साफ़ करें" }} /></button><button className="btn btn-ghost btn-sm" onClick={onNext}><Bi as="span" t={{ en: "Skip", hi: "छोड़ें" }} /></button></div>
      ) : (
        <div className="space-y-2">
          <ResultLine r={res} />
          <p className="flex items-center gap-2" lang="fr"><span className="font-medium">{item.fr}</span><Speak text={item.fr} /></p>
          <Bi className="text-xs text-muted" t={{ en: `From Day ${item.day}.${res.result === "wrong" ? " Added to your mistake notebook." : ""}`, hi: `दिन ${item.day} से।${res.result === "wrong" ? " आपकी ग़लतियों की कॉपी में जोड़ दिया गया।" : ""}` }} />
          <button className="btn btn-primary btn-sm" onClick={onNext}><Bi as="span" t={{ en: "Next sentence", hi: "अगला वाक्य" }} /></button>
        </div>
      )}
    </div>
  );
}
