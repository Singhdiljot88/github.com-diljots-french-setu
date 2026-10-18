"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { searchKey } from "@/lib/text";
import { Speak } from "./audio";
import { AccentBar } from "./accent-bar";

type Word = { id: string; fr: string; en: string; hi: string; gender: string | null; isPhrase: boolean; entryId: string | null; source: string; sourceRef: string | null; personalExample: string | null; createdAt: string };
type Card = { id: string; kind: Kind; state: string; intervalDays: number; dueAt: string; reps: number; lapses: number };
type Log = { id: string; cardId: string; rating: string; reviewedAt: string; nextIntervalDays: number };
type Kind = "fr_to_meaning" | "meaning_to_fr" | "audio" | "gender" | "dictation" | "cloze";
const KINDS: { k: Kind; label: string }[] = [
  { k: "fr_to_meaning", label: "French → meaning" }, { k: "meaning_to_fr", label: "Meaning → French" }, { k: "audio", label: "Listen → word" },
  { k: "gender", label: "Gender (le/la)" }, { k: "dictation", label: "Dictation" }, { k: "cloze", label: "Fill the gap" },
];
const SOURCE: Record<string, string> = { lesson: "Lesson", dictionary: "Dictionary", web: "Web", custom: "Added by you", mistake: "Mistake" };
const STATE: Record<string, string> = { new: "New", learning: "Learning", relearning: "Relearning", review: "In review" };

export function MyWords({ addInitial }: { addInitial: string }) {
  const [words, setWords] = useState<Word[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { try { setWords((await api<{ words: Word[] }>("/api/words")).words); } catch (e) { setError((e as Error).message); } };
  useEffect(() => { load(); }, []);
  const shown = useMemo(() => {
    if (!words) return [];
    const k = searchKey(q);
    return k ? words.filter((w) => searchKey(`${w.fr} ${w.en}`).includes(k) || w.hi.includes(q.trim())) : words;
  }, [words, q]);

  return (
    <div className="space-y-4">
      <AddWord initial={addInitial} onAdded={load} />
      {error && <p role="alert" className="card">{error}</p>}
      {words && words.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="mw-q" className="sr-only">Filter my words</label>
          <input id="mw-q" type="search" className="input max-w-xs" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-sm text-muted">{shown.length} of {words.length}</span>
          <Link href="/review" className="btn btn-primary btn-sm ml-auto">Review now</Link>
        </div>
      )}
      {words === null && !error && <p className="text-muted">Loading…</p>}
      {words?.length === 0 && <p className="card text-muted">No saved words yet. Tap “＋ Save” next to any word in a lesson or the dictionary.</p>}
      <ul className="space-y-2">
        {shown.map((w) => (
          <li key={w.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold" lang="fr">{w.fr}</span>
              <Speak text={w.fr} showSlow={false} />
              <span className="text-sm">{w.en}</span>
              {w.hi && <span className="deva text-sm text-muted" lang="hi">{w.hi}</span>}
              <span className="chip ml-auto text-xs">{SOURCE[w.source] ?? w.source}{w.sourceRef?.startsWith("day:") ? ` · Day ${w.sourceRef.split(":")[1]}` : ""}</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open === w.id} onClick={() => setOpen(open === w.id ? null : w.id)}>{open === w.id ? "Close" : "Details"}</button>
            </div>
            {w.personalExample && open !== w.id && <p className="mt-1 text-sm italic" lang="fr">“{w.personalExample}”</p>}
            {open === w.id && <WordDetails w={w} onChange={load} onDeleted={() => { setOpen(null); load(); }} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddWord({ initial, onAdded }: { initial: string; onAdded: () => void }) {
  const [show, setShow] = useState(!!initial);
  const [fr, setFr] = useState(initial);
  const [en, setEn] = useState("");
  const [hi, setHi] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (!show) return <button type="button" className="btn btn-secondary" onClick={() => setShow(true)}>＋ Add a word of your own</button>;
  return (
    <form className="card space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      try {
        const r = await api<{ created: boolean }>("/api/words", { body: { fr, en, hi: hi || undefined, source: "custom", isPhrase: fr.trim().includes(" ") } });
        setMsg(r.created ? `Saved “${fr}”. It will appear in review.` : `“${fr}” is already in your words.`);
        setFr(""); setEn(""); setHi(""); onAdded();
      } catch (err) { setMsg((err as Error).message); }
    }}>
      <h2 className="font-semibold">Add a word</h2>
      <p className="text-xs text-muted">Words you add yourself are not checked. Look them up in the <Link className="underline" href="/dictionary">dictionary</Link> first if you can.</p>
      <label className="block text-sm">French<input id="aw-fr" className="input mt-1" lang="fr" value={fr} onChange={(e) => setFr(e.target.value)} required maxLength={200} /></label>
      <AccentBar targetId="aw-fr" />
      <label className="block text-sm">English meaning<input className="input mt-1" value={en} onChange={(e) => setEn(e.target.value)} required maxLength={300} /></label>
      <label className="block text-sm">Hindi meaning (optional)<input className="input mt-1 deva" lang="hi" value={hi} onChange={(e) => setHi(e.target.value)} maxLength={300} /></label>
      <div className="flex gap-2"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>Cancel</button></div>
      {msg && <p className="text-sm" aria-live="polite">{msg}</p>}
    </form>
  );
}

function WordDetails({ w, onChange, onDeleted }: { w: Word; onChange: () => void; onDeleted: () => void }) {
  const [h, setH] = useState<{ cards: Card[]; logs: Log[] } | null>(null);
  const [ex, setEx] = useState(w.personalExample ?? "");
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const load = async () => setH(await api<{ cards: Card[]; logs: Log[] }>(`/api/words/${w.id}`));
  useEffect(() => { load(); }, [w.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const exId = `ex-${w.id}`;
  return (
    <div className="mt-3 space-y-4 border-t border-app pt-3 text-sm">
      {w.entryId && <Link className="underline" href={`/dictionary/${encodeURIComponent(w.entryId)}`}>Open dictionary entry →</Link>}
      <form className="space-y-1" onSubmit={async (e) => { e.preventDefault(); await api(`/api/words/${w.id}`, { method: "PATCH", body: { personalExample: ex.trim() || null } }); setSaved(true); onChange(); }}>
        <label htmlFor={exId} className="font-medium">My example sentence</label>
        <textarea id={exId} className="input" lang="fr" rows={2} maxLength={500} value={ex} onChange={(e) => { setEx(e.target.value); setSaved(false); }} placeholder={`Write a sentence of your own with “${w.fr}”`} />
        <AccentBar targetId={exId} />
        <div className="flex items-center gap-2"><button className="btn btn-secondary btn-sm">Save example</button>{saved && <span aria-live="polite">✓ Saved. Fill-the-gap cards will use it.</span>}</div>
      </form>
      <div>
        <p className="font-medium">Flashcards</p>
        {!h ? <p className="text-muted">Loading…</p> : (
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {KINDS.filter((k) => k.k !== "gender" || w.gender === "m" || w.gender === "f").map((k) => {
              const c = h.cards.find((x) => x.kind === k.k);
              return (
                <li key={k.k} className="flex items-center justify-between rounded-lg surface-2 px-2 py-1">
                  <span>{k.label}</span>
                  {c ? <span className="text-xs text-muted">{STATE[c.state]}{c.state !== "new" ? ` · next ${new Date(c.dueAt).toLocaleDateString()}` : ""}</span>
                    : <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await api(`/api/words/${w.id}`, { method: "PATCH", body: { addKinds: [k.k] } }); load(); }}>＋ Add</button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {h && (
        <div>
          <p className="font-medium">History</p>
          <p className="text-muted">Saved {new Date(w.createdAt).toLocaleDateString()} · {h.logs.length} review{h.logs.length === 1 ? "" : "s"}{h.cards.some((c) => c.lapses) ? ` · forgotten ${h.cards.reduce((s, c) => s + c.lapses, 0)}×` : ""}</p>
          {h.logs.length > 0 && (
            <ol className="mt-1 max-h-40 overflow-auto text-xs">
              {h.logs.slice().reverse().map((l) => (
                <li key={l.id}>{new Date(l.reviewedAt).toLocaleString()} · {KINDS.find((k) => k.k === h.cards.find((c) => c.id === l.cardId)?.kind)?.label} · <strong>{l.rating}</strong> · next in {l.nextIntervalDays >= 1 ? `${Math.round(l.nextIntervalDays)} d` : "minutes"}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      <div>
        {!confirmDel ? <button type="button" className="btn btn-ghost btn-sm text-red-700 dark:text-red-300" onClick={() => setConfirmDel(true)}>Remove word</button> : (
          <span className="flex items-center gap-2">Remove “{w.fr}” and its review history?
            <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await api(`/api/words/${w.id}`, { method: "DELETE" }); onDeleted(); }}>Remove</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>Keep</button>
          </span>
        )}
      </div>
    </div>
  );
}
