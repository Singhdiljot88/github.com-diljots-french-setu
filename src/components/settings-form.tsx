"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

type Prefs = {
  displayName: string; explanationLang: "en" | "hi" | "both"; dailyMinutes: 45 | 90 | 150 | 180; pace: "compact" | "complete";
  examDate: string | null; examVariant: string; desiredOutcome: string; micOptIn: boolean; slowAudioDefault: boolean;
  devanagariMode: "auto" | "always" | "never"; showIpa: boolean; keepRecordings: boolean; timezone: string; startDate: string;
};
type Rec = { id: string; kind: string; ref: string; mime: string; createdAt: string };

export function SettingsForm({ initial, variants, isGuest }: { initial: Prefs; variants: { id: string; en: string; supported: boolean }[]; isGuest: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => { setP((x) => ({ ...x, [k]: v })); setMsg(null); };
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);
  const turningOffRecordings = initial.keepRecordings && !p.keepRecordings;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const { startDate: _s, ...patch } = p; // eslint-disable-line @typescript-eslint/no-unused-vars
      await api("/api/profile", { method: "PATCH", body: { ...patch, examDate: p.examDate || null } });
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="card space-y-4" aria-labelledby="prefs-h">
        <h2 id="prefs-h" className="text-lg font-semibold">Learning preferences</h2>
        <label className="block text-sm font-medium">Name (optional)
          <input className="input mt-1" value={p.displayName} maxLength={60} onChange={(e) => set("displayName", e.target.value)} />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Explanations in</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {([["both", "English and Hindi"], ["en", "English"], ["hi", "Hindi (हिंदी)"]] as const).map(([v, l]) => <label key={v} className="flex items-center gap-1"><input type="radio" name="lang" checked={p.explanationLang === v} onChange={() => set("explanationLang", v)} /> {l}</label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Devanagari pronunciation guides</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {([["auto", "Follow the course (fade out over time)"], ["always", "Always show"], ["never", "Never show"]] as const).map(([v, l]) => <label key={v} className="flex items-center gap-1"><input type="radio" name="deva" checked={p.devanagariMode === v} onChange={() => set("devanagariMode", v)} /> {l}</label>)}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.showIpa} onChange={(e) => set("showIpa", e.target.checked)} /> Show IPA (phonetic alphabet)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.slowAudioDefault} onChange={(e) => set("slowAudioDefault", e.target.checked)} /> Offer slow audio by default</label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Daily study time
            <select className="input mt-1" value={p.dailyMinutes} onChange={(e) => set("dailyMinutes", Number(e.target.value) as Prefs["dailyMinutes"])}>
              {[45, 90, 150, 180].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Pace with less time
            <select className="input mt-1" value={p.pace} onChange={(e) => set("pace", e.target.value as Prefs["pace"])}>
              <option value="complete">Complete every lesson (takes more days)</option>
              <option value="compact">Trim lessons to fit the day</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Exam date (optional)
            <input type="date" className="input mt-1" min={p.startDate} value={p.examDate ?? ""} onChange={(e) => set("examDate", e.target.value || null)} />
          </label>
          <label className="block text-sm font-medium">Exam
            <select className="input mt-1" value={p.examVariant} onChange={(e) => set("examVariant", e.target.value)}>
              {variants.map((v) => <option key={v.id} value={v.id}>{v.en}{v.supported ? "" : " (not supported yet)"}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Time zone
            <input className="input mt-1" value={p.timezone} onChange={(e) => set("timezone", e.target.value)} list="tz-list" />
            <TzList />
          </label>
        </div>
        <label className="block text-sm font-medium">Your goal (optional)
          <input className="input mt-1" value={p.desiredOutcome} maxLength={300} onChange={(e) => set("desiredOutcome", e.target.value)} />
        </label>
        <p className="text-xs text-muted">Changing daily time or pace changes how future days are split; days you have finished stay finished. The course start date ({p.startDate}) is fixed; use the recovery plan on Today to shift the schedule.</p>

        <h2 className="pt-2 text-lg font-semibold">Microphone and recordings</h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={p.micOptIn} onChange={(e) => set("micOptIn", e.target.checked)} /> <span>Use the microphone for speaking practice. Your browser will still ask for permission.</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={p.keepRecordings} onChange={(e) => set("keepRecordings", e.target.checked)} /> <span>Keep my recordings on the server so I can listen to them later. Off by default: recordings are otherwise played back in your browser and never stored.</span></label>
        {turningOffRecordings && <p role="alert" className="rounded-lg border border-saffron-500 p-2 text-sm">Saving with this turned off deletes all your kept recordings.</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</button>
          {msg && <span role="status" className={`text-sm ${msg.ok ? "" : "text-red-700 dark:text-red-300"}`}>{msg.text}</span>}
        </div>
      </form>

      <Recordings enabled={initial.keepRecordings} />
      <DataSection isGuest={isGuest} />
    </div>
  );
}

function TzList() {
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => {
    try { setZones((Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []); } catch { /* older browsers */ }
  }, []);
  return <datalist id="tz-list">{zones.map((z) => <option key={z} value={z} />)}</datalist>;
}

function Recordings({ enabled }: { enabled: boolean }) {
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  useEffect(() => { api<{ recordings: Rec[] }>("/api/recordings").then((r) => setRecs(r.recordings)).catch((e) => setError(e.message)); }, []);
  const del = async (id: string) => { await api(`/api/recordings/${id}`, { method: "DELETE" }); setRecs((r) => r?.filter((x) => x.id !== id) ?? null); };
  const delAll = async () => { await api("/api/recordings", { method: "DELETE" }); setRecs([]); setConfirmAll(false); };
  return (
    <section className="card space-y-2" aria-labelledby="rec-h">
      <h2 id="rec-h" className="text-lg font-semibold">Kept recordings</h2>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {recs === null && !error && <p className="text-sm text-muted">Loading…</p>}
      {recs?.length === 0 && <p className="text-sm text-muted">{enabled ? "No recordings kept yet." : "None. Keeping recordings is turned off."}</p>}
      {recs && recs.length > 0 && (
        <>
          <ul className="space-y-2">
            {recs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-40">{r.kind} · {r.ref} · {new Date(r.createdAt).toLocaleString()}</span>
                <audio controls preload="none" src={`/api/recordings/${r.id}`} className="h-8" />
                <a className="underline" href={`/api/recordings/${r.id}`} download>Download</a>
                <button type="button" className="underline" onClick={() => del(r.id)}>Delete</button>
              </li>
            ))}
          </ul>
          {confirmAll
            ? <p className="text-sm">Delete all {recs.length} recordings? <button type="button" className="btn btn-primary btn-sm" onClick={delAll}>Yes, delete all</button> <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmAll(false)}>Cancel</button></p>
            : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmAll(true)}>Delete all recordings</button>}
        </>
      )}
    </section>
  );
}

function DataSection({ isGuest }: { isGuest: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const del = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api("/api/account/delete", { body: { confirm, password: isGuest ? undefined : password } }); window.location.href = "/?deleted=1"; }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return (
    <section className="card space-y-3" aria-labelledby="data-h">
      <h2 id="data-h" className="text-lg font-semibold">Your data</h2>
      <p className="text-sm">Download everything stored about you: profile, progress, answers, words and review history, writing, speaking transcripts, mistakes, practice exams and saved web texts.</p>
      <a className="btn btn-secondary" href="/api/account/export" download>Download my data (JSON)</a>
      <form action="/api/auth/signout" method="post"><button className="btn btn-secondary">Sign out</button></form>
      <div className="border-t border-app pt-3">
        {!open ? <button type="button" className="btn btn-sm text-red-700 underline dark:text-red-300" onClick={() => setOpen(true)}>Delete my account…</button> : (
          <form onSubmit={del} className="space-y-2 rounded-lg border border-red-500 p-3">
            <p className="text-sm font-medium">This permanently deletes your account and all your data. It cannot be undone. Download your data first if you want a copy.</p>
            <label className="block text-sm">Type DELETE to confirm
              <input className="input mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </label>
            {!isGuest && <label className="block text-sm">Your password
              <input type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>}
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary bg-red-700" disabled={busy || confirm.trim().toLowerCase() !== "delete" || (!isGuest && !password)}>{busy ? "Deleting…" : "Delete everything"}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
