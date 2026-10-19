"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { TimeZoneSelect } from "./time-zone-select";
import { Bi, useBiLabel } from "./bi";

type Prefs = {
  displayName: string; explanationLang: "en" | "hi" | "both"; dailyMinutes: 45 | 90 | 150 | 180; pace: "compact" | "complete";
  examDate: string | null; examVariant: string; desiredOutcome: string; micOptIn: boolean; slowAudioDefault: boolean;
  devanagariMode: "auto" | "always" | "never"; showIpa: boolean; keepRecordings: boolean; timezone: string; startDate: string;
};
type Rec = { id: string; kind: string; ref: string; mime: string; createdAt: string };

/** Hindi names for the exam options (the English names come from the server). */
export const EXAM_VARIANT_HI: Record<string, string> = {
  tef_canada: "TEF Canada (कनाडा में इमिग्रेशन और नागरिकता)", tefaq: "TEFAQ (क्यूबेक इमिग्रेशन)", tef_etudes: "TEF Études (फ़्रांस में पढ़ाई)",
  tef_naturalisation: "TEF Naturalisation (फ़्रांस की नागरिकता)", tef_irn: "TEF IRN (एकीकरण, निवास, नागरिकता — फ़्रांस)", undecided: "अभी तय नहीं",
};

export function SettingsForm({ initial, variants, isGuest }: { initial: Prefs; variants: { id: string; en: string; supported: boolean }[]; isGuest: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const L = useBiLabel();
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => { setP((x) => ({ ...x, [k]: v })); setMsg(null); };
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);
  const turningOffRecordings = initial.keepRecordings && !p.keepRecordings;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const { startDate: _s, ...patch } = p; // eslint-disable-line @typescript-eslint/no-unused-vars
      await api("/api/profile", { method: "PATCH", body: { ...patch, examDate: p.examDate || null } });
      setMsg({ ok: true, text: L({ en: "Saved.", hi: "सहेजा गया।" }) });
      router.refresh();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="card space-y-4" aria-labelledby="prefs-h">
        <h2 id="prefs-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "Learning preferences", hi: "सीखने की पसंद" }} /></h2>
        <label className="block text-sm font-medium">{L({ en: "Name (optional)", hi: "नाम (वैकल्पिक)" })}
          <input className="input mt-1" value={p.displayName} maxLength={60} onChange={(e) => set("displayName", e.target.value)} />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">{L({ en: "Explanations in", hi: "समझाने की भाषा" })}</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {([["both", "English and Hindi · अंग्रेज़ी और हिंदी"], ["en", "English · अंग्रेज़ी"], ["hi", "Hindi · हिंदी"]] as const).map(([v, l]) => <label key={v} className="flex items-center gap-1"><input type="radio" name="lang" checked={p.explanationLang === v} onChange={() => set("explanationLang", v)} /> {l}</label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">{L({ en: "Devanagari pronunciation guides", hi: "देवनागरी में उच्चारण संकेत" })}</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {([["auto", { en: "Follow the course (fade out over time)", hi: "पाठ्यक्रम के हिसाब से (धीरे-धीरे कम होंगे)" }], ["always", { en: "Always show", hi: "हमेशा दिखाएँ" }], ["never", { en: "Never show", hi: "कभी न दिखाएँ" }]] as const).map(([v, l]) => <label key={v} className="flex items-center gap-1"><input type="radio" name="deva" checked={p.devanagariMode === v} onChange={() => set("devanagariMode", v)} /> {L(l)}</label>)}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.showIpa} onChange={(e) => set("showIpa", e.target.checked)} /> {L({ en: "Show IPA (phonetic alphabet)", hi: "IPA (ध्वन्यात्मक वर्णमाला) दिखाएँ" })}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.slowAudioDefault} onChange={(e) => set("slowAudioDefault", e.target.checked)} /> {L({ en: "Offer slow audio by default", hi: "धीमा ऑडियो पहले से उपलब्ध रखें" })}</label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">{L({ en: "Daily study time", hi: "रोज़ पढ़ाई का समय" })}
            <select className="input mt-1" value={p.dailyMinutes} onChange={(e) => set("dailyMinutes", Number(e.target.value) as Prefs["dailyMinutes"])}>
              {[45, 90, 150, 180].map((m) => <option key={m} value={m}>{L({ en: `${m} minutes`, hi: `${m} मिनट` })}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">{L({ en: "Pace with less time", hi: "कम समय होने पर रफ़्तार" })}
            <select className="input mt-1" value={p.pace} onChange={(e) => set("pace", e.target.value as Prefs["pace"])}>
              <option value="complete">{L({ en: "Complete every lesson (takes more days)", hi: "हर पाठ पूरा करें (ज़्यादा दिन लगेंगे)" })}</option>
              <option value="compact">{L({ en: "Trim lessons to fit the day", hi: "पाठ को दिन के समय के हिसाब से छोटा करें" })}</option>
            </select>
          </label>
          <label className="block text-sm font-medium">{L({ en: "Exam date (optional)", hi: "परीक्षा की तारीख़ (वैकल्पिक)" })}
            <input type="date" className="input mt-1" min={p.startDate} value={p.examDate ?? ""} onChange={(e) => set("examDate", e.target.value || null)} />
          </label>
          <label className="block text-sm font-medium">{L({ en: "Exam", hi: "परीक्षा" })}
            <select className="input mt-1" value={p.examVariant} onChange={(e) => set("examVariant", e.target.value)}>
              {variants.map((v) => <option key={v.id} value={v.id}>{L({ en: `${v.en}${v.supported ? "" : " (not supported yet)"}`, hi: `${EXAM_VARIANT_HI[v.id] ?? v.en}${v.supported ? "" : " (अभी उपलब्ध नहीं)"}` })}</option>)}
            </select>
          </label>
          <TimeZoneSelect value={p.timezone} onChange={(z) => set("timezone", z)} />
        </div>
        <label className="block text-sm font-medium">{L({ en: "Your goal (optional)", hi: "आपका लक्ष्य (वैकल्पिक)" })}
          <input className="input mt-1" value={p.desiredOutcome} maxLength={300} onChange={(e) => set("desiredOutcome", e.target.value)} />
        </label>
        <Bi className="text-xs text-muted" t={{ en: `Changing daily time or pace changes how future days are split; days you have finished stay finished. The course start date (${p.startDate}) is fixed; use the recovery plan on Today to shift the schedule.`, hi: `रोज़ का समय या रफ़्तार बदलने से आगे के दिनों का बँटवारा बदलता है; जो दिन आप पूरे कर चुके हैं, वे पूरे ही रहेंगे। पाठ्यक्रम शुरू होने की तारीख़ (${p.startDate}) तय है; योजना आगे खिसकाने के लिए “आज” पेज पर वापसी की योजना इस्तेमाल करें।` }} />

        <h2 className="pt-2 text-lg font-semibold"><Bi as="span" t={{ en: "Microphone and recordings", hi: "माइक्रोफ़ोन और रिकॉर्डिंग" }} /></h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={p.micOptIn} onChange={(e) => set("micOptIn", e.target.checked)} /> <Bi as="span" t={{ en: "Use the microphone for speaking practice. Your browser will still ask for permission.", hi: "बोलने के अभ्यास के लिए माइक्रोफ़ोन इस्तेमाल करें। आपका ब्राउज़र फिर भी अनुमति माँगेगा।" }} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={p.keepRecordings} onChange={(e) => set("keepRecordings", e.target.checked)} /> <Bi as="span" t={{ en: "Keep my recordings on the server so I can listen to them later. Off by default: recordings are otherwise played back in your browser and never stored.", hi: "मेरी रिकॉर्डिंग सर्वर पर रखें ताकि मैं उन्हें बाद में सुन सकूँ। यह पहले से बंद है: वरना रिकॉर्डिंग सिर्फ़ आपके ब्राउज़र में चलाई जाती हैं और कभी सहेजी नहीं जातीं।" }} /></label>
        {turningOffRecordings && <div role="alert" className="rounded-lg border border-saffron-500 p-2 text-sm"><Bi t={{ en: "Saving with this turned off deletes all your kept recordings.", hi: "इसे बंद करके सहेजने पर आपकी सारी रखी हुई रिकॉर्डिंग मिट जाएँगी।" }} /></div>}

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={!dirty || busy}><Bi as="span" t={busy ? { en: "Saving…", hi: "सहेजा जा रहा है…" } : { en: "Save changes", hi: "बदलाव सहेजें" }} /></button>
          {msg && <span role="status" className={`text-sm ${msg.ok ? "" : "text-red-700 dark:text-red-300"}`}>{msg.text}</span>}
        </div>
      </form>

      <Recordings enabled={initial.keepRecordings} />
      <DataSection isGuest={isGuest} />
    </div>
  );
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
      <h2 id="rec-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "Kept recordings", hi: "रखी हुई रिकॉर्डिंग" }} /></h2>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {recs === null && !error && <Bi className="text-sm text-muted" t={{ en: "Loading…", hi: "लोड हो रहा है…" }} />}
      {recs?.length === 0 && <Bi className="text-sm text-muted" t={enabled ? { en: "No recordings kept yet.", hi: "अभी कोई रिकॉर्डिंग नहीं रखी गई है।" } : { en: "None. Keeping recordings is turned off.", hi: "कोई नहीं। रिकॉर्डिंग रखना बंद है।" }} />}
      {recs && recs.length > 0 && (
        <>
          <ul className="space-y-2">
            {recs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-40">{r.kind} · {r.ref} · {new Date(r.createdAt).toLocaleString()}</span>
                <audio controls preload="none" src={`/api/recordings/${r.id}`} className="h-8" />
                <a className="underline" href={`/api/recordings/${r.id}`} download><Bi as="span" t={{ en: "Download", hi: "डाउनलोड करें" }} /></a>
                <button type="button" className="underline" onClick={() => del(r.id)}><Bi as="span" t={{ en: "Delete", hi: "मिटाएँ" }} /></button>
              </li>
            ))}
          </ul>
          {confirmAll
            ? <p className="text-sm"><Bi as="span" t={{ en: `Delete all ${recs.length} recordings?`, hi: `सभी ${recs.length} रिकॉर्डिंग मिटाएँ?` }} /> <button type="button" className="btn btn-primary btn-sm" onClick={delAll}><Bi as="span" t={{ en: "Yes, delete all", hi: "हाँ, सब मिटाएँ" }} /></button> <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmAll(false)}><Bi as="span" t={{ en: "Cancel", hi: "रद्द करें" }} /></button></p>
            : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmAll(true)}><Bi as="span" t={{ en: "Delete all recordings", hi: "सारी रिकॉर्डिंग मिटाएँ" }} /></button>}
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
  const L = useBiLabel();
  const del = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api("/api/account/delete", { body: { confirm, password: isGuest ? undefined : password } }); window.location.href = "/?deleted=1"; }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return (
    <section className="card space-y-3" aria-labelledby="data-h">
      <h2 id="data-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "Your data", hi: "आपका डेटा" }} /></h2>
      <Bi className="text-sm" t={{ en: "Download everything stored about you: profile, progress, answers, words and review history, writing, speaking transcripts, mistakes, practice exams and saved web texts.", hi: "आपके बारे में सहेजी गई हर चीज़ डाउनलोड करें: प्रोफ़ाइल, प्रगति, उत्तर, शब्द और दोहराव का इतिहास, लेखन, बोलने की ट्रांसक्रिप्ट, ग़लतियाँ, परीक्षा अभ्यास और सहेजे गए वेब पाठ।" }} />
      <a className="btn btn-secondary" href="/api/account/export" download><Bi as="span" t={{ en: "Download my data (JSON)", hi: "मेरा डेटा डाउनलोड करें (JSON)" }} /></a>
      <form action="/api/auth/signout" method="post"><button className="btn btn-secondary"><Bi as="span" t={{ en: "Sign out", hi: "साइन आउट करें" }} /></button></form>
      <div className="border-t border-app pt-3">
        {!open ? <button type="button" className="btn btn-sm text-red-700 underline dark:text-red-300" onClick={() => setOpen(true)}><Bi as="span" t={{ en: "Delete my account…", hi: "मेरा खाता मिटाएँ…" }} /></button> : (
          <form onSubmit={del} className="space-y-2 rounded-lg border border-red-500 p-3">
            <Bi className="text-sm font-medium" t={{ en: "This permanently deletes your account and all your data. It cannot be undone. Download your data first if you want a copy.", hi: "इससे आपका खाता और आपका सारा डेटा हमेशा के लिए मिट जाएगा। इसे वापस नहीं लाया जा सकता। अगर आपको एक कॉपी चाहिए, तो पहले अपना डेटा डाउनलोड कर लें।" }} />
            <label className="block text-sm">{L({ en: "Type DELETE to confirm", hi: "पुष्टि के लिए DELETE लिखें" })}
              <input className="input mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </label>
            {!isGuest && <label className="block text-sm">{L({ en: "Your password", hi: "आपका पासवर्ड" })}
              <input type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>}
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary bg-red-700" disabled={busy || confirm.trim().toLowerCase() !== "delete" || (!isGuest && !password)}><Bi as="span" t={busy ? { en: "Deleting…", hi: "मिटाया जा रहा है…" } : { en: "Delete everything", hi: "सब कुछ मिटाएँ" }} /></button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><Bi as="span" t={{ en: "Cancel", hi: "रद्द करें" }} /></button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
