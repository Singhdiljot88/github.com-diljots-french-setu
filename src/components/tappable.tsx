"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SaveWordButton } from "./save-word";
import { Speak } from "./audio";
import { Bi, useBiLabel } from "./bi";
import { posBi } from "@/app/(app)/dictionary/labels";

type Hit = { id: string; lemma: string; pos: string; gender?: string; en: string[]; hi: string[]; pron?: string; note?: string; match: string };
const GENDER: Record<string, { en: string; hi: string }> = { m: { en: "m", hi: "पुल्लिंग" }, f: { en: "f", hi: "स्त्रीलिंग" }, mf: { en: "mf", hi: "पुल्लिंग/स्त्रीलिंग" } };
const MATCH_HI: Record<string, string | undefined> = { form: "क्रिया का रूप", plural_feminine: "बहुवचन/स्त्रीलिंग रूप", misspelling: "वर्तनी सुधारी गई", prefix: "इससे शुरू", phrase: "वाक्यांश में", fuzzy: "मिलती-जुलती वर्तनी" };

/** French text where every word can be tapped to open a dictionary card. */
export function TappableText({ text, sourceRef, disabled = false, hint = true }: { text: string; sourceRef?: string; disabled?: boolean; hint?: boolean }) {
  const [sel, setSel] = useState<{ word: string; hits: Hit[] | null; error?: string } | null>(null);
  const label = useBiLabel();
  if (disabled) return <div lang="fr" className="whitespace-pre-wrap leading-relaxed">{text}</div>;
  const open = async (word: string) => {
    setSel({ word, hits: null });
    try {
      const r = await api<{ hits: Hit[] }>(`/api/dictionary?q=${encodeURIComponent(word)}`);
      setSel({ word, hits: r.hits.slice(0, 3) });
    } catch (e) { setSel({ word, hits: [], error: (e as Error).message }); }
  };
  const tokens = text.split(/([\p{L}\p{M}'’-]+)/u);
  return (
    <div data-tappable>
      {hint && <Bi className="mb-1 text-xs text-muted" t={{ en: "Tap any word to look it up.", hi: "किसी भी शब्द पर टैप करके उसका अर्थ देखें।" }} />}
      <div lang="fr" className="whitespace-pre-wrap leading-relaxed">
        {tokens.map((t, i) => /[\p{L}]/u.test(t)
          ? <button key={i} type="button" className="rounded hover:bg-brand-100 focus:bg-brand-100 dark:hover:bg-brand-900" onClick={() => open(t.replace(/^(l|d|j|m|t|s|n|qu|c)['’]/i, ""))}>{t}</button>
          : <span key={i}>{t}</span>)}
      </div>
      {sel && (
        <div className="card mt-3 border-brand-500/50" role="dialog" aria-label={label({ en: `Dictionary: ${sel.word}`, hi: `शब्दकोश: ${sel.word}` })}>
          <div className="flex items-center justify-between"><p className="font-semibold" lang="fr">{sel.word}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(null)} aria-label={label({ en: "Close dictionary card", hi: "शब्दकोश कार्ड बंद करें" })}>✕</button></div>
          {sel.hits === null && <Bi className="text-sm text-muted" t={{ en: "Looking up…", hi: "खोज रहे हैं…" }} />}
          {sel.hits?.length === 0 && (
            <p className="text-sm">
              <Bi as="span" t={{ en: `No dictionary entry found${sel.error ? ` (${sel.error})` : ""}. You can still save it with your own meaning in`, hi: `${sel.error ? "शब्दकोश खोला नहीं जा सका।" : "शब्दकोश में यह शब्द नहीं मिला।"} आप इसे अपने अर्थ के साथ यहाँ सहेज सकते हैं:` }} />{" "}
              <Link className="underline" href={`/words?add=${encodeURIComponent(sel.word)}`}><Bi as="span" t={{ en: "My words", hi: "मेरे शब्द" }} /></Link>.
            </p>
          )}
          <ul className="space-y-2">
            {sel.hits?.map((h) => (
              <li key={h.id} className="border-t border-app pt-2 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dictionary/${encodeURIComponent(h.id)}`} className="font-medium underline" lang="fr">{h.lemma}</Link>
                  <span className="text-xs text-muted">{label(posBi(h.pos))}{h.gender ? ` · ${label(GENDER[h.gender] ?? { en: h.gender })}` : ""}</span>
                  <Speak text={h.lemma} showSlow={false} />
                  <SaveWordButton word={{ fr: h.lemma, en: h.en.join(", "), hi: h.hi.join(", "), gender: h.gender, entryId: h.id }} source="dictionary" sourceRef={sourceRef} />
                </div>
                {h.note && <p className="text-xs text-muted">{label({ en: h.note, hi: MATCH_HI[h.match] })}</p>}
                <Bi className="text-sm" as="div" t={{ en: h.en.join("; "), hi: h.hi.join("; ") }} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
