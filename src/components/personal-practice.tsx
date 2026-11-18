"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { checkAnswer } from "@/lib/text";
import { AccentBar } from "./accent-bar";
import { Bi, useBiLabel } from "./bi";
import type { PracticeItem } from "@/lib/coach-demo";

type Pack = { isDemo: boolean; label: { en: string; hi: string }; items: PracticeItem[] };

export function PersonalPractice() {
  const [pack, setPack] = useState<Pack | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [mark, setMark] = useState<"correct" | "accent" | "wrong" | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const L = useBiLabel();

  const start = async () => {
    setBusy(true); setErr(null); setDone(false); setI(0); setScore(0); setValue(""); setMark(null);
    try {
      const p = await api<Pack>("/api/practice/personal", { body: {} });
      setPack(p);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not build practice."); }
    finally { setBusy(false); }
  };
  const q = pack?.items[i];
  const check = () => {
    if (!q) return;
    const r = checkAnswer(value, q.answer);
    setMark(r.result);
    if (r.result !== "wrong") setScore((n) => n + 1);
  };
  const next = () => {
    if (!pack) return;
    if (i + 1 >= pack.items.length) { setDone(true); return; }
    setI((n) => n + 1); setValue(""); setMark(null);
  };

  if (!pack) {
    return (
      <section className="card space-y-2">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Practice from your mistakes", hi: "अपनी ग़लतियों से अभ्यास" }} /></h2>
        <Bi className="text-sm text-muted" t={{ en: "A short quiz built from mistakes still open in this notebook. With an AI key it writes new questions. Without one, it reuses the drills already saved here. No level is shown.", hi: "इस कॉपी में खुली ग़लतियों से एक छोटा अभ्यास। AI कुंजी होने पर नए प्रश्न बनते हैं। बिना कुंजी के यहाँ सहेजे अभ्यास दोहराए जाते हैं। कोई स्तर नहीं दिखता।" }} />
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <button type="button" className="btn btn-primary" onClick={start} disabled={busy}><Bi as="span" t={busy ? { en: "Preparing…", hi: "तैयार हो रहा है…" } : { en: "Start", hi: "शुरू करें" }} /></button>
      </section>
    );
  }
  if (!pack.items.length) return <Bi className="card text-sm" t={{ en: "No open mistakes yet. They appear after a wrong answer in a lesson, a game, or a piece of writing.", hi: "अभी कोई खुली ग़लती नहीं। पाठ, खेल या लेखन में ग़लत उत्तर के बाद यहाँ आती हैं।" }} />;
  if (done) {
    return (
      <section className="card reveal-in space-y-2">
        <h2 className="text-xl font-semibold">{score} / {pack.items.length}</h2>
        <Bi className="text-sm text-muted" t={pack.label} />
        <button type="button" className="btn btn-secondary" onClick={() => setPack(null)}><Bi as="span" t={{ en: "Back to the notebook", hi: "कॉपी पर वापस" }} /></button>
      </section>
    );
  }
  return (
    <form className={`card space-y-3 ${mark === "correct" || mark === "accent" ? "answer-ok" : mark === "wrong" ? "answer-no" : ""}`} onSubmit={(e) => { e.preventDefault(); mark ? next() : check(); }}>
      <p className="text-sm text-muted">{i + 1} / {pack.items.length}</p>
      <Bi className="text-lg font-semibold" t={{ en: q!.promptEn, hi: q!.promptHi }} />
      <p lang="fr">{q!.sentence}</p>
      <label className="sr-only" htmlFor="pp-in">{L({ en: "Your answer", hi: "आपका उत्तर" })}</label>
      <input id="pp-in" className="input text-lg" lang="fr" value={value} onChange={(e) => setValue(e.target.value)} disabled={!!mark} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <AccentBar targetId="pp-in" />
      {mark && (
        <div className="reveal-in text-sm" role="status">
          <p lang="fr" className="font-semibold">{q!.answer}</p>
          <Bi t={{ en: q!.whyEn, hi: q!.whyHi }} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="submit"><Bi as="span" t={mark ? { en: "Next", hi: "आगे" } : { en: "Check", hi: "जाँचें" }} /></button>
        <button type="button" className="btn btn-ghost" onClick={() => setPack(null)}><Bi as="span" t={{ en: "Close", hi: "बंद करें" }} /></button>
      </div>
      <Bi className="text-xs text-muted" t={pack.label} />
    </form>
  );
}
