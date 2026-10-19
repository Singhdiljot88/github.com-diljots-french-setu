"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Bi, useBiLabel } from "./bi";

export type SaveWordInput = { fr: string; en: string; hi: string; gender?: string; isPhrase?: boolean; lemma?: string; entryId?: string };

export function SaveWordButton({ word, source, sourceRef }: { word: SaveWordInput; source: "lesson" | "web" | "dictionary" | "custom"; sourceRef?: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "exists" | "error">("idle");
  const L = useBiLabel();
  const save = async () => {
    setState("saving");
    try {
      const r = await api<{ created: boolean }>("/api/words", { body: { ...word, source, sourceRef } });
      setState(r.created ? "saved" : "exists");
    } catch { setState("error"); }
  };
  const label = {
    idle: { en: "＋ Save", hi: "＋ सहेजें" }, saving: { en: "Saving…", hi: "सहेजा जा रहा है…" }, saved: { en: "✓ Saved to review", hi: "✓ दोहराव में सहेजा गया" },
    exists: { en: "✓ Already saved", hi: "✓ पहले से सहेजा हुआ" }, error: { en: "Retry save", hi: "फिर से सहेजें" },
  }[state];
  return (
    <button type="button" className="btn btn-ghost btn-sm text-brand-700 dark:text-brand-200" onClick={save} disabled={state === "saving" || state === "saved" || state === "exists"} aria-label={L({ en: `Save “${word.fr}” to my words`, hi: `“${word.fr}” को मेरे शब्द में सहेजें` })} aria-live="polite">
      <Bi as="span" t={label} />
    </button>
  );
}
