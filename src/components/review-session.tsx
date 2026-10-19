"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { checkAnswer, type AnswerCheck } from "@/lib/text";
import { previewIntervals, suggestRating, type Rating, type SrsCard } from "@/lib/srs";
import { Speak, usePlayer } from "./audio";
import { AccentBar } from "./accent-bar";
import { ResultLine } from "./exercises";
import { Bi, useBiLabel } from "./bi";
import { usePrefs } from "./prefs";

type Kind = "fr_to_meaning" | "meaning_to_fr" | "audio" | "gender" | "dictation" | "cloze";
type QCard = {
  card: { id: string; kind: Kind; state: string; dueAt: string; intervalDays: number };
  word: { id: string; fr: string; en: string; hi: string; gender: string | null; isPhrase: boolean };
  example: { fr: string; en?: string; hi?: string; cloze?: string; answer?: string } | null;
  preview: Record<Rating, string>;
};
type Queue = { cards: QCard[]; dueTotal: number; overdueCapped: boolean; newWaiting: number; newLimitRemaining: number };

const KIND_LABEL: Record<Kind, { en: string; hi: string }> = {
  fr_to_meaning: { en: "French → meaning", hi: "फ़्रेंच → अर्थ" }, meaning_to_fr: { en: "Meaning → French", hi: "अर्थ → फ़्रेंच" }, audio: { en: "Listen → word", hi: "सुनें → शब्द" },
  gender: { en: "Gender", hi: "लिंग" }, dictation: { en: "Dictation", hi: "श्रुतलेख" }, cloze: { en: "Fill the gap", hi: "खाली जगह भरें" },
};
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
  const L = useBiLabel();

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

  if (error) return <div className="card" role="alert"><Bi as="span" t={{ en: "Could not load your review:", hi: "आपका दोहराव लोड नहीं हो सका:" }} /> {error} <button className="btn btn-secondary btn-sm ml-2" onClick={load}><Bi as="span" t={{ en: "Retry", hi: "फिर से कोशिश करें" }} /></button></div>;
  if (!queue) return <Bi className="text-muted" t={{ en: "Loading your cards…", hi: "आपके कार्ड लोड हो रहे हैं…" }} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm text-muted" aria-live="polite">
        <Bi as="span" className="chip" t={{ en: `${cards.length} left`, hi: `${cards.length} बाक़ी` }} />
        <Bi as="span" className="chip" t={{ en: `${done.count} reviewed`, hi: `${done.count} दोहराए गए` }} />
        {queue.overdueCapped && <span className="chip" title={L({ en: "Today's limit for your daily time", hi: "आपके रोज़ के समय के हिसाब से आज की सीमा" })}><Bi as="span" t={{ en: "Showing today's limit of overdue cards; the rest stay for tomorrow", hi: "बकाया कार्ड आज की सीमा तक दिखाए जा रहे हैं; बाक़ी कल के लिए रहेंगे" }} /></span>}
      </div>
      {current ? (
        <CardView key={`${current.card.id}:${current.card.dueAt}`} c={current} onRate={(r, a) => rate(current, r, a)} />
      ) : waiting.length ? (
        <div className="card space-y-2">
          <Bi className="font-medium" t={{ en: `Nice. ${waiting.length} card${waiting.length > 1 ? "s" : ""} in learning will come back shortly.`, hi: `बढ़िया। सीखे जा रहे ${waiting.length} कार्ड थोड़ी देर में वापस आएँगे।` }} />
          <Bi className="text-sm text-muted" t={{
            en: `Next one at ${new Date(waiting[0].card.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. You can wait here or come back later today.`,
            hi: `अगला कार्ड ${new Date(waiting[0].card.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} पर। आप यहीं रुक सकते हैं या आज बाद में लौट सकते हैं।`,
          }} />
          <button className="btn btn-secondary btn-sm" onClick={() => setNow(new Date(waiting[0].card.dueAt).getTime())}><Bi as="span" t={{ en: "Show it now", hi: "अभी दिखाएँ" }} /></button>
        </div>
      ) : (
        <div className="card space-y-2">
          <Bi className="text-lg font-semibold" t={done.count ? { en: "Review done for today 🎉", hi: "आज का दोहराव पूरा 🎉" } : { en: "Nothing to review right now.", hi: "अभी दोहराने के लिए कुछ नहीं है।" }} />
          {done.count > 0 && <Bi className="text-sm text-muted" t={{ en: `${done.count} cards reviewed, ${done.again} marked Again.`, hi: `${done.count} कार्ड दोहराए गए, ${done.again} को “फिर से” चिह्नित किया गया।` }} />}
          {queue.newWaiting > 0 && queue.newLimitRemaining === 0 && <Bi className="text-sm text-muted" t={{ en: `${queue.newWaiting} new cards are waiting. Today's new-card limit is reached, so they start tomorrow.`, hi: `${queue.newWaiting} नए कार्ड इंतज़ार में हैं। आज के नए कार्ड की सीमा पूरी हो गई है, इसलिए ये कल से शुरू होंगे।` }} />}
          {queue.newWaiting === 0 && done.count === 0 && <Bi className="text-sm text-muted" t={{ en: "Words from your lessons and words you save in the dictionary appear here.", hi: "आपके पाठों के शब्द और शब्दकोश में सहेजे गए शब्द यहाँ दिखते हैं।" }} />}
          <div className="flex gap-2"><Link className="btn btn-primary" href="/today"><Bi as="span" t={{ en: "Back to today", hi: "आज पर वापस जाएँ" }} /></Link><Link className="btn btn-secondary" href="/words"><Bi as="span" t={{ en: "My words", hi: "मेरे शब्द" }} /></Link></div>
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
  const L = useBiLabel();
  const { explanationLang } = usePrefs();
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
      <p><span className="text-xs text-muted">{L({ en: "English", hi: "अंग्रेज़ी" })}: </span>{w.en}</p>
      {w.hi && <p><span className="text-xs text-muted">{L({ en: "Hindi meaning", hi: "हिंदी अर्थ" })}: </span><span lang="hi" className="deva">{w.hi}</span></p>}
    </div>
  );

  return (
    <section className="card space-y-4" aria-label={L({ en: `Review card: ${KIND_LABEL[kind].en}`, hi: `दोहराव कार्ड: ${KIND_LABEL[kind].hi}` })}>
      <p className="text-xs uppercase tracking-wide text-muted">{L(KIND_LABEL[kind])}{c.card.state === "new" ? ` · ${L({ en: "new", hi: "नया" })}` : ""}</p>

      {/* Prompt */}
      {kind === "fr_to_meaning" && <p className="flex items-center gap-2 text-3xl font-semibold" lang="fr">{w.fr}<Speak text={w.fr} /></p>}
      {kind === "meaning_to_fr" && <div className="text-lg">{meaning}{gender && <Bi className="text-xs text-muted" t={{ en: "Noun · include the article if you know it", hi: "संज्ञा · अगर आर्टिकल पता हो तो उसे भी लिखें" }} />}</div>}
      {listenFirst && <div className="flex items-center gap-2"><Speak text={w.fr} size="md" label={L({ en: "the word", hi: "शब्द" })} /><Bi as="span" className="text-sm text-muted" t={{ en: "Type what you hear.", hi: "जो सुनें, वह टाइप करें।" }} /></div>}
      {kind === "gender" && <p className="text-3xl font-semibold" lang="fr">{bare(w.fr)}</p>}
      {kind === "cloze" && (cloze
        ? <div><p className="text-xl" lang="fr">{cloze.cloze}</p>{(cloze.en || cloze.hi) && <p className="text-sm text-muted">{cloze.en ? <Bi as="span" t={{ en: cloze.en, hi: cloze.hi }} /> : <span lang="hi" className="deva">{cloze.hi}</span>}</p>}<Bi className="mt-1 text-xs text-muted" t={{ en: `Hint: ${w.en}`, hi: `संकेत: ${w.hi || w.en}` }} /></div>
        : <div><Bi className="text-sm text-muted" t={{ en: "No example sentence yet for this word. Recall it from its meaning:", hi: "इस शब्द का अभी कोई उदाहरण वाक्य नहीं है। इसके अर्थ से इसे याद कीजिए:" }} />{meaning}</div>)}

      {/* Answer */}
      {kind === "gender" && !revealed && (
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => chooseGender("m")} disabled={!gender}>le / un</button>
          <button className="btn btn-secondary flex-1" onClick={() => chooseGender("f")} disabled={!gender}>la / une</button>
        </div>
      )}
      {typed && !revealed && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor="rv-in" className="sr-only">{L({ en: "Your answer in French", hi: "फ़्रेंच में आपका उत्तर" })}</label>
          <input id="rv-in" className="input text-lg" lang="fr" value={input} onChange={(e) => setInput(e.target.value)} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={L({ en: "Type in French", hi: "फ़्रेंच में लिखें" })} />
          <AccentBar targetId="rv-in" />
          <div className="flex gap-2"><button className="btn btn-primary"><Bi as="span" t={{ en: "Check", hi: "उत्तर जाँचें" }} /></button><button type="button" className="btn btn-ghost" onClick={() => { setRevealed(true); setSuggested("again"); }}><Bi as="span" t={{ en: "I don't know", hi: "मुझे नहीं पता" }} /></button></div>
        </form>
      )}
      {!typed && kind !== "gender" && !revealed && <button className="btn btn-primary w-full" onClick={() => setRevealed(true)} autoFocus><Bi as="span" t={{ en: "Show answer", hi: "उत्तर देखें" }} /></button>}

      {revealed && (
        <div className="space-y-3 border-t border-app pt-3">
          {check && <ResultLine r={check} />}
          <div className="flex items-center gap-2"><span className="text-xl font-semibold" lang="fr">{w.fr}</span><Speak text={w.fr} /></div>
          {kind !== "meaning_to_fr" && meaning}
          {c.example && kind !== "cloze" && <p className="text-sm" lang="fr">{c.example.fr}</p>}
          <div>
            <Bi className="mb-1 text-sm text-muted" t={suggested ? { en: "Suggested rating is highlighted. You decide.", hi: "सुझाई गई रेटिंग हाइलाइट की गई है। फ़ैसला आपका है।" } : { en: "How well did you know it?", hi: "आपको यह कितना अच्छी तरह याद था?" }} />
            <div className="grid grid-cols-4 gap-2" role="group" aria-label={L({ en: "Rate this card", hi: "इस कार्ड को रेट करें" })}>
              {RATINGS.map((x, i) => (
                <button key={x.r} type="button" disabled={busy} onClick={() => doRate(x.r)}
                  className={`btn flex-col gap-0 border-2 px-1 py-2 ${x.cls} ${suggested === x.r ? "ring-2 ring-offset-2 ring-[var(--focus)]" : ""}`}
                  aria-label={L({ en: `${x.label}, next review in ${c.preview[x.r]} (key ${i + 1})`, hi: `${x.hi}, अगला दोहराव ${c.preview[x.r]} में (कुंजी ${i + 1})` })}>
                  {explanationLang !== "hi" && <span className="font-semibold">{x.label}</span>}
                  {explanationLang !== "en" && <span className={`deva ${explanationLang === "hi" ? "font-semibold" : "text-xs"}`} lang="hi">{x.hi}</span>}
                  <span className="text-xs text-muted">{c.preview[x.r]}</span>
                </button>
              ))}
            </div>
            <Bi className="mt-1 hidden text-xs text-muted sm:block" t={{ en: "Keys 1–4 also rate.", hi: "1–4 कुंजियों से भी रेट कर सकते हैं।" }} />
          </div>
        </div>
      )}
    </section>
  );
}
