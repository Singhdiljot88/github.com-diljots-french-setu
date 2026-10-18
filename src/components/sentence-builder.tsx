"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { checkAnswer, type AnswerCheck } from "@/lib/text";
import { Speak } from "./audio";
import { ResultLine } from "./exercises";

export type BuilderItem = { day: number; fr: string; en: string; hi: string };

const tokens = (s: string) => s.replace(/\s+([?!:;])/g, " $1").split(/\s+/).filter(Boolean);
function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export function SentenceBuilder({ items }: { items: BuilderItem[] }) {
  // Shuffled after mount only, so server and client render the same HTML.
  const [order, setOrder] = useState<number[] | null>(null);
  useEffect(() => { setOrder(shuffle(items.map((_, i) => i))); }, [items]);
  const [k, setK] = useState(0);
  if (!items.length) return <p className="text-sm text-muted">Sentences appear once you have started the course.</p>;
  if (!order) return <p className="text-sm text-muted">Loading…</p>;
  const item = items[order[k % order.length]];
  return <Round key={k} item={item} onNext={() => setK(k + 1)} />;
}

function Round({ item, onNext }: { item: BuilderItem; onNext: () => void }) {
  const words = useMemo(() => { const t = tokens(item.fr); let s = shuffle(t.map((w, i) => ({ w, i }))); if (s.every((x, i) => x.i === i) && t.length > 1) s = [...s.slice(1), s[0]]; return s; }, [item]);
  const [picked, setPicked] = useState<number[]>([]);
  const [res, setRes] = useState<AnswerCheck | null>(null);
  const built = picked.map((p) => words[p].w).join(" ");
  const check = () => {
    const r = checkAnswer(built, item.fr);
    setRes(r);
    api("/api/attempts", { body: { day: item.day, kind: "sentence_builder", itemRef: `builder:${item.day}:${item.fr.slice(0, 60)}`, skill: "grammar", correct: r.result === "correct",
      mistake: r.result === "wrong" ? { category: "grammar", original: built, corrected: item.fr, explanation: { en: `Word order: ${item.en}`, hi: item.hi } } : undefined } }).catch(() => {});
  };
  return (
    <div className="space-y-3">
      <p>{item.en} <span lang="hi" className="deva text-muted">· {item.hi}</span></p>
      <div className="min-h-12 rounded-lg border border-dashed border-app p-2" aria-live="polite" lang="fr">
        {picked.length === 0 ? <span className="text-sm text-muted">Tap the words below in order.</span> : (
          <div className="flex flex-wrap gap-1">{picked.map((p, i) => <button key={i} type="button" className="btn btn-secondary btn-sm" disabled={!!res} onClick={() => setPicked(picked.filter((_, j) => j !== i))} aria-label={`Remove ${words[p].w}`}>{words[p].w}</button>)}</div>
        )}
      </div>
      <div className="flex flex-wrap gap-1" lang="fr">
        {words.map((w, i) => <button key={i} type="button" className="btn btn-secondary btn-sm" disabled={picked.includes(i) || !!res} onClick={() => setPicked([...picked, i])}>{w.w}</button>)}
      </div>
      {!res ? (
        <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={picked.length !== words.length} onClick={check}>Check</button><button className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>Clear</button><button className="btn btn-ghost btn-sm" onClick={onNext}>Skip</button></div>
      ) : (
        <div className="space-y-2">
          <ResultLine r={res} />
          <p className="flex items-center gap-2" lang="fr"><span className="font-medium">{item.fr}</span><Speak text={item.fr} /></p>
          <p className="text-xs text-muted">From Day {item.day}.{res.result === "wrong" ? " Added to your mistake notebook." : ""}</p>
          <button className="btn btn-primary btn-sm" onClick={onNext}>Next sentence</button>
        </div>
      )}
    </div>
  );
}
