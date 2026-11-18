"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Bi, useBiLabel } from "./bi";

type Explain = { isDemo: boolean; label: { en: string; hi: string }; result: { focus: string; en: string; hi: string } };

export function ExplainButton({ fr, en, hi, context }: { fr: string; en?: string; hi?: string; context?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Explain | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const L = useBiLabel();
  const load = async () => {
    setOpen(true);
    if (data || busy) return;
    setBusy(true); setErr(null);
    try { setData(await api<Explain>("/api/explain", { body: { fr, en, hi, context } })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not explain that."); }
    finally { setBusy(false); }
  };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className="btn btn-ghost btn-sm" onClick={load} aria-expanded={open} disabled={busy}>
        <Bi as="span" t={busy ? { en: "Explaining…", hi: "समझाया जा रहा है…" } : { en: "Explain", hi: "समझाएँ" }} />
      </button>
      {open && (
        <span className="reveal-in block max-w-prose rounded-lg surface-2 p-2 text-sm" role="status">
          {err && <span className="text-red-700 dark:text-red-300">{err}</span>}
          {data && (
            <>
              <span className="chip mb-1" lang="fr">{data.result.focus}</span>
              <Bi t={{ en: data.result.en, hi: data.result.hi }} />
              <Bi className="mt-1 text-xs text-muted" t={data.label} />
            </>
          )}
          <button type="button" className="mt-1 text-xs underline" onClick={() => setOpen(false)}>{L({ en: "Close", hi: "बंद करें" })}</button>
        </span>
      )}
    </span>
  );
}
