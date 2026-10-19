"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { AnswerCheck } from "@/lib/text";
import { ResultLine } from "./exercises";
import { AccentBar } from "./accent-bar";
import { CATEGORY_LABEL } from "@/lib/labels";
import { Bi, useBiLabel } from "./bi";

type M = {
  id: string; category: string; source: string; sourceRef: string | null; original: string; corrected: string;
  explanation: { en: string; hi?: string }; drill: { prompt: string; answer: string; accept?: string[] } | null;
  occurrences: number; resolved: boolean; lastSeenAt: string; createdAt: string;
};


const SOURCE_LABEL: Record<string, { en: string; hi: string }> = {
  writing: { en: "Writing", hi: "लेखन" }, speaking: { en: "Speaking", hi: "बोलना" }, lesson: { en: "Lesson", hi: "पाठ" }, assessment: { en: "Lesson check", hi: "पाठ की जाँच" }, dictionary: { en: "Dictionary", hi: "शब्दकोश" },
  mock_reading: { en: "Practice exam: reading", hi: "परीक्षा अभ्यास: पढ़ना" }, mock_listening: { en: "Practice exam: listening", hi: "परीक्षा अभ्यास: सुनना" }, sentence_builder: { en: "Sentence builder", hi: "वाक्य बनाइए" },
};
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? { en: s.replace(/_/g, " ") };
const catLabel = (c: string) => CATEGORY_LABEL[c] ?? { en: c };
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
  const L = useBiLabel();
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
          <Bi t={{ en: "Nothing here yet. Wrong answers in lessons, checks, practice exams, and corrections from writing and speaking feedback collect here, each with a short drill.", hi: "अभी यहाँ कुछ नहीं है। पाठों, जाँचों और परीक्षा अभ्यास के ग़लत उत्तर, और लेखन व बोलने के फ़ीडबैक के सुधार यहाँ जमा होते हैं, हर एक के साथ एक छोटा अभ्यास।" }} />
        </div>
      ) : (
        <>
          <section aria-label={L({ en: "Summary", hi: "सारांश" })} className="card space-y-2">
            <Bi t={{ en: `${openCount} open · ${items.length - openCount} resolved`, hi: `${openCount} बाक़ी · ${items.length - openCount} सुलझीं` }} />
            <ul className="flex flex-wrap gap-2 text-sm">
              {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                <li key={c}><button type="button" className={`chip ${cat === c ? "bg-brand-100 text-brand-900" : "surface-2"}`} onClick={() => setCat(cat === c ? "all" : c)} aria-pressed={cat === c}>{L(catLabel(c))} · {n}</button></li>
              ))}
            </ul>
            <Bi className="text-xs text-muted" t={{ en: "Numbers count how often each kind of error has come up, including repeats.", hi: "संख्याएँ बताती हैं कि हर तरह की ग़लती कितनी बार हुई, दोबारा हुई ग़लतियों को भी गिनकर।" }} />
            <button type="button" className="btn btn-primary" disabled={!queue.length} onClick={() => setDrilling(true)}>
              <Bi as="span" t={queue.length ? { en: `Drill my top ${queue.length}`, hi: `मेरी सबसे ज़्यादा होने वाली ${queue.length} ग़लतियों का अभ्यास करें` } : { en: "No open drills", hi: "कोई अभ्यास बाक़ी नहीं" }} />
            </button>
          </section>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm">{L({ en: "Show", hi: "दिखाएँ" })} <select className="input mt-1 w-auto" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setLimit(30); }}><option value="open">{L({ en: "Open", hi: "बाक़ी" })}</option><option value="resolved">{L({ en: "Resolved", hi: "सुलझी हुई" })}</option><option value="all">{L({ en: "All", hi: "सभी" })}</option></select></label>
            <label className="text-sm">{L({ en: "Type", hi: "प्रकार" })} <select className="input mt-1 w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">{L({ en: "All types", hi: "सभी प्रकार" })}</option>{Object.keys(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{L(CATEGORY_LABEL[c])}</option>)}</select></label>
          </div>
          {shown.length === 0 && <Bi className="text-sm text-muted" t={{ en: "Nothing matches these filters.", hi: "इन फ़िल्टरों से कुछ मेल नहीं खाता।" }} />}
          <ul className="space-y-2">{shown.slice(0, limit).map((m) => <MistakeItem key={m.id} m={m} onUpdate={update} onRemove={remove} />)}</ul>
          {shown.length > limit && <button type="button" className="btn btn-secondary" onClick={() => setLimit(limit + 30)}><Bi as="span" t={{ en: `Show more (${shown.length - limit} left)`, hi: `और दिखाएँ (${shown.length - limit} बाक़ी)` }} /></button>}
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
        <Bi as="span" className="chip surface-2" t={catLabel(m.category)} />
        <span className="text-muted"><Bi as="span" t={sourceLabel(m.source)} />{link && <> · <Link href={link} className="underline"><Bi as="span" t={{ en: "open", hi: "खोलें" }} /></Link></>}</span>
        {m.occurrences > 1 && <Bi as="span" className="chip bg-saffron-100 text-saffron-700" t={{ en: `seen ${m.occurrences}×`, hi: `${m.occurrences} बार` }} />}
        {m.resolved && <Bi as="span" className="chip bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" t={{ en: "resolved", hi: "सुलझी" }} />}
      </div>
      <p className="text-sm"><span className="text-red-700 line-through decoration-1 dark:text-red-300" lang="fr">{m.original}</span> → <span className="font-medium" lang="fr">{m.corrected}</span></p>
      <Bi className="text-sm" t={m.explanation} />
      <div className="flex flex-wrap gap-2">
        {m.drill && !m.resolved && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Bi as="span" t={open ? { en: "Hide drill", hi: "अभ्यास छिपाएँ" } : { en: "Practise", hi: "अभ्यास करें" }} /></button>}
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={toggle}><Bi as="span" t={m.resolved ? { en: "Reopen", hi: "फिर से खोलें" } : { en: "Mark resolved", hi: "सुलझी हुई चिह्नित करें" }} /></button>
        <button type="button" className="btn btn-sm text-muted underline" disabled={busy} onClick={del}><Bi as="span" t={{ en: "Remove", hi: "हटाएँ" }} /></button>
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
      <button type="button" className="btn btn-primary btn-sm" disabled={!val.trim()} onClick={check}><Bi as="span" t={{ en: "Check", hi: "उत्तर जाँचें" }} /></button>
      {res && <ResultLine r={res} />}
      {res?.result === "correct" && <Bi className="text-xs text-muted" t={{ en: "Marked resolved. It comes back if you make the same error again.", hi: "सुलझी हुई चिह्नित कर दी गई। वही ग़लती दोबारा करने पर यह फिर लौट आएगी।" }} />}
    </div>
  );
}

function DrillSession({ queue, onDone, onUpdate }: { queue: M[]; onDone: () => void; onUpdate: (m: M) => void }) {
  const [i, setI] = useState(0);
  const m = queue[i];
  if (!m) return (
    <div className="card space-y-2"><Bi className="font-semibold" t={{ en: "Drill finished.", hi: "अभ्यास पूरा हुआ।" }} /><button type="button" className="btn btn-primary" onClick={onDone}><Bi as="span" t={{ en: "Back to the notebook", hi: "कॉपी पर वापस जाएँ" }} /></button></div>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted"><Bi as="span" t={{ en: `Drill ${i + 1} of ${queue.length}`, hi: `अभ्यास ${i + 1} / ${queue.length}` }} /> · <Bi as="span" t={catLabel(m.category)} /></p>
      <details className="text-sm"><summary className="cursor-pointer"><Bi as="span" t={{ en: "Show the original mistake", hi: "असली ग़लती देखें" }} /></summary><p className="mt-1"><span lang="fr" className="line-through">{m.original}</span> → <span lang="fr">{m.corrected}</span></p><Bi t={m.explanation} /></details>
      <Drill key={m.id} m={m} autoFocus onResolved={() => onUpdate({ ...m, resolved: true })} />
      <div className="flex gap-2"><button type="button" className="btn btn-secondary" onClick={() => setI(i + 1)}><Bi as="span" t={{ en: "Next →", hi: "आगे →" }} /></button><button type="button" className="btn btn-sm underline" onClick={onDone}><Bi as="span" t={{ en: "Stop", hi: "रोकें" }} /></button></div>
    </div>
  );
}
