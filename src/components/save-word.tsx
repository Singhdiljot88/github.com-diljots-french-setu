"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";

export type SaveWordInput = { fr: string; en: string; hi: string; gender?: string; isPhrase?: boolean; lemma?: string; entryId?: string };

export function SaveWordButton({ word, source, sourceRef }: { word: SaveWordInput; source: "lesson" | "web" | "dictionary" | "custom"; sourceRef?: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "exists" | "error">("idle");
  const save = async () => {
    setState("saving");
    try {
      const r = await api<{ created: boolean }>("/api/words", { body: { ...word, source, sourceRef } });
      setState(r.created ? "saved" : "exists");
    } catch { setState("error"); }
  };
  const label = { idle: "＋ Save", saving: "Saving…", saved: "✓ Saved to review", exists: "✓ Already saved", error: "Retry save" }[state];
  return (
    <button type="button" className="btn btn-ghost btn-sm text-brand-700 dark:text-brand-200" onClick={save} disabled={state === "saving" || state === "saved" || state === "exists"} aria-label={`Save “${word.fr}” to my words`} aria-live="polite">
      {label}
    </button>
  );
}
