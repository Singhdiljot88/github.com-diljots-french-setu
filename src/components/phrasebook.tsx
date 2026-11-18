"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bi, useBiLabel } from "./bi";
import { Speak } from "./audio";
import { ExplainButton } from "./explain-button";
import { SituationRoleplay } from "./situation-roleplay";
import { Pron } from "./practice-arcade";
import { searchKey } from "@/lib/text";
import type { Situation } from "@/lib/situations";

export function Phrasebook({ book, courseDay }: { book: Situation[]; courseDay: number }) {
  const [id, setId] = useState(book[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [upto, setUpto] = useState(true);
  const L = useBiLabel();
  const sit = book.find((s) => s.id === id) ?? book[0];
  const lines = useMemo(() => {
    const key = searchKey(q);
    const pool = key ? book.flatMap((s) => s.lines.map((line) => ({ ...line, situation: s.id }))) : (sit?.lines ?? []).map((line) => ({ ...line, situation: sit?.id ?? "" }));
    return pool.filter((line) => {
      if (upto && line.day > courseDay) return false;
      if (!key) return true;
      return searchKey(`${line.fr} ${line.en} ${line.hi}`).includes(key);
    });
  }, [book, sit, q, upto, courseDay]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="eyebrow"><Bi as="span" t={{ en: "Say it in real life", hi: "असली ज़िंदगी में बोलें" }} /></p>
        <h1 className="text-3xl font-bold tracking-tight"><Bi as="span" t={{ en: "Phrasebook", hi: "वाक्यांश" }} /></h1>
        <Bi className="text-muted" t={{ en: "Phrases taken from your lessons, grouped by situation. Listen, then say them aloud. Nothing here is new French invented outside the course.", hi: "आपके पाठों के वाक्यांश, मौके के हिसाब से। सुनें, फिर ज़ोर से बोलें। यहाँ पाठ्यक्रम के बाहर कोई नई फ़्रेंच नहीं है।" }} />
      </header>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="phrase-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ en: "Search: café, appointment, merci…", hi: "खोजें: café, appointment, merci…" })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={upto} onChange={(e) => setUpto(e.target.checked)} /> <Bi as="span" t={{ en: `Up to day ${courseDay}`, hi: `दिन ${courseDay} तक` }} /></label>
      </div>
      {!q && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {book.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setId(s.id)} aria-pressed={s.id === sit?.id} className={`game-tile w-full !items-center !p-3 text-left ${s.id === sit?.id ? "ring-2 ring-brand-500" : ""}`}>
                <span aria-hidden className="text-2xl">{s.icon}</span>
                <Bi as="span" className="text-sm font-semibold" t={s.title} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {sit && !q && (
        <div className="space-y-3">
          <Bi className="text-sm text-muted" t={sit.blurb} />
          <SituationRoleplay id={sit.id} />
        </div>
      )}
      <ul className="space-y-3">
        {lines.map((line) => (
          <li key={`${line.situation}-${line.fr}`} className="card space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-lg font-medium" lang="fr"><span>{line.fr}</span><Speak text={line.fr} /><ExplainButton fr={line.fr} en={line.en} hi={line.hi} context={`day ${line.day}`} /></p>
            {line.pron && <Pron text={line.pron} />}
            <p className="text-sm">{line.en}</p>
            <p className="text-sm deva" lang="hi">{line.hi}</p>
            <p className="text-xs text-muted"><Link className="underline" href={`/lesson/${line.day}`}><Bi as="span" t={{ en: `From day ${line.day}`, hi: `दिन ${line.day} से` }} /></Link></p>
          </li>
        ))}
      </ul>
      {lines.length === 0 && <Bi className="text-sm text-muted" t={{ en: "Nothing matches. Turn off “up to my day” to see later lessons, or try another word.", hi: "कुछ नहीं मिला। आगे के पाठ देखने के लिए “मेरे दिन तक” हटाएँ, या दूसरा शब्द आज़माएँ।" }} />}
    </div>
  );
}
