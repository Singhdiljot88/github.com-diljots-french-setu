"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Speak } from "./audio";
import { Bi, useBiLabel } from "./bi";
import { usePrefs } from "./prefs";

type Answer = { answer: { en: string; hi: string }; examples: { fr: string; pron: string; hi: string }[]; outOfScope: boolean };
type QA = { q: string; a: Answer };

const STARTERS: Record<string, string[]> = {
  default: ["इस पाठ का व्याकरण आसान भाषा में समझाइए", "हिंदी बोलने वाले यहाँ क्या ग़लती करते हैं?", "इस पाठ के 3 सबसे ज़रूरी वाक्य बताइए"],
};

/** Ask a doubt about this lesson in Hindi or English; the AI tutor answers in simple Hindi, using the lesson. */
export function AskTutor({ day }: { day: number }) {
  const { providers } = usePrefs();
  const L = useBiLabel();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<QA[]>([]);
  if (!providers.ai.available) return null;

  const ask = async (text = q) => {
    const t = text.trim();
    if (t.length < 2) return;
    setBusy(true); setErr(null);
    try {
      const a = await api<Answer>(`/api/lesson/${day}/ask`, { body: { question: t } });
      setHistory((h) => [{ q: t, a }, ...h].slice(0, 6)); setQ("");
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <section className="card space-y-3" aria-labelledby="ask-tutor-h">
      <h2 id="ask-tutor-h" className="text-lg font-semibold">🙋 <Bi as="span" t={{ en: "Ask the tutor", hi: "टीचर से पूछें" }} /></h2>
      <Bi className="text-sm text-muted" t={{ en: "Stuck on something in this lesson? Ask in Hindi, Hinglish or English.", hi: "इस पाठ में कुछ समझ नहीं आया? हिंदी, हिंग्लिश या अंग्रेज़ी में पूछिए।" }} />
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <label htmlFor={`ask-${day}`} className="sr-only">{L({ en: "Your question", hi: "आपका सवाल" })}</label>
        <textarea id={`ask-${day}`} lang="hi" className="input deva min-h-20" maxLength={500} value={q} onChange={(e) => setQ(e.target.value)} placeholder="जैसे: Je m'appelle में m' क्यों है?" />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy || q.trim().length < 2}>{busy ? L({ en: "Thinking…", hi: "सोच रहे हैं…" }) : L({ en: "Ask", hi: "पूछें" })}</button>
          {STARTERS.default.map((s) => <button key={s} type="button" className="chip deva hover:bg-[var(--surface-2)]" disabled={busy} onClick={() => ask(s)}>{s}</button>)}
        </div>
        {err && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{err}</p>}
      </form>
      <ol className="space-y-3" aria-live="polite">
        {history.map((h, i) => (
          <li key={i} className="rounded-xl surface-2 p-3 space-y-2">
            <p lang="hi" className="deva font-medium">❓ {h.q}</p>
            <Bi t={h.a.answer} />
            {h.a.examples.length > 0 && (
              <ul className="space-y-1">
                {h.a.examples.map((x, j) => (
                  <li key={j} className="flex flex-wrap items-center gap-x-2">
                    <span lang="fr" className="font-semibold">{x.fr}</span>
                    <span lang="hi" className="deva text-muted">{x.pron}</span>
                    <span lang="hi" className="deva">= {x.hi}</span>
                    <Speak text={x.fr} showSlow={false} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {history.length > 0 && <Bi className="text-xs text-muted" t={{ en: "AI answer: check anything that looks wrong.", hi: "AI का जवाब: जो ग़लत लगे उसे जाँच लें।" }} />}
    </section>
  );
}
