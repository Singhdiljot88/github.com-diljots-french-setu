"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Speak } from "./audio";
import { AccentBar } from "./accent-bar";
import { Bi, useBiLabel } from "./bi";
import type { Scene } from "@/lib/coach-demo";

type ScenePack = { isDemo: boolean; label: { en: string; hi: string }; title: { en: string; hi: string }; scene: Scene };
type Reply = { isDemo: boolean; label: { en: string; hi: string }; ok: boolean; corrected: string; en: string; hi: string };

export function SituationRoleplay({ id }: { id: string }) {
  const [pack, setPack] = useState<ScenePack | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const L = useBiLabel();
  const open = async () => {
    setBusy(true); setErr(null); setReply(null);
    try { setPack(await api<ScenePack>("/api/situations/roleplay", { body: { id } })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not start."); }
    finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true); setErr(null);
    try { setReply(await api<Reply>("/api/situations/reply", { body: { id, text } })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not check that line."); }
    finally { setBusy(false); }
  };
  if (!pack) {
    return (
      <div className="space-y-1">
        <button type="button" className="btn btn-secondary btn-sm" onClick={open} disabled={busy}><Bi as="span" t={busy ? { en: "Starting…", hi: "शुरू हो रहा है…" } : { en: "Role-play", hi: "भूमिका" }} /></button>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      </div>
    );
  }
  return (
    <section className="reveal-in space-y-3 rounded-xl surface-2 p-3">
      <h3 className="font-semibold"><Bi as="span" t={{ en: `Role-play · ${pack.title.en}`, hi: `भूमिका · ${pack.title.hi}` }} /></h3>
      <p className="flex flex-wrap items-center gap-2 text-lg" lang="fr"><span>{pack.scene.openingFr}</span><Speak text={pack.scene.openingFr} /></p>
      <Bi className="text-sm" t={{ en: pack.scene.openingEn, hi: pack.scene.openingHi }} />
      <Bi className="text-sm text-muted" t={{ en: `Your aim: ${pack.scene.goalEn}`, hi: `आपका लक्ष्य: ${pack.scene.goalHi}` }} />
      <ul className="space-y-1 text-sm">
        {pack.scene.prompts.map((p) => (
          <li key={p.fr} lang="fr"><span className="font-medium">{p.fr}</span> <span className="text-muted">· {p.en}</span></li>
        ))}
      </ul>
      <label className="block text-sm font-medium" htmlFor={`rp-${id}`}><Bi as="span" t={{ en: "Your line, in French", hi: "आपकी पंक्ति, फ़्रेंच में" }} /></label>
      <textarea id={`rp-${id}`} className="input min-h-24" lang="fr" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={L({ en: "Reply in French", hi: "फ़्रेंच में जवाब दें" })} />
      <AccentBar targetId={`rp-${id}`} />
      <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !text.trim()}><Bi as="span" t={busy ? { en: "Checking…", hi: "जाँच हो रही है…" } : { en: "Check my line", hi: "मेरी पंक्ति जाँचें" }} /></button>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {reply && (
        <div className={`reveal-in rounded-lg p-3 text-sm ${reply.ok ? "answer-ok" : "answer-no"}`} role="status">
          <p lang="fr" className="font-semibold">{reply.corrected}</p>
          <Bi t={{ en: reply.en, hi: reply.hi }} />
          <Bi className="mt-1 text-xs text-muted" t={reply.label} />
        </div>
      )}
      <Bi className="text-xs text-muted" t={pack.label} />
    </section>
  );
}
