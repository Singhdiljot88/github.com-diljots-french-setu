"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bi, useBiLabel } from "./bi";
import { Speak, usePlayer, AudioSourceNote, AudioError } from "./audio";
import { api } from "@/lib/api-client";
import { CONFUSABLES, type Confusable } from "@/lib/confusables";
import { checkNumber, makeChallenge, type NumberChallenge, type NumberKind } from "@/lib/nombres";

export type ArcadeNoun = { lemma: string; gender: "m" | "f"; en: string; hi: string; pron?: string };
type GameKey = "gender_sprint" | "nombres" | "faux_amis" | "listen_pick";
type Miss = { original: string; corrected: string; en: string; hi?: string };
type T = { en: string; hi: string };

const shuffle = <X,>(xs: X[]): X[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const vowelStart = (w: string) => /^[aeiouyhâàéèêîïôûœ]/i.test(w);
const withArticle = (n: ArcadeNoun) => (vowelStart(n.lemma) ? `l'${n.lemma}` : `${n.gender === "m" ? "le" : "la"} ${n.lemma}`);
const indef = (n: ArcadeNoun) => `${n.gender === "m" ? "un" : "une"} ${n.lemma}`;

function readBest(key: string): number { try { return Number(localStorage.getItem(`fs-best-${key}`) ?? 0) || 0; } catch { return 0; } }
function writeBest(key: string, v: number) { try { localStorage.setItem(`fs-best-${key}`, String(v)); } catch { /* storage unavailable */ } }

/** Tracks one game session and saves it (one scored attempt, minutes, up to 5 misses). */
function useSession(game: GameKey) {
  const start = useRef(Date.now());
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const reset = useCallback(() => { start.current = Date.now(); setSaved("idle"); }, []);
  const save = useCallback(async (correct: number, total: number, misses: Miss[]) => {
    setSaved("saving");
    try {
      await api("/api/practice", { method: "POST", body: { game, correct, total, seconds: (Date.now() - start.current) / 1000, misses: misses.slice(0, 20) } });
      setSaved("saved");
    } catch { setSaved("error"); }
  }, [game]);
  return { save, saved, reset };
}

const GAMES: { key: GameKey; icon: string; title: T; blurb: T; tag: T; accent: string }[] = [
  { key: "gender_sprint", icon: "⚡", title: { en: "Gender sprint", hi: "लिंग स्प्रिंट" }, tag: { en: "60 seconds", hi: "60 सेकंड" }, accent: "from-brand-500 to-brand-700",
    blurb: { en: "le or la? Sort as many nouns as you can in a minute. Builds the reflex TEF writing needs.", hi: "le या la? एक मिनट में जितनी संज्ञाएँ हो सकें, छाँटिए। TEF लेखन के लिए यह आदत ज़रूरी है।" } },
  { key: "nombres", icon: "🔢", title: { en: "Number catcher", hi: "संख्या पकड़ो" }, tag: { en: "TEF listening", hi: "TEF सुनना" }, accent: "from-saffron-500 to-saffron-700",
    blurb: { en: "Hear prices, times, phone numbers and years, then type them. Many TEF listening answers are numbers.", hi: "दाम, समय, फ़ोन नंबर और साल सुनकर लिखिए। TEF सुनने के कई उत्तर संख्याएँ होते हैं।" } },
  { key: "faux_amis", icon: "🎭", title: { en: "False friends", hi: "धोखेबाज़ शब्द" }, tag: { en: "10 questions", hi: "10 सवाल" }, accent: "from-rose-500 to-rose-700",
    blurb: { en: "librairie isn't a library. Learn the words that look English but mean something else, plus Hindi gender traps.", hi: "librairie लाइब्रेरी नहीं है। अंग्रेज़ी जैसे दिखने वाले पर अलग मतलब वाले शब्द, और हिंदी से अलग लिंग वाले शब्द सीखिए।" } },
  { key: "listen_pick", icon: "🎧", title: { en: "Listen & pick", hi: "सुनो और चुनो" }, tag: { en: "10 words", hi: "10 शब्द" }, accent: "from-indigo-500 to-indigo-700",
    blurb: { en: "Hear a word, choose its meaning. Trains your ear to recognise words without seeing them.", hi: "शब्द सुनिए, उसका मतलब चुनिए। बिना देखे शब्द पहचानने के लिए कान तैयार होते हैं।" } },
];

export function PracticeArcade({ nouns, prons }: { nouns: ArcadeNoun[]; prons: Record<string, string> }) {
  const [game, setGame] = useState<GameKey | null>(null);
  const [bests, setBests] = useState<Record<string, number>>({});
  useEffect(() => { setBests(Object.fromEntries(GAMES.map((g) => [g.key, readBest(g.key)]))); }, [game]);
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1) as GameKey; setGame(GAMES.some((g) => g.key === h) ? h : null); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const open = (k: GameKey | null) => { setGame(k); history.replaceState(null, "", k ? `#${k}` : location.pathname); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (game) {
    const meta = GAMES.find((g) => g.key === game)!;
    return (
      <div className="space-y-4 animate-fade-up">
        <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={() => open(null)}>← <Bi as="span" t={{ en: "All games", hi: "सभी खेल" }} /></button>
        <div className={`hero-band bg-gradient-to-br ${meta.accent}`}>
          <span aria-hidden className="text-4xl">{meta.icon}</span>
          <div>
            <h2 className="text-xl font-bold"><Bi as="span" t={meta.title} /></h2>
            <Bi className="text-sm opacity-90" t={meta.blurb} />
          </div>
        </div>
        {game === "gender_sprint" && <GenderSprint nouns={nouns} />}
        {game === "nombres" && <Nombres />}
        {game === "faux_amis" && <FauxAmis prons={prons} />}
        {game === "listen_pick" && <ListenPick nouns={nouns} />}
      </div>
    );
  }
  return (
    <div className="space-y-5">
    <header className="space-y-1">
      <p className="eyebrow"><Bi as="span" t={{ en: "Quick practice", hi: "झटपट अभ्यास" }} /></p>
      <h1 className="text-3xl font-bold tracking-tight"><Bi as="span" t={{ en: "Practice games", hi: "अभ्यास के खेल" }} /></h1>
      <Bi className="text-muted" t={{ en: "5-minute games. Every word shows its Devanagari pronunciation.", hi: "5 मिनट के खेल। हर शब्द के साथ देवनागरी में उच्चारण।" }} />
    </header>
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {GAMES.map((g, i) => (
        <li key={g.key} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
          <button type="button" onClick={() => open(g.key)} className="game-tile group w-full text-left">
            <span className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${g.accent} text-3xl shadow-lg transition-transform group-hover:scale-105`} aria-hidden>{g.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><span className="text-lg font-semibold"><Bi as="span" t={g.title} /></span><span className="chip surface-2"><Bi as="span" t={g.tag} /></span></span>
              {bests[g.key] > 0 && <Bi className="mt-1 text-xs font-medium text-brand-700 dark:text-brand-200" t={{ en: `Your best: ${bests[g.key]}`, hi: `आपका सबसे अच्छा: ${bests[g.key]}` }} />}
            </span>
          </button>
        </li>
      ))}
    </ul>
    </div>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */

/** Approximate Devanagari pronunciation, always labelled as approximate (CONVENTIONS.md §3). */
export function Pron({ text, big = false }: { text: string; big?: boolean }) {
  return (
    <p className={`mt-1 ${big ? "text-xl" : "text-sm"}`}>
      <span lang="hi" className="deva font-medium text-saffron-700 dark:text-saffron-300">{text}</span>{" "}
      <span className="text-xs text-muted"><Bi as="span" t={{ en: "approx. pronunciation", hi: "लगभग उच्चारण" }} /></span>
    </p>
  );
}

function ScoreBar({ done, total, correct, streak }: { done: number; total: number; correct: number; streak?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-saffron-500 transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums">✓ {correct}</span>
      {!!streak && streak >= 2 && <span className="chip bg-saffron-100 text-saffron-700 animate-pop" key={streak}>🔥 ×{streak}</span>}
    </div>
  );
}

function Summary({ game, correct, total, misses, extra, onAgain, saved }: { game: GameKey; correct: number; total: number; misses: Miss[]; extra?: React.ReactNode; onAgain: () => void; saved: string }) {
  const pct = total ? correct / total : 0;
  const msg: T = pct >= 0.9 ? { en: "Excellent! Très bien !", hi: "बहुत बढ़िया! Très bien !" } : pct >= 0.6 ? { en: "Good work. Bien joué !", hi: "अच्छा काम। Bien joué !" } : { en: "Keep going: every miss is now in your notebook to practise.", hi: "लगे रहिए: हर ग़लती अब आपकी कॉपी में अभ्यास के लिए है।" };
  return (
    <section className="card space-y-4 text-center animate-pop" aria-live="polite">
      <ProgressRing value={pct} size={128} label={`${correct} / ${total}`} />
      <Bi className="text-lg font-semibold" t={msg} />
      {extra}
      {misses.length > 0 && (
        <div className="text-left">
          <h3 className="font-semibold"><Bi as="span" t={{ en: "Worth another look", hi: "इन्हें फिर से देखिए" }} /></h3>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {misses.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <span lang="fr" className="fr">{m.corrected}</span>
                <Speak text={m.corrected.replace(/\s*\(.*\)$/, "")} showSlow={false} />
                <span className="basis-full text-sm text-muted"><Bi as="span" t={{ en: m.en, hi: m.hi }} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={onAgain} autoFocus><Bi as="span" t={{ en: "Play again", hi: "फिर से खेलें" }} /></button>
        {misses.length > 0 && <a className="btn btn-secondary" href="/mistakes"><Bi as="span" t={{ en: "Mistake notebook", hi: "ग़लतियों की कॉपी" }} /></a>}
      </div>
      <p className="text-xs text-muted">
        {saved === "saving" && <Bi as="span" t={{ en: "Saving…", hi: "सहेजा जा रहा है…" }} />}
        {saved === "saved" && <Bi as="span" t={{ en: `Saved to your progress${misses.length ? `; ${Math.min(5, misses.length)} miss(es) added to the mistake notebook` : ""}.`, hi: `आपकी प्रगति में सहेजा गया${misses.length ? `; ${Math.min(5, misses.length)} ग़लती ग़लतियों की कॉपी में जोड़ी गई` : ""}।` }} />}
        {saved === "error" && <Bi as="span" t={{ en: "Couldn't save this session. Your score still counts here.", hi: "यह सत्र सहेजा नहीं जा सका। स्कोर यहाँ फिर भी दिख रहा है।" }} />}
      </p>
      <span className="sr-only">{game}</span>
    </section>
  );
}

export function ProgressRing({ value, size = 96, label, sub }: { value: number; size?: number; label: string; sub?: string }) {
  const r = 42, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size} aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
        <defs><linearGradient id="ring-grad" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-brand-500)" /><stop offset="100%" stopColor="var(--color-saffron-500)" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div><div className="text-xl font-bold tabular-nums">{label}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Gender sprint ───────────────────────── */

function GenderSprint({ nouns }: { nouns: ArcadeNoun[] }) {
  const L = useBiLabel();
  const DURATION = 60;
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [deck, setDeck] = useState<ArcadeNoun[]>([]);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [correct, setCorrect] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; n: ArcadeNoun } | null>(null);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { save, saved, reset } = useSession("gender_sprint");

  const start = () => { setDeck(shuffle(nouns)); setI(0); setLeft(DURATION); setCorrect(0); setCombo(0); setBestCombo(0); setMisses([]); setFlash(null); setNewBest(false); reset(); setPhase("play"); };

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === "play" && left <= 0) {
      setPhase("done");
      const best = readBest("gender_sprint");
      if (correct > best) { writeBest("gender_sprint", correct); setNewBest(true); }
      void save(correct, i, misses);
    }
  }, [left, phase, correct, i, misses, save]);

  const answer = useCallback((g: "m" | "f") => {
    if (phase !== "play") return;
    const n = deck[i];
    const ok = n.gender === g;
    setFlash({ ok, n });
    if (ok) { setCorrect((c) => c + 1); setCombo((c) => { const v = c + 1; setBestCombo((b) => Math.max(b, v)); return v; }); }
    else {
      setCombo(0);
      setMisses((ms) => (ms.some((m) => m.corrected.startsWith(indef(n))) ? ms : [...ms, { original: `${g === "m" ? "un" : "une"} ${n.lemma}`, corrected: `${indef(n)} (${withArticle(n)})`, en: `${n.lemma} is ${n.gender === "m" ? "masculine" : "feminine"}: ${n.en}`, hi: `${n.lemma} ${n.gender === "m" ? "पुल्लिंग" : "स्त्रीलिंग"} है: ${n.hi}` }]));
    }
    setI((x) => (x + 1) % deck.length);
  }, [phase, deck, i]);

  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "1") { e.preventDefault(); answer("m"); }
      if (e.key === "ArrowRight" || e.key === "2") { e.preventDefault(); answer("f"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, answer]);

  if (phase === "ready") return (
    <section className="card space-y-3">
      <Bi t={{ en: "Each noun appears without its article. Tap le/un if it's masculine, la/une if it's feminine. On a keyboard use ← and →.", hi: "हर संज्ञा बिना article के आएगी। पुल्लिंग हो तो le/un, स्त्रीलिंग हो तो la/une दबाइए। कीबोर्ड पर ← और → इस्तेमाल करें।" }} />
      <details className="rounded-xl surface-2 p-3 text-sm">
        <summary className="cursor-pointer font-medium"><Bi as="span" t={{ en: "Tip: guess from the ending", hi: "सुझाव: शब्द के अंत से पहचानें" }} /></summary>
        <Bi className="mt-1" t={{ en: "-tion, -sion, -té, -ette, -ure words are usually feminine; -ment, -age, -eau, -isme usually masculine.", hi: "-tion, -sion, -té, -ette, -ure वाले शब्द अक्सर स्त्रीलिंग होते हैं; -ment, -age, -eau, -isme अक्सर पुल्लिंग।" }} />
      </details>
      <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={start} disabled={nouns.length < 10}>⚡ <Bi as="span" t={{ en: "Start the clock", hi: "घड़ी शुरू करें" }} /></button>
    </section>
  );
  if (phase === "done") return <Summary game="gender_sprint" correct={correct} total={i} misses={misses} onAgain={start} saved={saved}
    extra={<p className="text-sm text-muted"><Bi as="span" t={{ en: `Best combo ×${bestCombo}${newBest ? " · New personal best!" : ""}`, hi: `सबसे लंबी लगातार सही ×${bestCombo}${newBest ? " · नया व्यक्तिगत रिकॉर्ड!" : ""}` }} /></p>} />;

  const n = deck[i];
  return (
    <section className="card space-y-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className={`chip tabular-nums text-base ${left <= 10 ? "bg-rose-100 text-rose-700 animate-pulse" : "surface-2"}`}>⏱ {left}s</span>
        <span className="text-sm font-semibold tabular-nums">✓ {correct} / {i}</span>
        {combo >= 2 && <span key={combo} className="chip bg-saffron-100 text-saffron-700 animate-pop">🔥 ×{combo}</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full bg-gradient-to-r from-brand-500 to-saffron-500 transition-all duration-1000 ease-linear" style={{ width: `${(left / DURATION) * 100}%` }} /></div>
      <div key={i} className="py-6 text-center animate-fade-up">
        <p lang="fr" className="text-4xl font-bold tracking-tight sm:text-5xl">{n.lemma}</p>
        {n.pron && <Pron text={n.pron} big />}
        <Bi className="mt-2 text-muted" t={{ en: n.en, hi: n.hi }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="choice-btn h-20 flex-col !gap-0 text-xl" onClick={() => answer("m")} aria-label={L({ en: "Masculine: le / un", hi: "पुल्लिंग: le / un" })}><span lang="fr">le · un</span><span className="text-xs font-normal text-muted"><Bi as="span" t={{ en: "masculine", hi: "पुल्लिंग" }} /></span></button>
        <button type="button" className="choice-btn h-20 flex-col !gap-0 text-xl" onClick={() => answer("f")} aria-label={L({ en: "Feminine: la / une", hi: "स्त्रीलिंग: la / une" })}><span lang="fr">la · une</span><span className="text-xs font-normal text-muted"><Bi as="span" t={{ en: "feminine", hi: "स्त्रीलिंग" }} /></span></button>
      </div>
      <div className="min-h-8 text-center">
        {flash && <p key={i} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${flash.ok ? "bg-brand-100 text-brand-900 animate-pop" : "bg-rose-100 text-rose-800 animate-shake"}`}>{flash.ok ? "✓" : "✗"} <span lang="fr">{indef(flash.n)}</span></p>}
      </div>
    </section>
  );
}

/* ───────────────────────── Number catcher ───────────────────────── */

const NUMBER_KINDS: { key: NumberKind; label: T; example: string }[] = [
  { key: "small", label: { en: "0–69", hi: "" }, example: "47" },
  { key: "seventies", label: { en: "70–99 (tricky!)", hi: "70–99 (मुश्किल!)" }, example: "92" },
  { key: "big", label: { en: "100–9,999", hi: "" }, example: "1 450" },
  { key: "price", label: { en: "Prices", hi: "दाम" }, example: "12,50 €" },
  { key: "time", label: { en: "Times", hi: "समय" }, example: "14 h 30" },
  { key: "phone", label: { en: "Phone numbers", hi: "फ़ोन नंबर" }, example: "06 12 …" },
  { key: "year", label: { en: "Years", hi: "साल" }, example: "1998" },
];
const ROUND = 10;

function Nombres() {
  const L = useBiLabel();
  const { play, playing, error, engine } = usePlayer();
  const [kinds, setKinds] = useState<NumberKind[]>(["small", "seventies", "price", "time"]);
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [items, setItems] = useState<NumberChallenge[]>([]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [showWords, setShowWords] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { save, saved, reset } = useSession("nombres");

  const say = useCallback((ch: NumberChallenge, slow = false) => play([{ text: ch.spoken }], { slow }), [play]);
  const start = () => {
    const pool = kinds.length ? kinds : ["small" as NumberKind];
    const list = Array.from({ length: ROUND }, (_, k) => makeChallenge(pool[k % pool.length]));
    setItems(shuffle(list)); setIdx(0); setTyped(""); setResult(null); setCorrect(0); setStreak(0); setMisses([]); setShowWords(false); reset(); setPhase("play");
  };
  useEffect(() => { if (phase === "play" && items[idx] && result === null) { void say(items[idx]); input.current?.focus(); } }, [phase, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (result !== null) { next(); return; }
    const ch = items[idx];
    const ok = checkNumber(ch, typed);
    setResult(ok);
    if (ok) { setCorrect((c) => c + 1); setStreak((s) => s + 1); }
    else { setStreak(0); setMisses((m) => [...m, { original: typed || "—", corrected: `${ch.display} (${ch.spoken})`, en: `You heard “${ch.spoken}” = ${ch.display}`, hi: `आपने सुना “${ch.spoken}” (${ch.pron}) = ${ch.display}` }]); }
  };
  const next = () => {
    if (idx + 1 >= items.length) { setPhase("done"); const best = readBest("nombres"); if (correct > best) writeBest("nombres", correct); void save(correct, items.length, misses); return; }
    setIdx((x) => x + 1); setTyped(""); setResult(null); setShowWords(false);
  };

  if (phase === "ready") return (
    <section className="card space-y-4">
      <fieldset>
        <legend className="font-semibold"><Bi as="span" t={{ en: "What do you want to catch?", hi: "आप क्या पकड़ना चाहते हैं?" }} /></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {NUMBER_KINDS.map((k) => {
            const on = kinds.includes(k.key);
            return <button key={k.key} type="button" aria-pressed={on} onClick={() => setKinds((ks) => (on ? ks.filter((x) => x !== k.key) : [...ks, k.key]))} className={`toggle-chip ${on ? "is-on" : ""}`}><Bi as="span" t={k.label} /> <span className="text-xs opacity-70">{k.example}</span></button>;
          })}
        </div>
      </fieldset>
      <details className="rounded-xl surface-2 p-3 text-sm">
        <summary className="cursor-pointer font-medium"><Bi as="span" t={{ en: "How 70, 80 and 90 work", hi: "70, 80 और 90 कैसे बनते हैं" }} /></summary>
        <Bi className="mt-2" t={{ en: "France counts in twenties after 60: 70 = soixante-dix (60+10), 80 = quatre-vingts (4×20), 90 = quatre-vingt-dix (4×20+10). So 92 = quatre-vingt-douze. Belgium and Switzerland say septante and nonante, but TEF recordings mostly use the France forms.", hi: "फ़्रांस में 60 के बाद बीस-बीस में गिनते हैं: 70 = soixante-dix (60+10), 80 = quatre-vingts (4×20), 90 = quatre-vingt-dix (4×20+10)। तो 92 = quatre-vingt-douze। बेल्जियम और स्विट्ज़रलैंड में septante और nonante कहते हैं, पर TEF की रिकॉर्डिंग में ज़्यादातर फ़्रांस वाले रूप आते हैं।" }} />
        <Bi className="mt-2" t={{ en: "Prices: “douze euros cinquante” = 12,50 €. Times use the 24-hour clock: “quatorze heures trente” = 14 h 30. Phone numbers are read in pairs.", hi: "दाम: “douze euros cinquante” = 12,50 €। समय 24 घंटे वाली घड़ी से: “quatorze heures trente” = 14 h 30। फ़ोन नंबर दो-दो अंकों में पढ़े जाते हैं।" }} />
      </details>
      <AudioSourceNote />
      <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={start} disabled={!kinds.length || engine.kind === "none"}>🔢 <Bi as="span" t={{ en: `Start ${ROUND} numbers`, hi: `${ROUND} संख्याएँ शुरू करें` }} /></button>
    </section>
  );
  if (phase === "done") return <Summary game="nombres" correct={correct} total={items.length} misses={misses} onAgain={start} saved={saved} />;

  const ch = items[idx];
  const hint: T = ch.kind === "price" ? { en: "Type like 12.50 or 12,50", hi: "ऐसे लिखें: 12.50 या 12,50" } : ch.kind === "time" ? { en: "Type like 14:30 or 14h30", hi: "ऐसे लिखें: 14:30 या 14h30" } : ch.kind === "phone" ? { en: "Type all 10 digits", hi: "सभी 10 अंक लिखें" } : { en: "Type the number in digits", hi: "संख्या अंकों में लिखें" };
  return (
    <section className="card space-y-5">
      <ScoreBar done={idx + (result !== null ? 1 : 0)} total={items.length} correct={correct} streak={streak} />
      <div className="flex flex-col items-center gap-3 py-2">
        <button type="button" onClick={() => say(ch)} className={`listen-orb ${playing !== null ? "is-playing" : ""}`} aria-label={L({ en: "Play the number again", hi: "संख्या फिर से सुनें" })}><span aria-hidden className="text-4xl">{playing !== null ? "🔊" : "▶"}</span></button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => say(ch, true)}>🐢 <Bi as="span" t={{ en: "Slower", hi: "धीरे" }} /></button>
        <AudioError error={error} />
      </div>
      <form onSubmit={check} className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="num-in"><Bi as="span" t={hint} /></label>
        <div className="flex gap-2">
          <input id="num-in" ref={input} className={`input text-center text-2xl font-semibold tabular-nums ${result === true ? "!border-brand-500" : result === false ? "!border-rose-500 animate-shake" : ""}`} inputMode={ch.kind === "time" || ch.kind === "price" ? "decimal" : "numeric"} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} readOnly={result !== null} />
          <button type="submit" className="btn btn-primary min-w-24">{result === null ? L({ en: "Check", hi: "जाँचें" }) : L({ en: "Next →", hi: "आगे →" })}</button>
        </div>
      </form>
      {result !== null && (
        <div className={`rounded-xl p-3 animate-fade-up ${result ? "bg-brand-50 dark:bg-brand-900/40" : "bg-rose-50 dark:bg-rose-950/40"}`}>
          <p className="text-lg font-semibold">{result ? "✓ " : "✗ "}<span className="tabular-nums">{ch.display}</span></p>
          <p lang="fr" className="text-sm"><span className="text-muted"><Bi as="span" t={{ en: "You heard:", hi: "आपने सुना:" }} /></span> <em>{ch.spoken}</em></p>
          <Pron text={ch.pron} />
        </div>
      )}
      {result === null && <button type="button" className="text-xs text-muted underline" onClick={() => setShowWords((s) => !s)}><Bi as="span" t={{ en: showWords ? "Hide the words" : "Can't catch it? Show the words", hi: showWords ? "शब्द छिपाएँ" : "समझ नहीं आया? शब्द दिखाएँ" }} /></button>}
      {showWords && result === null && <div className="text-center"><p lang="fr" className="italic">{ch.spoken}</p><Pron text={ch.pron} /></div>}
    </section>
  );
}

/* ───────────────────────── False friends ───────────────────────── */

type FQ = { item: Confusable; options: { text: T; right: boolean; trap?: boolean }[] };

function FauxAmis({ prons }: { prons: Record<string, string> }) {
  const [tab, setTab] = useState<"quiz" | "browse">("quiz");
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [qs, setQs] = useState<FQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const { save, saved, reset } = useSession("faux_amis");
  const friends = useMemo(() => CONFUSABLES.filter((c) => c.kind === "false_friend"), []);

  const start = () => {
    const picks = shuffle(friends).slice(0, ROUND);
    setQs(picks.map((item) => {
      const others = shuffle(friends.filter((f) => f !== item)).slice(0, 2).map((f) => ({ text: f.means, right: false }));
      const trap = { text: { en: item.looksLike, hi: `“${item.looksLike}” जैसा दिखता है` }, right: false, trap: true };
      return { item, options: shuffle([{ text: item.means, right: true }, trap, ...others]) };
    }));
    setIdx(0); setPicked(null); setCorrect(0); setStreak(0); setMisses([]); reset(); setPhase("play");
  };
  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const q = qs[idx];
    if (q.options[k].right) { setCorrect((c) => c + 1); setStreak((s) => s + 1); }
    else { setStreak(0); setMisses((m) => [...m, { original: `${q.item.fr} = ${q.options[k].text.en}`, corrected: q.item.fr, en: `${q.item.fr} means “${q.item.means.en}”${q.item.insteadSay ? `. For “${q.item.insteadSay.en}” say ${q.item.insteadSay.fr}` : ""}.`, hi: `${q.item.fr} का मतलब है “${q.item.means.hi}”${q.item.insteadSay ? `। “${q.item.insteadSay.en}” के लिए ${q.item.insteadSay.fr} कहें` : ""}।` }]); }
  };
  const next = () => {
    if (idx + 1 >= qs.length) { setPhase("done"); if (correct > readBest("faux_amis")) writeBest("faux_amis", correct); void save(correct, qs.length, misses); return; }
    setIdx((x) => x + 1); setPicked(null);
  };

  return (
    <div className="space-y-4">
      <div role="tablist" className="segmented">
        <button role="tab" type="button" aria-selected={tab === "quiz"} onClick={() => setTab("quiz")}><Bi as="span" t={{ en: "Quiz", hi: "क्विज़" }} /></button>
        <button role="tab" type="button" aria-selected={tab === "browse"} onClick={() => setTab("browse")}><Bi as="span" t={{ en: `Browse all ${CONFUSABLES.length}`, hi: `सभी ${CONFUSABLES.length} देखें` }} /></button>
      </div>
      {tab === "browse" ? <ConfusablesList prons={prons} /> : phase === "ready" ? (
        <section className="card space-y-3">
          <Bi t={{ en: "Each question shows a French word that looks like English. One answer is the trap: the English look-alike. Pick what it really means.", hi: "हर सवाल में एक फ़्रेंच शब्द है जो अंग्रेज़ी जैसा दिखता है। एक विकल्प जाल है: अंग्रेज़ी जैसा दिखने वाला मतलब। असली मतलब चुनिए।" }} />
          <button type="button" className="btn btn-primary" onClick={start}>🎭 <Bi as="span" t={{ en: "Start quiz", hi: "क्विज़ शुरू करें" }} /></button>
        </section>
      ) : phase === "done" ? <Summary game="faux_amis" correct={correct} total={qs.length} misses={misses} onAgain={start} saved={saved} /> : (() => {
        const q = qs[idx];
        return (
          <section className="card space-y-4">
            <ScoreBar done={idx + (picked !== null ? 1 : 0)} total={qs.length} correct={correct} streak={streak} />
            <div key={idx} className="text-center animate-fade-up">
              <p className="text-sm text-muted"><Bi as="span" t={{ en: "What does this really mean?", hi: "इसका असली मतलब क्या है?" }} /></p>
              <p className="mt-1 flex items-center justify-center gap-2"><span lang="fr" className="text-3xl font-bold">{q.item.fr}</span><Speak text={q.item.fr} showSlow={false} /></p>
              {prons[q.item.fr] && <Pron text={prons[q.item.fr]} big />}
            </div>
            <ul className="grid gap-2">
              {q.options.map((o, k) => {
                const state = picked === null ? "" : o.right ? "is-right" : picked === k ? "is-wrong" : "is-dim";
                return <li key={k}><button type="button" className={`choice-btn w-full justify-start text-left ${state}`} onClick={() => choose(k)} disabled={picked !== null && !o.right && picked !== k}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-app text-xs font-bold">{String.fromCharCode(65 + k)}</span>
                  <Bi as="span" t={o.text} />{picked !== null && o.trap && <span className="chip ml-auto bg-rose-100 text-rose-700"><Bi as="span" t={{ en: "the trap", hi: "जाल" }} /></span>}
                </button></li>;
              })}
            </ul>
            {picked !== null && (
              <div className="rounded-xl surface-2 p-3 text-sm animate-fade-up">
                <p lang="fr" className="font-medium">« {q.item.example.fr} »</p>
                <p className="text-muted">{q.item.example.en}</p>
                {q.item.insteadSay && <p className="mt-1"><Bi as="span" t={{ en: `For “${q.item.insteadSay.en}”, say`, hi: `“${q.item.insteadSay.en}” के लिए कहें` }} /> <strong lang="fr">{q.item.insteadSay.fr}</strong></p>}
                <button type="button" className="btn btn-primary btn-sm mt-3" onClick={next} autoFocus><Bi as="span" t={{ en: idx + 1 >= qs.length ? "See results" : "Next →", hi: idx + 1 >= qs.length ? "नतीजा देखें" : "आगे →" }} /></button>
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}

function ConfusablesList({ prons }: { prons: Record<string, string> }) {
  const groups: { kind: Confusable["kind"]; title: T }[] = [
    { kind: "false_friend", title: { en: "False friends (look English, aren't)", hi: "धोखेबाज़ शब्द (अंग्रेज़ी जैसे दिखते हैं, पर हैं नहीं)" } },
    { kind: "sound_alike", title: { en: "Sound-alikes to catch in listening", hi: "मिलती-जुलती आवाज़ें — सुनते समय ध्यान दें" } },
    { kind: "gender_trap", title: { en: "Hindi ↔ French gender", hi: "हिंदी ↔ फ़्रेंच लिंग" } },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.kind} className="card">
          <h3 className="font-semibold"><Bi as="span" t={g.title} /></h3>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {CONFUSABLES.filter((c) => c.kind === g.kind).map((c) => (
              <li key={c.fr} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2"><span lang="fr" className="fr">{c.fr}</span><Speak text={c.fr.split(" / ")[0]} showSlow={false} />{g.kind === "false_friend" && <span className="text-sm text-muted line-through decoration-rose-500">{c.looksLike}</span>}</div>
                {prons[c.fr] && <Pron text={prons[c.fr]} />}
                <Bi className="text-sm" t={c.means} />
                <p lang="fr" className="text-sm text-muted">« {c.example.fr} » <span lang="en">— {c.example.en}</span></p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Bi className="text-xs text-muted" t={{ en: "AI-drafted list, editorial review pending.", hi: "AI से तैयार की गई सूची, संपादकीय जाँच बाक़ी है।" }} />
    </div>
  );
}

/* ───────────────────────── Listen & pick ───────────────────────── */

function ListenPick({ nouns }: { nouns: ArcadeNoun[] }) {
  const L = useBiLabel();
  const { play, playing, error, engine } = usePlayer();
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [qs, setQs] = useState<{ n: ArcadeNoun; options: ArcadeNoun[] }[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const { save, saved, reset } = useSession("listen_pick");

  const start = () => {
    const deck = shuffle(nouns).slice(0, ROUND);
    setQs(deck.map((n) => ({ n, options: shuffle([n, ...shuffle(nouns.filter((x) => x.lemma !== n.lemma && x.en !== n.en)).slice(0, 3)]) })));
    setIdx(0); setPicked(null); setCorrect(0); setStreak(0); setMisses([]); reset(); setPhase("play");
  };
  useEffect(() => { if (phase === "play" && qs[idx]) void play([{ text: withArticle(qs[idx].n) }]); }, [phase, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (o: ArcadeNoun) => {
    if (picked) return;
    setPicked(o.lemma);
    const q = qs[idx];
    if (o.lemma === q.n.lemma) { setCorrect((c) => c + 1); setStreak((s) => s + 1); }
    else { setStreak(0); setMisses((m) => [...m, { original: o.lemma, corrected: withArticle(q.n), en: `You heard “${withArticle(q.n)}” = ${q.n.en}`, hi: `आपने सुना “${withArticle(q.n)}” = ${q.n.hi}` }]); }
  };
  const next = () => {
    if (idx + 1 >= qs.length) { setPhase("done"); if (correct > readBest("listen_pick")) writeBest("listen_pick", correct); void save(correct, qs.length, misses); return; }
    setIdx((x) => x + 1); setPicked(null);
  };

  if (phase === "ready") return (
    <section className="card space-y-3">
      <Bi t={{ en: "You'll hear one French word with its article. Choose its meaning. You can replay as often as you like.", hi: "आप article के साथ एक फ़्रेंच शब्द सुनेंगे। उसका मतलब चुनिए। जितनी बार चाहें, फिर से सुन सकते हैं।" }} />
      <AudioSourceNote />
      <button type="button" className="btn btn-primary" onClick={start} disabled={engine.kind === "none"}>🎧 <Bi as="span" t={{ en: "Start listening", hi: "सुनना शुरू करें" }} /></button>
    </section>
  );
  if (phase === "done") return <Summary game="listen_pick" correct={correct} total={qs.length} misses={misses} onAgain={start} saved={saved} />;
  const q = qs[idx];
  return (
    <section className="card space-y-5">
      <ScoreBar done={idx + (picked ? 1 : 0)} total={qs.length} correct={correct} streak={streak} />
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={() => play([{ text: withArticle(q.n) }])} className={`listen-orb ${playing !== null ? "is-playing" : ""}`} aria-label={L({ en: "Play the word again", hi: "शब्द फिर से सुनें" })}><span aria-hidden className="text-4xl">{playing !== null ? "🔊" : "▶"}</span></button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => play([{ text: withArticle(q.n) }], { slow: true })}>🐢 <Bi as="span" t={{ en: "Slower", hi: "धीरे" }} /></button>
        <AudioError error={error} />
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {q.options.map((o) => {
          const state = !picked ? "" : o.lemma === q.n.lemma ? "is-right" : picked === o.lemma ? "is-wrong" : "is-dim";
          return <li key={o.lemma}><button type="button" className={`choice-btn h-full min-h-20 w-full flex-col ${state}`} onClick={() => choose(o)}>
            <Bi as="span" t={{ en: o.en, hi: o.hi }} />
            {picked && <span lang="fr" className="text-xs text-muted">{withArticle(o)}</span>}
          </button></li>;
        })}
      </ul>
      {picked && <div className="text-center animate-fade-up"><p lang="fr" className="text-xl font-semibold">{withArticle(q.n)}</p>{q.n.pron && <Pron text={q.n.pron} />}<button type="button" className="btn btn-primary btn-sm mt-2" onClick={next} autoFocus><Bi as="span" t={{ en: idx + 1 >= qs.length ? "See results" : "Next →", hi: idx + 1 >= qs.length ? "नतीजा देखें" : "आगे →" }} /></button></div>}
    </section>
  );
}
