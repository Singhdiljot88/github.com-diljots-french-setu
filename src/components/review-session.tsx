"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { checkAnswer, type AnswerCheck } from "@/lib/text";
import { previewIntervals, suggestRating, type Rating, type SrsCard } from "@/lib/srs";
import { Speak, usePlayer } from "./audio";
import { AccentBar } from "./accent-bar";
import { ResultLine } from "./exercises";

type Kind = "fr_to_meaning" | "meaning_to_fr" | "audio" | "gender" | "dictation" | "cloze";
type QCard = {
  card: { id: string; kind: Kind; state: string; dueAt: string; intervalDays: number };
  word: { id: string; fr: string; en: string; hi: string; gender: string | null; isPhrase: boolean };
  example: { fr: string; en?: string; hi?: string; cloze?: string; answer?: string } | null;
  preview: Record<Rating, string>;
};
type Queue = { cards: QCard[]; dueTotal: number; overdueCapped: boolean; newWaiting: number; newLimitRemaining: number };

const KIND_LABEL: Record<Kind, string> = { fr_to_meaning: "French → meaning", meaning_to_fr: "Meaning → French", audio: "Listen → word", gender: "Gender", dictation: "Dictation", cloze: "Fill the gap" };
const RATINGS: { r: Rating; label: string; hi: string; cls: string }[] = [
  { r: "again", label: "Again", hi: "फिर से", cls: "border-red-400" },
  { r: "hard", label: "Hard", hi: "मुश्किल", cls: "border-amber-400" },
  { r: "good", label: "Good", hi: "ठीक", cls: "border-brand-500" },
  { r: "easy", label: "Easy", hi: "आसान", cls: "border-sky-400" },
];
const REQUEUE_WITHIN_MS = 30 * 60_000;

const bare = (fr: string) => fr.replace(/^(le|la|les|un|une)\s+|^l['’]/i, "");

export function ReviewSession() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [cards, setCards] = useState<QCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState({ count: 0, again: 0 });
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const q = await api<Queue>("/api/review/queue");
      setQueue(q); setCards(q.cards); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);

  const ready = cards.filter((c) => new Date(c.card.dueAt).getTime() <= now);
  const current = ready[0] ?? null;
  const waiting = cards.filter((c) => new Date(c.card.dueAt).getTime() > now).sort((a, b) => +new Date(a.card.dueAt) - +new Date(b.card.dueAt));

  const rate = async (c: QCard, rating: Rating, answer?: string) => {
    const r = await api<{ next: Omit<SrsCard, "dueAt"> & { dueAt: string } }>("/api/review/rate", { body: { cardId: c.card.id, rating, answer, kind: c.card.kind } });
    setDone((d) => ({ count: d.count + 1, again: d.again + (rating === "again" ? 1 : 0) }));
    const due = new Date(r.next.dueAt);
    setCards((cs) => {
      const rest = cs.filter((x) => x.card.id !== c.card.id);
      // learning steps (1 min, 10 min) come back in this session
      if (due.getTime() - Date.now() < REQUEUE_WITHIN_MS) {
        rest.push({ ...c, card: { ...c.card, state: r.next.state, dueAt: r.next.dueAt, intervalDays: r.next.intervalDays }, preview: previewIntervals({ ...r.next, dueAt: due }, new Date()) });
      }
      return rest;
    });
    setNow(Date.now());
  };

  if (error) return <div className="card" role="alert">Could not load your review: {error} <button className="btn btn-secondary btn-sm ml-2" onClick={load}>Retry</button></div>;
  if (!queue) return <p className="text-muted">Loading your cards…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm text-muted" aria-live="polite">
        <span className="chip">{cards.length} left</span>
        <span className="chip">{done.count} reviewed</span>
        {queue.overdueCapped && <span className="chip" title="Today's limit for your daily time">Showing today&apos;s limit of overdue cards; the rest stay for tomorrow</span>}
      </div>
      {current ? (
        <CardView key={`${current.card.id}:${current.card.dueAt}`} c={current} onRate={(r, a) => rate(current, r, a)} />
      ) : waiting.length ? (
        <div className="card space-y-2">
          <p className="font-medium">Nice. {waiting.length} card{waiting.length > 1 ? "s" : ""} in learning will come back shortly.</p>
          <p className="text-sm text-muted">Next one at {new Date(waiting[0].card.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. You can wait here or come back later today.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => setNow(new Date(waiting[0].card.dueAt).getTime())}>Show it now</button>
        </div>
      ) : (
        <div className="card space-y-2">
          <p className="text-lg font-semibold">{done.count ? "Review done for today 🎉" : "Nothing to review right now."}</p>
          {done.count > 0 && <p className="text-sm text-muted">{done.count} cards reviewed, {done.again} marked Again.</p>}
          {queue.newWaiting > 0 && queue.newLimitRemaining === 0 && <p className="text-sm text-muted">{queue.newWaiting} new cards are waiting. Today&apos;s new-card limit is reached, so they start tomorrow.</p>}
          {queue.newWaiting === 0 && done.count === 0 && <p className="text-sm text-muted">Words from your lessons and words you save in the dictionary appear here.</p>}
          <div className="flex gap-2"><Link className="btn btn-primary" href="/today">Back to today</Link><Link className="btn btn-secondary" href="/words">My words</Link></div>
        </div>
      )}
    </div>
  );
}

function CardView({ c, onRate }: { c: QCard; onRate: (r: Rating, answer?: string) => Promise<void> }) {
  const { kind } = c.card;
  const w = c.word;
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState("");
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [suggested, setSuggested] = useState<Rating | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const { play } = usePlayer();
  const typed = kind === "meaning_to_fr" || kind === "audio" || kind === "dictation" || (kind === "cloze" && !!c.example?.cloze);
  const cloze = kind === "cloze" && c.example?.cloze ? c.example : null;
  const expected = kind === "cloze" ? cloze?.answer ?? w.fr : kind === "audio" ? bare(w.fr) : w.fr;
  const gender = w.gender === "m" || w.gender === "f" ? w.gender : null;
  const listenFirst = kind === "audio" || kind === "dictation";

  useEffect(() => { if (listenFirst) play([{ text: w.fr }]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const accept = kind === "audio" ? [w.fr] : kind === "meaning_to_fr" ? [bare(w.fr)] : [];
    const r = checkAnswer(input, expected, accept);
    setCheck(r); setRevealed(true); setSuggested(suggestRating(r.result, (Date.now() - started.current) / 1000));
  };
  const chooseGender = (g: "m" | "f") => {
    const ok = g === gender;
    setCheck({ result: ok ? "correct" : "wrong", expected: `${gender === "m" ? "le / un" : "la / une"} ${bare(w.fr)}` });
    setRevealed(true); setSuggested(ok ? "good" : "again");
  };
  const doRate = async (r: Rating) => { if (busy) return; setBusy(true); try { await onRate(r, input || undefined); } finally { setBusy(false); } };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!revealed || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const i = ["1", "2", "3", "4"].indexOf(e.key);
      if (i >= 0) doRate(RATINGS[i].r);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const meaning = (
    <div>
      <p><span className="text-xs text-muted">English: </span>{w.en}</p>
      {w.hi && <p><span className="text-xs text-muted">Hindi meaning: </span><span lang="hi" className="deva">{w.hi}</span></p>}
    </div>
  );

  return (
    <section className="card space-y-4" aria-label={`Review card: ${KIND_LABEL[kind]}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{KIND_LABEL[kind]}{c.card.state === "new" ? " · new" : ""}</p>

      {/* Prompt */}
      {kind === "fr_to_meaning" && <p className="flex items-center gap-2 text-3xl font-semibold" lang="fr">{w.fr}<Speak text={w.fr} /></p>}
      {kind === "meaning_to_fr" && <div className="text-lg">{meaning}{gender && <p className="text-xs text-muted">Noun · include the article if you know it</p>}</div>}
      {listenFirst && <div className="flex items-center gap-2"><Speak text={w.fr} size="md" label="the word" /><span className="text-sm text-muted">Type what you hear.</span></div>}
      {kind === "gender" && <p className="text-3xl font-semibold" lang="fr">{bare(w.fr)}</p>}
      {kind === "cloze" && (cloze
        ? <div><p className="text-xl" lang="fr">{cloze.cloze}</p>{(cloze.en || cloze.hi) && <p className="text-sm text-muted">{cloze.en}{cloze.hi && <> · <span lang="hi" className="deva">{cloze.hi}</span></>}</p>}<p className="mt-1 text-xs text-muted">Hint: {w.en}</p></div>
        : <div><p className="text-sm text-muted">No example sentence yet for this word. Recall it from its meaning:</p>{meaning}</div>)}

      {/* Answer */}
      {kind === "gender" && !revealed && (
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => chooseGender("m")} disabled={!gender}>le / un</button>
          <button className="btn btn-secondary flex-1" onClick={() => chooseGender("f")} disabled={!gender}>la / une</button>
        </div>
      )}
      {typed && !revealed && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor="rv-in" className="sr-only">Your answer in French</label>
          <input id="rv-in" className="input text-lg" lang="fr" value={input} onChange={(e) => setInput(e.target.value)} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Type in French" />
          <AccentBar targetId="rv-in" />
          <div className="flex gap-2"><button className="btn btn-primary">Check</button><button type="button" className="btn btn-ghost" onClick={() => { setRevealed(true); setSuggested("again"); }}>I don&apos;t know</button></div>
        </form>
      )}
      {!typed && kind !== "gender" && !revealed && <button className="btn btn-primary w-full" onClick={() => setRevealed(true)} autoFocus>Show answer</button>}

      {revealed && (
        <div className="space-y-3 border-t border-app pt-3">
          {check && <ResultLine r={check} />}
          <div className="flex items-center gap-2"><span className="text-xl font-semibold" lang="fr">{w.fr}</span><Speak text={w.fr} /></div>
          {kind !== "meaning_to_fr" && meaning}
          {c.example && kind !== "cloze" && <p className="text-sm" lang="fr">{c.example.fr}</p>}
          <div>
            <p className="mb-1 text-sm text-muted">{suggested ? "Suggested rating is highlighted. You decide." : "How well did you know it?"}</p>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Rate this card">
              {RATINGS.map((x, i) => (
                <button key={x.r} type="button" disabled={busy} onClick={() => doRate(x.r)}
                  className={`btn flex-col gap-0 border-2 px-1 py-2 ${x.cls} ${suggested === x.r ? "ring-2 ring-offset-2 ring-[var(--focus)]" : ""}`}
                  aria-label={`${x.label}, next review in ${c.preview[x.r]} (key ${i + 1})`}>
                  <span className="font-semibold">{x.label}</span>
                  <span className="deva text-xs" lang="hi">{x.hi}</span>
                  <span className="text-xs text-muted">{c.preview[x.r]}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 hidden text-xs text-muted sm:block">Keys 1–4 also rate.</p>
          </div>
        </div>
      )}
    </section>
  );
}
