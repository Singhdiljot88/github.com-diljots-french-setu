"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SaveWordButton } from "./save-word";
import { Speak } from "./audio";

type Hit = { id: string; lemma: string; pos: string; gender?: string; en: string[]; hi: string[]; pron?: string; note?: string; match: string };

/** French text where every word can be tapped to open a dictionary card. */
export function TappableText({ text, sourceRef, disabled = false, hint = true }: { text: string; sourceRef?: string; disabled?: boolean; hint?: boolean }) {
  const [sel, setSel] = useState<{ word: string; hits: Hit[] | null; error?: string } | null>(null);
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
      {hint && <p className="mb-1 text-xs text-muted">Tap any word to look it up.</p>}
      <div lang="fr" className="whitespace-pre-wrap leading-relaxed">
        {tokens.map((t, i) => /[\p{L}]/u.test(t)
          ? <button key={i} type="button" className="rounded hover:bg-brand-100 focus:bg-brand-100 dark:hover:bg-brand-900" onClick={() => open(t.replace(/^(l|d|j|m|t|s|n|qu|c)['’]/i, ""))}>{t}</button>
          : <span key={i}>{t}</span>)}
      </div>
      {sel && (
        <div className="card mt-3 border-brand-500/50" role="dialog" aria-label={`Dictionary: ${sel.word}`}>
          <div className="flex items-center justify-between"><p className="font-semibold" lang="fr">{sel.word}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(null)} aria-label="Close dictionary card">✕</button></div>
          {sel.hits === null && <p className="text-sm text-muted">Looking up…</p>}
          {sel.hits?.length === 0 && <p className="text-sm">No dictionary entry found{sel.error ? ` (${sel.error})` : ""}. You can still save it with your own meaning on the <Link className="underline" href={`/words?add=${encodeURIComponent(sel.word)}`}>My words</Link> page.</p>}
          <ul className="space-y-2">
            {sel.hits?.map((h) => (
              <li key={h.id} className="border-t border-app pt-2 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dictionary/${encodeURIComponent(h.id)}`} className="font-medium underline" lang="fr">{h.lemma}</Link>
                  <span className="text-xs text-muted">{h.pos}{h.gender ? ` · ${h.gender}` : ""}</span>
                  <Speak text={h.lemma} showSlow={false} />
                  <SaveWordButton word={{ fr: h.lemma, en: h.en.join(", "), hi: h.hi.join(", "), gender: h.gender, entryId: h.id }} source="dictionary" sourceRef={sourceRef} />
                </div>
                {h.note && <p className="text-xs text-muted">{h.note}</p>}
                <p className="text-sm">{h.en.join("; ")} · <span lang="hi" className="deva">{h.hi.join("; ")}</span></p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
