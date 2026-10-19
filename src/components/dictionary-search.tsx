"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Speak } from "./audio";
import { Pron } from "./fr-item";
import { SaveWordButton } from "./save-word";
import { Bi, useBiLabel } from "./bi";
import { posBi } from "@/app/(app)/dictionary/labels";

type Hit = { id: string; lemma: string; pos: string; gender?: string; en: string[]; hi: string[]; pron?: string; level: string; match: string; note?: string };

const MATCH_LABEL: Record<string, { en: string; hi: string } | null> = {
  lemma: null,
  form: { en: "verb form", hi: "क्रिया का रूप" },
  plural_feminine: { en: "plural/feminine", hi: "बहुवचन/स्त्रीलिंग" },
  misspelling: { en: "spelling corrected", hi: "वर्तनी सुधारी गई" },
  prefix: { en: "starts with", hi: "इससे शुरू" },
  phrase: { en: "in a phrase", hi: "वाक्यांश में" },
  fuzzy: { en: "close spelling", hi: "मिलती-जुलती वर्तनी" },
};
const GENDER: Record<string, { en: string; hi: string }> = { m: { en: "masc.", hi: "पुल्लिंग" }, f: { en: "fem.", hi: "स्त्रीलिंग" }, mf: { en: "masc./fem.", hi: "पुल्लिंग/स्त्रीलिंग" } };

export function DictionarySearch({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const label = useBiLabel();

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
      <label htmlFor="dict-q" className="sr-only">{label({ en: "Search the dictionary", hi: "शब्दकोश में खोजें" })}</label>
      <input id="dict-q" type="search" className="input text-lg" placeholder="bonjour · to eat · खाना · mangeons" value={q} onChange={(e) => setQ(e.target.value)} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} lang="fr" />
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {hits === null && !q.trim() && (
        <div className="card text-sm text-muted">
          <Bi className="mb-2" t={{ en: "Try:", hi: "इन्हें आज़माएँ:" }} />
          <div className="flex flex-wrap gap-2">
            {["être", "mangeons", "allé", "to rent", "घर", "boulangerie", "etudiant", "yeux"].map((s) => <button key={s} type="button" className="chip" onClick={() => setQ(s)}>{s}</button>)}
          </div>
        </div>
      )}
      <div aria-live="polite" className="sr-only">{hits ? label({ en: `${hits.length} results`, hi: `${hits.length} परिणाम` }) : ""}</div>
      {hits?.length === 0 && (
        <p className="card">
          <Bi as="span" t={{ en: `No entry for “${q}”. You can still add it with your own meaning on`, hi: `“${q}” के लिए कोई प्रविष्टि नहीं मिली। आप इसे अपने अर्थ के साथ यहाँ जोड़ सकते हैं:` }} />{" "}
          <Link className="underline" href={`/words?add=${encodeURIComponent(q.trim())}`}><Bi as="span" t={{ en: "My words", hi: "मेरे शब्द" }} /></Link>.
        </p>
      )}
      <ul className="space-y-2">
        {hits?.map((h) => (
          <li key={h.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/dictionary/${encodeURIComponent(h.id)}`} className="text-lg font-semibold underline-offset-2 hover:underline" lang="fr">{h.lemma}</Link>
              <span className="text-xs text-muted">{label(posBi(h.pos))}{h.gender ? ` · ${label(GENDER[h.gender])}` : ""} · {h.level}</span>
              {MATCH_LABEL[h.match] && <span className="chip text-xs">{label({ en: h.note ?? MATCH_LABEL[h.match]!.en, hi: MATCH_LABEL[h.match]!.hi })}</span>}
              <span className="ml-auto flex items-center gap-1"><Speak text={h.lemma} showSlow={false} /><SaveWordButton word={{ fr: h.lemma, en: h.en.join(", "), hi: h.hi.join(", "), gender: h.gender, entryId: h.id }} source="dictionary" /></span>
            </div>
            <p className="mt-1"><Bi as="span" className="text-xs text-muted" t={{ en: "English", hi: "अंग्रेज़ी" }} />: {h.en.join("; ")}</p>
            <p><Bi as="span" className="text-xs text-muted" t={{ en: "Hindi meaning", hi: "हिंदी अर्थ" }} />: <span lang="hi" className="deva">{h.hi.join("; ")}</span></p>
            <div className="mt-1"><Pron pron={h.pron} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
