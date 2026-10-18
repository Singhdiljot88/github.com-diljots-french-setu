"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Speak } from "./audio";
import { Pron } from "./fr-item";
import { SaveWordButton } from "./save-word";

type Hit = { id: string; lemma: string; pos: string; gender?: string; en: string[]; hi: string[]; pron?: string; level: string; match: string; note?: string };

const MATCH_LABEL: Record<string, string> = { lemma: "", form: "verb form", plural_feminine: "plural/feminine", misspelling: "spelling corrected", prefix: "starts with", phrase: "in a phrase", fuzzy: "close spelling" };
const GENDER: Record<string, string> = { m: "masc.", f: "fem.", mf: "masc./fem." };

export function DictionarySearch({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const url = new URL(window.location.href);
    if (term) url.searchParams.set("q", term); else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
    if (!term) { setHits(null); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ hits: Hit[] }>(`/api/dictionary?q=${encodeURIComponent(term)}`);
        if (n === seq.current) { setHits(r.hits); setError(null); }
      } catch (e) { if (n === seq.current) setError((e as Error).message); }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-3">
      <label htmlFor="dict-q" className="sr-only">Search the dictionary</label>
      <input id="dict-q" type="search" className="input text-lg" placeholder="bonjour · to eat · खाना · mangeons" value={q} onChange={(e) => setQ(e.target.value)} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} lang="fr" />
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {hits === null && !q.trim() && (
        <div className="card text-sm text-muted">
          <p className="mb-2">Try:</p>
          <div className="flex flex-wrap gap-2">
            {["être", "mangeons", "allé", "to rent", "घर", "boulangerie", "etudiant", "yeux"].map((s) => <button key={s} type="button" className="chip" onClick={() => setQ(s)}>{s}</button>)}
          </div>
        </div>
      )}
      <div aria-live="polite" className="sr-only">{hits ? `${hits.length} results` : ""}</div>
      {hits?.length === 0 && <p className="card">No entry for “{q}”. You can still add it with your own meaning on <Link className="underline" href={`/words?add=${encodeURIComponent(q.trim())}`}>My words</Link>.</p>}
      <ul className="space-y-2">
        {hits?.map((h) => (
          <li key={h.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/dictionary/${encodeURIComponent(h.id)}`} className="text-lg font-semibold underline-offset-2 hover:underline" lang="fr">{h.lemma}</Link>
              <span className="text-xs text-muted">{h.pos}{h.gender ? ` · ${GENDER[h.gender]}` : ""} · {h.level}</span>
              {MATCH_LABEL[h.match] && <span className="chip text-xs">{h.note ?? MATCH_LABEL[h.match]}</span>}
              <span className="ml-auto flex items-center gap-1"><Speak text={h.lemma} showSlow={false} /><SaveWordButton word={{ fr: h.lemma, en: h.en.join(", "), hi: h.hi.join(", "), gender: h.gender, entryId: h.id }} source="dictionary" /></span>
            </div>
            <p className="mt-1"><span className="text-xs text-muted">English: </span>{h.en.join("; ")}</p>
            <p><span className="text-xs text-muted">Hindi meaning: </span><span lang="hi" className="deva">{h.hi.join("; ")}</span></p>
            <div className="mt-1"><Pron pron={h.pron} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
