"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { AnswerCheck } from "@/lib/text";
import { ResultLine } from "./exercises";
import { AccentBar } from "./accent-bar";
import { CATEGORY_LABEL } from "@/lib/labels";

type M = {
  id: string; category: string; source: string; sourceRef: string | null; original: string; corrected: string;
  explanation: { en: string; hi?: string }; drill: { prompt: string; answer: string; accept?: string[] } | null;
  occurrences: number; resolved: boolean; lastSeenAt: string; createdAt: string;
};


const SOURCE_LABEL: Record<string, string> = {
  writing: "Writing", speaking: "Speaking", lesson: "Lesson", assessment: "Lesson check", dictionary: "Dictionary",
  mock_reading: "Practice exam: reading", mock_listening: "Practice exam: listening", sentence_builder: "Sentence builder",
};
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s.replace(/_/g, " ");
const sourceLink = (m: M) => {
  const day = m.sourceRef?.match(/^day:(\d+)/)?.[1];
  if (day) return `/lesson/${day}`;
  return null;
};

export function MistakeNotebook({ initial }: { initial: M[] }) {
  const [items, setItems] = useState(initial);
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [cat, setCat] = useState("all");
  const [drilling, setDrilling] = useState(false);
  const [limit, setLimit] = useState(30);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of items) if (!m.resolved) c[m.category] = (c[m.category] ?? 0) + m.occurrences;
    return c;
  }, [items]);
  const shown = items.filter((m) => (status === "all" || (status === "open") !== m.resolved) && (cat === "all" || m.category === cat))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.occurrences - a.occurrences || b.lastSeenAt.localeCompare(a.lastSeenAt));
  const update = (m: M) => setItems((xs) => xs.map((x) => (x.id === m.id ? m : x)));
  const remove = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));
  const openCount = items.filter((m) => !m.resolved).length;
  const queue = items.filter((m) => !m.resolved && m.drill).sort((a, b) => b.occurrences - a.occurrences).slice(0, 10);

  if (drilling) return <DrillSession queue={queue} onDone={() => setDrilling(false)} onUpdate={update} />;
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="card text-sm">
          <p>Nothing here yet. Wrong answers in lessons, checks, practice exams, and corrections from writing and speaking feedback collect here, each with a short drill.</p>
        </div>
      ) : (
        <>
          <section aria-label="Summary" className="card space-y-2">
            <p><strong>{openCount}</strong> open · {items.length - openCount} resolved</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                <li key={c}><button type="button" className={`chip ${cat === c ? "bg-brand-100 text-brand-900" : "surface-2"}`} onClick={() => setCat(cat === c ? "all" : c)} aria-pressed={cat === c}>{CATEGORY_LABEL[c]?.en ?? c} · {n}</button></li>
              ))}
            </ul>
            <p className="text-xs text-muted">Numbers count how often each kind of error has come up, including repeats.</p>
            <button type="button" className="btn btn-primary" disabled={!queue.length} onClick={() => setDrilling(true)}>
              {queue.length ? `Drill my top ${queue.length}` : "No open drills"}
            </button>
          </section>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm">Show <select className="input mt-1 w-auto" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setLimit(30); }}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select></label>
            <label className="text-sm">Type <select className="input mt-1 w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All types</option>{Object.keys(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c].en}</option>)}</select></label>
          </div>
          {shown.length === 0 && <p className="text-sm text-muted">Nothing matches these filters.</p>}
          <ul className="space-y-2">{shown.slice(0, limit).map((m) => <MistakeItem key={m.id} m={m} onUpdate={update} onRemove={remove} />)}</ul>
          {shown.length > limit && <button type="button" className="btn btn-secondary" onClick={() => setLimit(limit + 30)}>Show more ({shown.length - limit} left)</button>}
        </>
      )}
    </div>
  );
}

function MistakeItem({ m, onUpdate, onRemove }: { m: M; onUpdate: (m: M) => void; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = sourceLink(m);
  const toggle = async () => {
    setBusy(true);
    try { const r = await api<{ mistake: M }>(`/api/mistakes/${m.id}`, { method: "PATCH", body: { resolved: !m.resolved } }); onUpdate({ ...m, resolved: r.mistake.resolved }); } finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { await api(`/api/mistakes/${m.id}`, { method: "DELETE" }); onRemove(m.id); } finally { setBusy(false); } };
  return (
    <li className={`card space-y-2 ${m.resolved ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="chip surface-2">{CATEGORY_LABEL[m.category]?.en ?? m.category} <span lang="hi" className="deva">· {CATEGORY_LABEL[m.category]?.hi}</span></span>
        <span className="text-muted">{sourceLabel(m.source)}{link && <> · <Link href={link} className="underline">open</Link></>}</span>
        {m.occurrences > 1 && <span className="chip bg-saffron-100 text-saffron-700">seen {m.occurrences}×</span>}
        {m.resolved && <span className="chip bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">resolved</span>}
      </div>
      <p className="text-sm"><span className="text-red-700 line-through decoration-1 dark:text-red-300" lang="fr">{m.original}</span> → <span className="font-medium" lang="fr">{m.corrected}</span></p>
      <p className="text-sm">{m.explanation.en}</p>
      {m.explanation.hi && <p lang="hi" className="deva text-sm text-muted">{m.explanation.hi}</p>}
      <div className="flex flex-wrap gap-2">
        {m.drill && !m.resolved && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide drill" : "Practise"}</button>}
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={toggle}>{m.resolved ? "Reopen" : "Mark resolved"}</button>
        <button type="button" className="btn btn-sm text-muted underline" disabled={busy} onClick={del}>Remove</button>
      </div>
      {open && m.drill && <Drill m={m} onResolved={() => onUpdate({ ...m, resolved: true })} />}
    </li>
  );
}

function Drill({ m, onResolved, autoFocus }: { m: M; onResolved: () => void; autoFocus?: boolean }) {
  const [val, setVal] = useState("");
  const [res, setRes] = useState<AnswerCheck | null>(null);
  const id = `drill-${m.id}`;
  const check = async () => {
    const r = await api<AnswerCheck & { resolved: boolean }>(`/api/mistakes/${m.id}`, { body: { answer: val } });
    setRes(r);
    if (r.resolved) onResolved();
  };
  return (
    <div className="space-y-2 rounded-lg surface-2 p-3">
      <label htmlFor={id} className="block text-sm font-medium" lang="fr">{m.drill!.prompt}</label>
      <input id={id} lang="fr" className="input" value={val} autoFocus={autoFocus} onChange={(e) => { setVal(e.target.value); setRes(null); }} onKeyDown={(e) => { if (e.key === "Enter") check(); }} autoComplete="off" spellCheck={false} />
      <AccentBar targetId={id} />
      <button type="button" className="btn btn-primary btn-sm" disabled={!val.trim()} onClick={check}>Check</button>
      {res && <ResultLine r={res} />}
      {res?.result === "correct" && <p className="text-xs text-muted">Marked resolved. It comes back if you make the same error again.</p>}
    </div>
  );
}

function DrillSession({ queue, onDone, onUpdate }: { queue: M[]; onDone: () => void; onUpdate: (m: M) => void }) {
  const [i, setI] = useState(0);
  const m = queue[i];
  if (!m) return (
    <div className="card space-y-2"><p className="font-semibold">Drill finished.</p><button type="button" className="btn btn-primary" onClick={onDone}>Back to the notebook</button></div>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Drill {i + 1} of {queue.length} · {CATEGORY_LABEL[m.category]?.en ?? m.category}</p>
      <details className="text-sm"><summary className="cursor-pointer">Show the original mistake</summary><p className="mt-1"><span lang="fr" className="line-through">{m.original}</span> → <span lang="fr">{m.corrected}</span></p><p>{m.explanation.en}</p></details>
      <Drill key={m.id} m={m} autoFocus onResolved={() => onUpdate({ ...m, resolved: true })} />
      <div className="flex gap-2"><button type="button" className="btn btn-secondary" onClick={() => setI(i + 1)}>Next →</button><button type="button" className="btn btn-sm underline" onClick={onDone}>Stop</button></div>
    </div>
  );
}
