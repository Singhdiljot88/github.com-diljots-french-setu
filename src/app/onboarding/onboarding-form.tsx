"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { expectedProgressNote, courseEndDate, type DailyMinutes, type Pace } from "@/lib/schedule";
import { diffDays } from "@/lib/dates";

const VARIANTS: [string, string][] = [
  ["tef_canada", "TEF Canada — immigration or citizenship in Canada (recommended default)"],
  ["tefaq", "TEFAQ — Québec immigration"],
  ["tef_etudes", "TEF Études — studies in France"],
  ["tef_naturalisation", "TEF Naturalisation — French nationality"],
  ["tef_irn", "TEF IRN — integration, residence, nationality (France)"],
  ["undecided", "Not sure yet"],
];

const PLACEMENT: { q: string; options: string[]; answer: number }[] = [
  { q: "What does « Je m'appelle Anil » mean?", options: ["I live in Anil", "My name is Anil", "I call Anil"], answer: 1 },
  { q: "Choose the correct form: « Nous ___ indiens. »", options: ["sommes", "sont", "êtes"], answer: 0 },
  { q: "« J'ai trente ans » means…", options: ["I have thirty friends", "I am thirty years old", "It is three o'clock"], answer: 1 },
  { q: "Which is the polite way to ask someone's name?", options: ["Tu t'appelles comment ?", "Comment vous appelez-vous ?", "Qui es-tu ?"], answer: 1 },
  { q: "Choose the correct article: « ___ maison »", options: ["le", "la", "les"], answer: 1 },
  { q: "« Je ne mange pas de viande » means…", options: ["I don't eat meat", "I eat a lot of meat", "I want some meat"], answer: 0 },
  { q: "Choose the correct form: « Hier, j'___ mangé au restaurant. »", options: ["ai", "suis", "avais"], answer: 0 },
  { q: "« Il fait froid en hiver à Montréal » is about…", options: ["food", "weather", "work"], answer: 1 },
  { q: "Choose the correct form: « Elle ___ au travail en bus. »", options: ["va", "vais", "allez"], answer: 0 },
  { q: "« Du pain, de la confiture, des œufs » — these words are…", options: ["partitive/plural articles", "possessives", "pronouns"], answer: 0 },
];

function suggestedDay(score: number) { return score >= 9 ? 41 : score >= 7 ? 21 : 1; }

export function OnboardingForm({ defaultTz, today }: { defaultTz: string; today: string }) {
  const router = useRouter();
  const tzGuess = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : defaultTz;
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    displayName: "", explanationLang: "both" as "en" | "hi" | "both", examVariant: "tef_canada", desiredOutcome: "",
    dailyMinutes: 150 as DailyMinutes, pace: "complete" as Pace, startDate: today, examDate: "" as string, timezone: tzGuess || defaultTz,
    experience: "none" as "none" | "other_language" | "some_french", entryPath: "absolute_beginner" as "absolute_beginner" | "placement", placementDay: 1,
    micOptIn: false, keepRecordings: false, slowAudioDefault: true, devanagariMode: "auto" as "auto" | "always" | "never", showIpa: false,
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const zones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [f.timezone]; } catch { return [f.timezone]; }
  }, [f.timezone]);
  const note = expectedProgressNote(f.dailyMinutes, f.pace);
  const end = courseEndDate({ startDate: f.startDate, dailyMinutes: f.dailyMinutes, pace: f.pace, scheduleShiftDays: 0, placementDay: f.placementDay });
  const examTooSoon = f.examDate && diffDays(f.examDate, end) > 0;
  const score = PLACEMENT.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);

  const steps = ["Language", "Exam", "Schedule", "Starting point", "Audio & microphone", "Pronunciation help"];

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api("/api/profile", { body: { ...f, examDate: f.examDate || null } });
      router.push("/today");
      router.refresh();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  const radio = (name: string, value: string, checked: boolean, onChange: () => void, label: React.ReactNode, hint?: React.ReactNode) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${checked ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40" : "border-app"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1" />
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-sm text-muted">{hint}</span>}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Steps">
        {steps.map((s, i) => <li key={s} className={`chip ${i === step ? "bg-brand-600 text-white" : i < step ? "bg-brand-100 text-brand-900" : "surface-2 text-muted"}`} aria-current={i === step ? "step" : undefined}>{i + 1}. {s}</li>)}
      </ol>

      {step === 0 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">How should we explain things?</legend>
          <p lang="hi" className="deva text-muted">हम चीज़ें किस भाषा में समझाएँ?</p>
          {radio("lang", "both", f.explanationLang === "both", () => set("explanationLang", "both"), "English and Hindi", <span lang="hi" className="deva">अंग्रेज़ी और हिंदी दोनों</span>)}
          {radio("lang", "en", f.explanationLang === "en", () => set("explanationLang", "en"), "English")}
          {radio("lang", "hi", f.explanationLang === "hi", () => set("explanationLang", "hi"), <span lang="hi" className="deva">हिंदी</span>, "Explanations in Hindi; French words still show English meanings too.")}
          <label className="block pt-2"><span className="text-sm font-medium">What should we call you? (optional)</span>
            <input className="input mt-1" value={f.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={60} /></label>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">Which exam are you preparing for?</legend>
          <p className="text-sm text-muted">Please confirm. TEF variants have different formats and are kept separate. This app&apos;s exam simulator currently follows the TEF Canada format; for other variants you can still follow the course, but the simulator will say it is not configured for your exam.</p>
          {VARIANTS.map(([v, l]) => radio("variant", v, f.examVariant === v, () => set("examVariant", v), l))}
          <label className="block pt-2"><span className="text-sm font-medium">What result are you hoping for? (optional)</span>
            <input className="input mt-1" placeholder="e.g. NCLC 7 in all skills for Express Entry" value={f.desiredOutcome} onChange={(e) => set("desiredOutcome", e.target.value)} maxLength={300} /></label>
          <p className="text-sm text-muted">We will use this to plan, not to promise. Many beginners need more than 120 days to reach upper-intermediate levels; we will show you honest evidence of your progress along the way.</p>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">How much time can you study each day?</legend>
          {radio("min", "150", f.dailyMinutes === 150, () => set("dailyMinutes", 150), "150 minutes — recommended intensive plan", "15 review · 20 vocabulary & grammar · 25 listening · 25 speaking · 20 reading · 25 writing · 20 correction & assessment")}
          {radio("min", "180", f.dailyMinutes === 180, () => set("dailyMinutes", 180), "180 minutes", "The full plan with extra practice time.")}
          {radio("min", "90", f.dailyMinutes === 90, () => set("dailyMinutes", 90), "90 minutes")}
          {radio("min", "45", f.dailyMinutes === 45, () => set("dailyMinutes", 45), "45 minutes")}
          {f.dailyMinutes < 150 && (
            <div className="space-y-2 rounded-xl surface-2 p-3">
              <p className="text-sm font-medium">With less time, choose how to adjust:</p>
              {radio("pace", "complete", f.pace === "complete", () => set("pace", "complete"), "Complete lessons, longer course", "Each lesson is done in full over several days.")}
              {radio("pace", "compact", f.pace === "compact", () => set("pace", "compact"), "Keep 120 days, lighter lessons", "Fewer exercises each day.")}
            </div>
          )}
          <p className="rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-900/40">{note.en}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="text-sm font-medium">Start date</span><input type="date" className="input mt-1" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} required /></label>
            <label><span className="text-sm font-medium">Exam date (optional)</span><input type="date" className="input mt-1" value={f.examDate} min={f.startDate} onChange={(e) => set("examDate", e.target.value)} /></label>
          </div>
          <label className="block"><span className="text-sm font-medium">Your time zone</span>
            <select className="input mt-1" value={f.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <span className="text-xs text-muted">Days are scheduled by your local date in this time zone.</span>
          </label>
          <p className="text-sm">Planned course end: <strong>{end}</strong>.</p>
          {examTooSoon && <p role="alert" className="rounded-lg bg-saffron-100 p-3 text-sm text-saffron-700">Your exam date is before the planned end of the course. You can still continue — consider more daily time, a later exam date, or focusing on the TEF phases earlier with your teacher.</p>}
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">Where are you starting?</legend>
          {radio("exp", "none", f.experience === "none", () => { set("experience", "none"); set("entryPath", "absolute_beginner"); set("placementDay", 1); }, "I know no French at all", "You start at Day 1. No test needed.")}
          {radio("exp", "other_language", f.experience === "other_language", () => { set("experience", "other_language"); set("entryPath", "absolute_beginner"); set("placementDay", 1); }, "I have learned another language before, but not French", "You start at Day 1; you may move faster through the early days.")}
          {radio("exp", "some_french", f.experience === "some_french", () => set("experience", "some_french"), "I already know some French", "Optional: a 10-question check in English to suggest a starting point.")}
          {f.experience === "some_french" && (
            <div className="space-y-3 rounded-xl surface-2 p-3">
              <p className="text-sm">This check is optional and only suggests a starting day. Starting at Day 1 is always fine.</p>
              {PLACEMENT.map((q, i) => (
                <fieldset key={i} className="space-y-1">
                  <legend className="text-sm font-medium">{i + 1}. {q.q}</legend>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o, j) => (
                      <label key={j} className={`chip cursor-pointer border ${answers[i] === j ? "border-brand-500 bg-brand-100 text-brand-900" : "border-app"}`}>
                        <input type="radio" className="sr-only" name={`pq${i}`} checked={answers[i] === j} onChange={() => setAnswers((a) => ({ ...a, [i]: j }))} />
                        <span lang="fr">{o}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {Object.keys(answers).length === PLACEMENT.length && (
                <p className="text-sm">Score {score}/10. Suggested start: <strong>Day {suggestedDay(score)}</strong>.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {[1, 21, 41].map((d) => (
                  <button key={d} type="button" className={`btn btn-sm ${f.placementDay === d ? "btn-primary" : "btn-secondary"}`} onClick={() => { set("placementDay", d); set("entryPath", d === 1 ? "absolute_beginner" : "placement"); }}>
                    Start at Day {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}

      {step === 4 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">Audio and microphone</legend>
          <div className="rounded-xl surface-2 p-3 text-sm">
            <p className="font-medium">How the microphone is used</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Only when you press a Record button, for speaking and pronunciation practice.</li>
              <li>By default recordings stay in this browser tab and disappear when you leave the page. Nothing is uploaded unless you choose transcription or analysis, or turn on keeping recordings below.</li>
              <li>Speech-to-text may use your browser&apos;s speech service (for example, Chrome sends audio to Google) or a server provider; each feature tells you which.</li>
              <li>You can always type instead of speaking.</li>
            </ul>
            <p lang="hi" className="deva mt-2 text-muted">माइक्रोफ़ोन सिर्फ़ तभी इस्तेमाल होगा जब आप रिकॉर्ड बटन दबाएँगे। आपकी रिकॉर्डिंग अपने-आप सेव नहीं होतीं।</p>
          </div>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.micOptIn} onChange={(e) => set("micOptIn", e.target.checked)} /><span>I want to use my microphone for speaking practice. <span className="block text-sm text-muted">Your browser will still ask for permission the first time.</span></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.keepRecordings} onChange={(e) => set("keepRecordings", e.target.checked)} /><span>Keep my recordings in my account so I can hear my progress later. <span className="block text-sm text-muted">Off by default. You can delete them any time.</span></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.slowAudioDefault} onChange={(e) => set("slowAudioDefault", e.target.checked)} /><span>Offer slow audio by default in learning mode.</span></label>
        </fieldset>
      )}

      {step === 5 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">Devanagari pronunciation help</legend>
          <p className="text-sm text-muted">We can show an <strong>approximate</strong> pronunciation of French in Devanagari, e.g. <span lang="fr">bonjour</span> → <span lang="hi" className="deva">बोँ-झ़ूग़</span>. French has sounds with no exact Hindi letter, so this is a guide, not an exact match. It is always shown separately from the Hindi meaning.</p>
          {radio("deva", "auto", f.devanagariMode === "auto", () => set("devanagariMode", "auto"), "Follow the course (recommended)", "Visible on Days 1–30, tap-to-show on Days 31–60, audio first on Days 61–90, off in exam practice after Day 90.")}
          {radio("deva", "always", f.devanagariMode === "always", () => set("devanagariMode", "always"), "Always show it")}
          {radio("deva", "never", f.devanagariMode === "never", () => set("devanagariMode", "never"), "Never show it")}
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.showIpa} onChange={(e) => set("showIpa", e.target.checked)} /><span>Also show IPA phonetic symbols where available.</span></label>
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-between gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</button>
        {step < steps.length - 1
          ? <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>Next</button>
          : <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving…" : `Start Day ${f.placementDay}`}</button>}
      </div>
    </div>
  );
}
