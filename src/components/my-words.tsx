"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { searchKey } from "@/lib/text";
import { Speak } from "./audio";
import { AccentBar } from "./accent-bar";
import { Bi, useBiLabel } from "./bi";

type Word = { id: string; fr: string; en: string; hi: string; gender: string | null; isPhrase: boolean; entryId: string | null; source: string; sourceRef: string | null; personalExample: string | null; createdAt: string };
type Card = { id: string; kind: Kind; state: string; intervalDays: number; dueAt: string; reps: number; lapses: number };
type Log = { id: string; cardId: string; rating: string; reviewedAt: string; nextIntervalDays: number };
type Kind = "fr_to_meaning" | "meaning_to_fr" | "audio" | "gender" | "dictation" | "cloze";
type T = { en: string; hi: string };
const KINDS: { k: Kind; label: T }[] = [
  { k: "fr_to_meaning", label: { en: "French → meaning", hi: "फ़्रेंच → अर्थ" } }, { k: "meaning_to_fr", label: { en: "Meaning → French", hi: "अर्थ → फ़्रेंच" } }, { k: "audio", label: { en: "Listen → word", hi: "सुनें → शब्द" } },
  { k: "gender", label: { en: "Gender (le/la)", hi: "लिंग (le/la)" } }, { k: "dictation", label: { en: "Dictation", hi: "श्रुतलेख" } }, { k: "cloze", label: { en: "Fill the gap", hi: "खाली जगह भरें" } },
];
const SOURCE: Record<string, T> = { lesson: { en: "Lesson", hi: "पाठ" }, dictionary: { en: "Dictionary", hi: "शब्दकोश" }, web: { en: "Web", hi: "वेब" }, custom: { en: "Added by you", hi: "आपने जोड़ा" }, mistake: { en: "Mistake", hi: "ग़लती" } };
const STATE: Record<string, T> = { new: { en: "New", hi: "नया" }, learning: { en: "Learning", hi: "सीखा जा रहा है" }, relearning: { en: "Relearning", hi: "फिर से सीखा जा रहा है" }, review: { en: "In review", hi: "दोहराव में" } };
const RATING: Record<string, T> = { again: { en: "again", hi: "फिर से" }, hard: { en: "hard", hi: "मुश्किल" }, good: { en: "good", hi: "ठीक" }, easy: { en: "easy", hi: "आसान" } };

export function MyWords({ addInitial }: { addInitial: string }) {
  const [words, setWords] = useState<Word[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const L = useBiLabel();
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
          <label htmlFor="mw-q" className="sr-only">{L({ en: "Filter my words", hi: "मेरे शब्द छाँटें" })}</label>
          <input id="mw-q" type="search" className="input max-w-xs" placeholder={L({ en: "Filter…", hi: "छाँटें…" })} value={q} onChange={(e) => setQ(e.target.value)} />
          <Bi as="span" className="text-sm text-muted" t={{ en: `${shown.length} of ${words.length}`, hi: `${words.length} में से ${shown.length}` }} />
          <Link href="/review" className="btn btn-primary btn-sm ml-auto"><Bi as="span" t={{ en: "Review now", hi: "अभी दोहराएँ" }} /></Link>
        </div>
      )}
      {words === null && !error && <Bi className="text-muted" t={{ en: "Loading…", hi: "लोड हो रहा है…" }} />}
      {words?.length === 0 && <Bi className="card text-muted" t={{ en: "No saved words yet. Tap “＋ Save” next to any word in a lesson or the dictionary.", hi: "अभी कोई सहेजा हुआ शब्द नहीं है। किसी पाठ या शब्दकोश में किसी भी शब्द के पास “＋ सहेजें” पर टैप करें।" }} />}
      <ul className="space-y-2">
        {shown.map((w) => (
          <li key={w.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold" lang="fr">{w.fr}</span>
              <Speak text={w.fr} showSlow={false} />
              <span className="text-sm">{w.en}</span>
              {w.hi && <span className="deva text-sm text-muted" lang="hi">{w.hi}</span>}
              <span className="chip ml-auto text-xs">{SOURCE[w.source] ? L(SOURCE[w.source]) : w.source}{w.sourceRef?.startsWith("day:") ? ` · ${L({ en: "Day", hi: "दिन" })} ${w.sourceRef.split(":")[1]}` : ""}</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open === w.id} onClick={() => setOpen(open === w.id ? null : w.id)}><Bi as="span" t={open === w.id ? { en: "Close", hi: "बंद करें" } : { en: "Details", hi: "विवरण" }} /></button>
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
  const L = useBiLabel();
  if (!show) return <button type="button" className="btn btn-secondary" onClick={() => setShow(true)}><Bi as="span" t={{ en: "＋ Add a word of your own", hi: "＋ अपना कोई शब्द जोड़ें" }} /></button>;
  return (
    <form className="card space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      try {
        const r = await api<{ created: boolean }>("/api/words", { body: { fr, en, hi: hi || undefined, source: "custom", isPhrase: fr.trim().includes(" ") } });
        setMsg(r.created ? L({ en: `Saved “${fr}”. It will appear in review.`, hi: `“${fr}” सहेजा गया। यह दोहराव में दिखेगा।` }) : L({ en: `“${fr}” is already in your words.`, hi: `“${fr}” पहले से आपके शब्दों में है।` }));
        setFr(""); setEn(""); setHi(""); onAdded();
      } catch (err) { setMsg((err as Error).message); }
    }}>
      <h2 className="font-semibold"><Bi as="span" t={{ en: "Add a word", hi: "शब्द जोड़ें" }} /></h2>
      <p className="text-xs text-muted"><Bi as="span" t={{ en: "Words you add yourself are not checked. If you can, look them up in the dictionary first.", hi: "आपके ख़ुद जोड़े गए शब्द जाँचे नहीं जाते। हो सके तो पहले उन्हें शब्दकोश में देख लें।" }} /> <Link className="underline" href="/dictionary"><Bi as="span" t={{ en: "Open the dictionary", hi: "शब्दकोश खोलें" }} /></Link></p>
      <label className="block text-sm">{L({ en: "French", hi: "फ़्रेंच" })}<input id="aw-fr" className="input mt-1" lang="fr" value={fr} onChange={(e) => setFr(e.target.value)} required maxLength={200} /></label>
      <AccentBar targetId="aw-fr" />
      <label className="block text-sm">{L({ en: "English meaning", hi: "अंग्रेज़ी अर्थ" })}<input className="input mt-1" value={en} onChange={(e) => setEn(e.target.value)} required maxLength={300} /></label>
      <label className="block text-sm">{L({ en: "Hindi meaning (optional)", hi: "हिंदी अर्थ (वैकल्पिक)" })}<input className="input mt-1 deva" lang="hi" value={hi} onChange={(e) => setHi(e.target.value)} maxLength={300} /></label>
      <div className="flex gap-2"><button className="btn btn-primary"><Bi as="span" t={{ en: "Save", hi: "सहेजें" }} /></button><button type="button" className="btn btn-ghost" onClick={() => setShow(false)}><Bi as="span" t={{ en: "Cancel", hi: "रद्द करें" }} /></button></div>
      {msg && <p className="text-sm" aria-live="polite">{msg}</p>}
    </form>
  );
}

function WordDetails({ w, onChange, onDeleted }: { w: Word; onChange: () => void; onDeleted: () => void }) {
  const [h, setH] = useState<{ cards: Card[]; logs: Log[] } | null>(null);
  const [ex, setEx] = useState(w.personalExample ?? "");
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const L = useBiLabel();
  const load = async () => setH(await api<{ cards: Card[]; logs: Log[] }>(`/api/words/${w.id}`));
  useEffect(() => { load(); }, [w.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const exId = `ex-${w.id}`;
  return (
    <div className="mt-3 space-y-4 border-t border-app pt-3 text-sm">
      {w.entryId && <Link className="underline" href={`/dictionary/${encodeURIComponent(w.entryId)}`}><Bi as="span" t={{ en: "Open dictionary entry →", hi: "शब्दकोश में देखें →" }} /></Link>}
      <form className="space-y-1" onSubmit={async (e) => { e.preventDefault(); await api(`/api/words/${w.id}`, { method: "PATCH", body: { personalExample: ex.trim() || null } }); setSaved(true); onChange(); }}>
        <label htmlFor={exId} className="font-medium">{L({ en: "My example sentence", hi: "मेरा उदाहरण वाक्य" })}</label>
        <textarea id={exId} className="input" lang="fr" rows={2} maxLength={500} value={ex} onChange={(e) => { setEx(e.target.value); setSaved(false); }} placeholder={L({ en: `Write a sentence of your own with “${w.fr}”`, hi: `“${w.fr}” के साथ अपना एक वाक्य लिखें` })} />
        <AccentBar targetId={exId} />
        <div className="flex items-center gap-2"><button className="btn btn-secondary btn-sm"><Bi as="span" t={{ en: "Save example", hi: "उदाहरण सहेजें" }} /></button>{saved && <span aria-live="polite"><Bi as="span" t={{ en: "✓ Saved. Fill-the-gap cards will use it.", hi: "✓ सहेजा गया। खाली जगह भरने वाले कार्ड इसका इस्तेमाल करेंगे।" }} /></span>}</div>
      </form>
      <div>
        <Bi className="font-medium" t={{ en: "Flashcards", hi: "फ़्लैशकार्ड" }} />
        {!h ? <Bi className="text-muted" t={{ en: "Loading…", hi: "लोड हो रहा है…" }} /> : (
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {KINDS.filter((k) => k.k !== "gender" || w.gender === "m" || w.gender === "f").map((k) => {
              const c = h.cards.find((x) => x.kind === k.k);
              return (
                <li key={k.k} className="flex items-center justify-between rounded-lg surface-2 px-2 py-1">
                  <Bi as="span" t={k.label} />
                  {c ? <span className="text-xs text-muted">{STATE[c.state] ? L(STATE[c.state]) : c.state}{c.state !== "new" ? ` · ${L({ en: "next", hi: "अगला" })} ${new Date(c.dueAt).toLocaleDateString()}` : ""}</span>
                    : <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await api(`/api/words/${w.id}`, { method: "PATCH", body: { addKinds: [k.k] } }); load(); }}><Bi as="span" t={{ en: "＋ Add", hi: "＋ जोड़ें" }} /></button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {h && (
        <div>
          <Bi className="font-medium" t={{ en: "History", hi: "इतिहास" }} />
          <Bi className="text-muted" t={{
            en: `Saved ${new Date(w.createdAt).toLocaleDateString()} · ${h.logs.length} review${h.logs.length === 1 ? "" : "s"}${h.cards.some((c) => c.lapses) ? ` · forgotten ${h.cards.reduce((s, c) => s + c.lapses, 0)}×` : ""}`,
            hi: `${new Date(w.createdAt).toLocaleDateString()} को सहेजा · ${h.logs.length} बार दोहराया${h.cards.some((c) => c.lapses) ? ` · ${h.cards.reduce((s, c) => s + c.lapses, 0)} बार भूले` : ""}`,
          }} />
          {h.logs.length > 0 && (
            <ol className="mt-1 max-h-40 overflow-auto text-xs">
              {h.logs.slice().reverse().map((l) => (
                <li key={l.id}>{new Date(l.reviewedAt).toLocaleString()} · {(() => { const k = KINDS.find((x) => x.k === h.cards.find((c) => c.id === l.cardId)?.kind); return k ? L(k.label) : ""; })()} · <strong>{RATING[l.rating] ? L(RATING[l.rating]) : l.rating}</strong> · {L(l.nextIntervalDays >= 1 ? { en: `next in ${Math.round(l.nextIntervalDays)} d`, hi: `अगला ${Math.round(l.nextIntervalDays)} दिन में` } : { en: "next in minutes", hi: "अगला कुछ मिनट में" })}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      <div>
        {!confirmDel ? <button type="button" className="btn btn-ghost btn-sm text-red-700 dark:text-red-300" onClick={() => setConfirmDel(true)}><Bi as="span" t={{ en: "Remove word", hi: "शब्द हटाएँ" }} /></button> : (
          <span className="flex items-center gap-2"><Bi as="span" t={{ en: `Remove “${w.fr}” and its review history?`, hi: `“${w.fr}” और इसके दोहराव का इतिहास हटाएँ?` }} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await api(`/api/words/${w.id}`, { method: "DELETE" }); onDeleted(); }}><Bi as="span" t={{ en: "Remove", hi: "हटाएँ" }} /></button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}><Bi as="span" t={{ en: "Keep", hi: "रहने दें" }} /></button>
          </span>
        )}
      </div>
    </div>
  );
}
