"use client";
import { useState } from "react";
import { TimeZoneSelect } from "@/components/time-zone-select";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { expectedProgressNote, courseEndDate, type DailyMinutes, type Pace } from "@/lib/schedule";
import { diffDays } from "@/lib/dates";
import { Bi } from "@/components/bi";
import { PrefsProvider, defaultPrefs } from "@/components/prefs";

type T = { en: string; hi: string };

const VARIANTS: [string, T][] = [
  ["tef_canada", { en: "TEF Canada — immigration or citizenship in Canada (recommended default)", hi: "TEF Canada — कनाडा में इमिग्रेशन या नागरिकता (सुझाया गया विकल्प)" }],
  ["tefaq", { en: "TEFAQ — Québec immigration", hi: "TEFAQ — क्यूबेक इमिग्रेशन" }],
  ["tef_etudes", { en: "TEF Études — studies in France", hi: "TEF Études — फ़्रांस में पढ़ाई" }],
  ["tef_naturalisation", { en: "TEF Naturalisation — French nationality", hi: "TEF Naturalisation — फ़्रांस की नागरिकता" }],
  ["tef_irn", { en: "TEF IRN — integration, residence, nationality (France)", hi: "TEF IRN — एकीकरण, निवास, नागरिकता (फ़्रांस)" }],
  ["undecided", { en: "Not sure yet", hi: "अभी तय नहीं" }],
];

/** Options are French (shown as-is) or English meanings with a Hindi translation. */
const PLACEMENT: { q: T; options: (string | T)[]; answer: number }[] = [
  { q: { en: "What does « Je m'appelle Anil » mean?", hi: "« Je m'appelle Anil » का क्या मतलब है?" }, options: [{ en: "I live in Anil", hi: "मैं अनिल में रहता/रहती हूँ" }, { en: "My name is Anil", hi: "मेरा नाम अनिल है" }, { en: "I call Anil", hi: "मैं अनिल को बुलाता/बुलाती हूँ" }], answer: 1 },
  { q: { en: "Choose the correct form: « Nous ___ indiens. »", hi: "सही रूप चुनें: « Nous ___ indiens. »" }, options: ["sommes", "sont", "êtes"], answer: 0 },
  { q: { en: "« J'ai trente ans » means…", hi: "« J'ai trente ans » का मतलब है…" }, options: [{ en: "I have thirty friends", hi: "मेरे तीस दोस्त हैं" }, { en: "I am thirty years old", hi: "मेरी उम्र तीस साल है" }, { en: "It is three o'clock", hi: "तीन बजे हैं" }], answer: 1 },
  { q: { en: "Which is the polite way to ask someone's name?", hi: "किसी का नाम पूछने का विनम्र तरीका कौन-सा है?" }, options: ["Tu t'appelles comment ?", "Comment vous appelez-vous ?", "Qui es-tu ?"], answer: 1 },
  { q: { en: "Choose the correct article: « ___ maison »", hi: "सही आर्टिकल चुनें: « ___ maison »" }, options: ["le", "la", "les"], answer: 1 },
  { q: { en: "« Je ne mange pas de viande » means…", hi: "« Je ne mange pas de viande » का मतलब है…" }, options: [{ en: "I don't eat meat", hi: "मैं मांस नहीं खाता/खाती" }, { en: "I eat a lot of meat", hi: "मैं बहुत मांस खाता/खाती हूँ" }, { en: "I want some meat", hi: "मुझे थोड़ा मांस चाहिए" }], answer: 0 },
  { q: { en: "Choose the correct form: « Hier, j'___ mangé au restaurant. »", hi: "सही रूप चुनें: « Hier, j'___ mangé au restaurant. »" }, options: ["ai", "suis", "avais"], answer: 0 },
  { q: { en: "« Il fait froid en hiver à Montréal » is about…", hi: "« Il fait froid en hiver à Montréal » किस बारे में है?" }, options: [{ en: "food", hi: "खाना" }, { en: "weather", hi: "मौसम" }, { en: "work", hi: "काम" }], answer: 1 },
  { q: { en: "Choose the correct form: « Elle ___ au travail en bus. »", hi: "सही रूप चुनें: « Elle ___ au travail en bus. »" }, options: ["va", "vais", "allez"], answer: 0 },
  { q: { en: "« Du pain, de la confiture, des œufs » — these words are…", hi: "« Du pain, de la confiture, des œufs » — ये शब्द हैं…" }, options: [{ en: "partitive/plural articles", hi: "पार्टिटिव/बहुवचन आर्टिकल" }, { en: "possessives", hi: "स्वामित्व बताने वाले शब्द" }, { en: "pronouns", hi: "सर्वनाम" }], answer: 0 },
];

const STEPS: T[] = [
  { en: "Language", hi: "भाषा" }, { en: "Exam", hi: "परीक्षा" }, { en: "Schedule", hi: "समय-सारणी" },
  { en: "Starting point", hi: "शुरुआत" }, { en: "Audio & microphone", hi: "ऑडियो और माइक्रोफ़ोन" }, { en: "Pronunciation help", hi: "उच्चारण में मदद" },
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
  // The language chosen in step 1 applies to the rest of the form straight away.
  const lang = f.explanationLang;
  const L = (t: T) => (lang === "hi" ? t.hi : lang === "both" ? `${t.en} · ${t.hi}` : t.en);

  const note = expectedProgressNote(f.dailyMinutes, f.pace);
  const end = courseEndDate({ startDate: f.startDate, dailyMinutes: f.dailyMinutes, pace: f.pace, scheduleShiftDays: 0, placementDay: f.placementDay });
  const examTooSoon = f.examDate && diffDays(f.examDate, end) > 0;
  const score = PLACEMENT.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);

  const steps = STEPS;

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
  const b = (t: T) => <Bi as="span" t={t} />;

  return (
    <PrefsProvider value={{ ...defaultPrefs, explanationLang: lang }}>
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {lang !== "hi" && <span lang="en" className="block">Let&apos;s set up your plan</span>}
        {lang !== "en" && <span lang="hi" className={`deva block ${lang === "both" ? "mt-1 text-base font-normal text-muted" : ""}`}>चलिए आपकी योजना बनाते हैं</span>}
      </h1>
      <ol className="flex flex-wrap gap-2 text-xs" aria-label={L({ en: "Steps", hi: "चरण" })}>
        {steps.map((s, i) => <li key={s.en} className={`chip ${i === step ? "bg-brand-600 text-white" : i < step ? "bg-brand-100 text-brand-900" : "surface-2 text-muted"}`} aria-current={i === step ? "step" : undefined}>{i + 1}. <Bi as="span" t={s} /></li>)}
      </ol>

      {step === 0 && (
        <fieldset className="space-y-3">
          <legend className="mb-2">
            {lang !== "hi" && <span lang="en" className="block text-xl font-semibold">How should we explain things?</span>}
            {lang !== "en" && <span lang="hi" className={`deva block ${lang === "hi" ? "text-xl font-semibold" : "mt-1 text-muted"}`}>हम चीज़ें किस भाषा में समझाएँ?</span>}
          </legend>
          {radio("lang", "both", f.explanationLang === "both", () => set("explanationLang", "both"), "English and Hindi", <span lang="hi" className="deva">अंग्रेज़ी और हिंदी दोनों</span>)}
          {radio("lang", "en", f.explanationLang === "en", () => set("explanationLang", "en"), "English")}
          {radio("lang", "hi", f.explanationLang === "hi", () => set("explanationLang", "hi"), <span lang="hi" className="deva">हिंदी</span>, b({ en: "Explanations in Hindi; French words still show English meanings too.", hi: "हिंदी में समझाया जाएगा; फ़्रेंच शब्दों के साथ अंग्रेज़ी अर्थ भी दिखते रहेंगे।" }))}
          <label className="block pt-2"><span className="text-sm font-medium">{L({ en: "What should we call you? (optional)", hi: "हम आपको किस नाम से बुलाएँ? (वैकल्पिक)" })}</span>
            <input className="input mt-1" value={f.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={60} /></label>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">{b({ en: "Which exam are you preparing for?", hi: "आप किस परीक्षा की तैयारी कर रहे हैं?" })}</legend>
          <Bi className="text-sm text-muted" t={{ en: "Please confirm. TEF variants have different formats and are kept separate. This app's exam simulator currently follows the TEF Canada format; for other variants you can still follow the course, but the simulator will say it is not configured for your exam.", hi: "कृपया पुष्टि करें। TEF के अलग-अलग प्रकारों का प्रारूप अलग होता है और इन्हें अलग रखा गया है। इस ऐप का परीक्षा सिम्युलेटर अभी TEF Canada के प्रारूप पर चलता है; दूसरे प्रकारों के लिए भी आप पाठ्यक्रम कर सकते हैं, पर सिम्युलेटर बताएगा कि वह आपकी परीक्षा के लिए तैयार नहीं है।" }} />
          {VARIANTS.map(([v, l]) => radio("variant", v, f.examVariant === v, () => set("examVariant", v), b(l)))}
          <label className="block pt-2"><span className="text-sm font-medium">{L({ en: "What result are you hoping for? (optional)", hi: "आप कौन-सा परिणाम चाहते हैं? (वैकल्पिक)" })}</span>
            <input className="input mt-1" placeholder={L({ en: "e.g. NCLC 7 in all skills for Express Entry", hi: "जैसे Express Entry के लिए सभी कौशलों में NCLC 7" })} value={f.desiredOutcome} onChange={(e) => set("desiredOutcome", e.target.value)} maxLength={300} /></label>
          <Bi className="text-sm text-muted" t={{ en: "We will use this to plan, not to promise. Many beginners need more than 120 days to reach upper-intermediate levels; we will show you honest evidence of your progress along the way.", hi: "हम इसे योजना बनाने के लिए इस्तेमाल करेंगे, कोई वादा करने के लिए नहीं। कई शुरुआती सीखने वालों को ऊपरी-मध्यम स्तर तक पहुँचने में 120 दिन से ज़्यादा लगते हैं; रास्ते में हम आपको आपकी प्रगति के सच्चे प्रमाण दिखाएँगे।" }} />
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">{b({ en: "How much time can you study each day?", hi: "आप रोज़ कितना समय पढ़ सकते हैं?" })}</legend>
          {radio("min", "150", f.dailyMinutes === 150, () => set("dailyMinutes", 150), b({ en: "150 minutes — recommended intensive plan", hi: "150 मिनट — सुझाई गई गहन योजना" }), b({ en: "15 review · 20 vocabulary & grammar · 25 listening · 25 speaking · 20 reading · 25 writing · 20 correction & assessment", hi: "15 दोहराव · 20 शब्द और व्याकरण · 25 सुनना · 25 बोलना · 20 पढ़ना · 25 लिखना · 20 सुधार और मूल्यांकन" }))}
          {radio("min", "180", f.dailyMinutes === 180, () => set("dailyMinutes", 180), b({ en: "180 minutes", hi: "180 मिनट" }), b({ en: "The full plan with extra practice time.", hi: "पूरी योजना, अतिरिक्त अभ्यास समय के साथ।" }))}
          {radio("min", "90", f.dailyMinutes === 90, () => set("dailyMinutes", 90), b({ en: "90 minutes", hi: "90 मिनट" }))}
          {radio("min", "45", f.dailyMinutes === 45, () => set("dailyMinutes", 45), b({ en: "45 minutes", hi: "45 मिनट" }))}
          {f.dailyMinutes < 150 && (
            <div className="space-y-2 rounded-xl surface-2 p-3">
              <Bi className="text-sm font-medium" t={{ en: "With less time, choose how to adjust:", hi: "कम समय में, चुनिए कि योजना कैसे बदले:" }} />
              {radio("pace", "complete", f.pace === "complete", () => set("pace", "complete"), b({ en: "Complete lessons, longer course", hi: "पूरे पाठ, लंबा पाठ्यक्रम" }), b({ en: "Each lesson is done in full over several days.", hi: "हर पाठ कई दिनों में पूरा किया जाता है।" }))}
              {radio("pace", "compact", f.pace === "compact", () => set("pace", "compact"), b({ en: "Keep 120 days, lighter lessons", hi: "120 दिन ही, हल्के पाठ" }), b({ en: "Fewer exercises each day.", hi: "हर दिन कम अभ्यास।" }))}
            </div>
          )}
          <Bi className="rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-900/40" t={note} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="text-sm font-medium">{L({ en: "Start date", hi: "शुरू होने की तारीख़" })}</span><input type="date" className="input mt-1" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} required /></label>
            <label><span className="text-sm font-medium">{L({ en: "Exam date (optional)", hi: "परीक्षा की तारीख़ (वैकल्पिक)" })}</span><input type="date" className="input mt-1" value={f.examDate} min={f.startDate} onChange={(e) => set("examDate", e.target.value)} /></label>
          </div>
          <TimeZoneSelect value={f.timezone} onChange={(z) => set("timezone", z)} />
          <Bi className="text-sm" t={{ en: `Planned course end: ${end}.`, hi: `पाठ्यक्रम ख़त्म होने की तय तारीख़: ${end}।` }} />
          {examTooSoon && <div role="alert" className="rounded-lg bg-saffron-100 p-3 text-sm text-saffron-700"><Bi t={{ en: "Your exam date is before the planned end of the course. You can still continue — consider more daily time, a later exam date, or focusing on the TEF phases earlier with your teacher.", hi: "आपकी परीक्षा की तारीख़ पाठ्यक्रम के तय अंत से पहले है। आप फिर भी जारी रख सकते हैं — रोज़ ज़्यादा समय, परीक्षा की बाद की तारीख़, या अपने शिक्षक के साथ TEF वाले चरणों पर पहले ध्यान देने पर विचार करें।" }} /></div>}
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">{b({ en: "Where are you starting?", hi: "आप कहाँ से शुरू कर रहे हैं?" })}</legend>
          {radio("exp", "none", f.experience === "none", () => { set("experience", "none"); set("entryPath", "absolute_beginner"); set("placementDay", 1); }, b({ en: "I know no French at all", hi: "मुझे बिल्कुल फ़्रेंच नहीं आती" }), b({ en: "You start at Day 1. No test needed.", hi: "आप दिन 1 से शुरू करेंगे। कोई टेस्ट नहीं चाहिए।" }))}
          {radio("exp", "other_language", f.experience === "other_language", () => { set("experience", "other_language"); set("entryPath", "absolute_beginner"); set("placementDay", 1); }, b({ en: "I have learned another language before, but not French", hi: "मैंने पहले कोई दूसरी भाषा सीखी है, पर फ़्रेंच नहीं" }), b({ en: "You start at Day 1; you may move faster through the early days.", hi: "आप दिन 1 से शुरू करेंगे; शुरुआती दिन आप शायद जल्दी पूरे कर लें।" }))}
          {radio("exp", "some_french", f.experience === "some_french", () => set("experience", "some_french"), b({ en: "I already know some French", hi: "मुझे थोड़ी फ़्रेंच आती है" }), b({ en: "Optional: a 10-question check in English to suggest a starting point.", hi: "वैकल्पिक: शुरुआत का दिन सुझाने के लिए 10 सवालों की एक छोटी जाँच।" }))}
          {f.experience === "some_french" && (
            <div className="space-y-3 rounded-xl surface-2 p-3">
              <Bi className="text-sm" t={{ en: "This check is optional and only suggests a starting day. Starting at Day 1 is always fine.", hi: "यह जाँच वैकल्पिक है और सिर्फ़ शुरुआत का दिन सुझाती है। दिन 1 से शुरू करना हमेशा ठीक है।" }} />
              {PLACEMENT.map((q, i) => (
                <fieldset key={i} className="space-y-1">
                  <legend className="text-sm font-medium">{i + 1}. <Bi as="span" t={q.q} /></legend>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o, j) => (
                      <label key={j} className={`chip cursor-pointer border ${answers[i] === j ? "border-brand-500 bg-brand-100 text-brand-900" : "border-app"}`}>
                        <input type="radio" className="sr-only" name={`pq${i}`} checked={answers[i] === j} onChange={() => setAnswers((a) => ({ ...a, [i]: j }))} />
                        {typeof o === "string" ? <span lang="fr">{o}</span> : <Bi as="span" t={o} />}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {Object.keys(answers).length === PLACEMENT.length && (
                <Bi className="text-sm" t={{ en: `Score ${score}/10. Suggested start: Day ${suggestedDay(score)}.`, hi: `अंक ${score}/10। सुझाई गई शुरुआत: दिन ${suggestedDay(score)}।` }} />
              )}
              <div className="flex flex-wrap gap-2">
                {[1, 21, 41].map((d) => (
                  <button key={d} type="button" className={`btn btn-sm ${f.placementDay === d ? "btn-primary" : "btn-secondary"}`} onClick={() => { set("placementDay", d); set("entryPath", d === 1 ? "absolute_beginner" : "placement"); }}>
                    {b({ en: `Start at Day ${d}`, hi: `दिन ${d} से शुरू करें` })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}

      {step === 4 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">{b({ en: "Audio and microphone", hi: "ऑडियो और माइक्रोफ़ोन" })}</legend>
          <div className="rounded-xl surface-2 p-3 text-sm">
            <Bi className="font-medium" t={{ en: "How the microphone is used", hi: "माइक्रोफ़ोन कैसे इस्तेमाल होता है" }} />
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <Bi as="li" t={{ en: "Only when you press a Record button, for speaking and pronunciation practice.", hi: "सिर्फ़ तब, जब आप बोलने और उच्चारण के अभ्यास के लिए रिकॉर्ड बटन दबाते हैं।" }} />
              <Bi as="li" t={{ en: "By default recordings stay in this browser tab and disappear when you leave the page. Nothing is uploaded unless you choose transcription or analysis, or turn on keeping recordings below.", hi: "पहले से तय सेटिंग में रिकॉर्डिंग इसी ब्राउज़र टैब में रहती हैं और पेज छोड़ते ही हट जाती हैं। जब तक आप लिखित रूप (ट्रांसक्रिप्शन) या विश्लेषण नहीं चुनते, या नीचे रिकॉर्डिंग रखना चालू नहीं करते, कुछ भी अपलोड नहीं होता।" }} />
              <Bi as="li" t={{ en: "Speech-to-text may use your browser's speech service (for example, Chrome sends audio to Google) or a server provider; each feature tells you which.", hi: "बोली को लिखित में बदलने के लिए आपके ब्राउज़र की स्पीच सेवा (जैसे Chrome ऑडियो Google को भेजता है) या कोई सर्वर सेवा इस्तेमाल हो सकती है; हर सुविधा बताती है कि कौन-सी।" }} />
              <Bi as="li" t={{ en: "You can always type instead of speaking.", hi: "आप बोलने के बजाय हमेशा टाइप भी कर सकते हैं।" }} />
            </ul>
          </div>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.micOptIn} onChange={(e) => set("micOptIn", e.target.checked)} /><span>{b({ en: "I want to use my microphone for speaking practice.", hi: "मैं बोलने के अभ्यास के लिए अपना माइक्रोफ़ोन इस्तेमाल करना चाहता/चाहती हूँ।" })} <Bi as="span" className="block text-sm text-muted" t={{ en: "Your browser will still ask for permission the first time.", hi: "आपका ब्राउज़र पहली बार फिर भी अनुमति माँगेगा।" }} /></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.keepRecordings} onChange={(e) => set("keepRecordings", e.target.checked)} /><span>{b({ en: "Keep my recordings in my account so I can hear my progress later.", hi: "मेरी रिकॉर्डिंग मेरे खाते में रखें ताकि मैं बाद में अपनी प्रगति सुन सकूँ।" })} <Bi as="span" className="block text-sm text-muted" t={{ en: "Off by default. You can delete them any time.", hi: "यह पहले से बंद है। आप इन्हें कभी भी मिटा सकते हैं।" }} /></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.slowAudioDefault} onChange={(e) => set("slowAudioDefault", e.target.checked)} />{b({ en: "Offer slow audio by default in learning mode.", hi: "सीखते समय धीमा ऑडियो पहले से उपलब्ध रखें।" })}</label>
        </fieldset>
      )}

      {step === 5 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xl font-semibold">{b({ en: "Devanagari pronunciation help", hi: "देवनागरी में उच्चारण की मदद" })}</legend>
          <div className="space-y-1 text-sm text-muted">
            <Bi t={{ en: "We can show an approximate pronunciation of French in Devanagari, for example:", hi: "हम फ़्रेंच का अनुमानित उच्चारण देवनागरी में दिखा सकते हैं, जैसे:" }} />
            <p><span lang="fr">bonjour</span> → <span lang="hi" className="deva">बों-जूर</span></p>
            <Bi t={{ en: "French has sounds with no exact Hindi letter, so this is a guide, not an exact match. It is always shown separately from the Hindi meaning.", hi: "फ़्रेंच में कुछ ऐसी ध्वनियाँ हैं जिनके लिए हिंदी में ठीक-ठीक अक्षर नहीं है, इसलिए यह सिर्फ़ एक सहारा है, बिल्कुल सटीक उच्चारण नहीं। इसे हमेशा हिंदी अर्थ से अलग दिखाया जाता है।" }} />
          </div>
          {radio("deva", "auto", f.devanagariMode === "auto", () => set("devanagariMode", "auto"), b({ en: "Follow the course (recommended)", hi: "पाठ्यक्रम के हिसाब से (सुझाया गया)" }), b({ en: "Visible on Days 1–30, tap-to-show on Days 31–60, audio first on Days 61–90, off in exam practice after Day 90.", hi: "दिन 1–30 में दिखेगा, दिन 31–60 में टैप करने पर दिखेगा, दिन 61–90 में पहले ऑडियो, और दिन 90 के बाद परीक्षा अभ्यास में बंद।" }))}
          {radio("deva", "always", f.devanagariMode === "always", () => set("devanagariMode", "always"), b({ en: "Always show it", hi: "हमेशा दिखाएँ" }))}
          {radio("deva", "never", f.devanagariMode === "never", () => set("devanagariMode", "never"), b({ en: "Never show it", hi: "कभी न दिखाएँ" }))}
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={f.showIpa} onChange={(e) => set("showIpa", e.target.checked)} />{b({ en: "Also show IPA phonetic symbols where available.", hi: "जहाँ उपलब्ध हों, IPA ध्वन्यात्मक चिह्न भी दिखाएँ।" })}</label>
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-between gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>{b({ en: "Back", hi: "पीछे" })}</button>
        {step < steps.length - 1
          ? <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>{b({ en: "Next", hi: "आगे" })}</button>
          : <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{b(busy ? { en: "Saving…", hi: "सहेजा जा रहा है…" } : { en: `Start Day ${f.placementDay}`, hi: `दिन ${f.placementDay} शुरू करें` })}</button>}
      </div>
    </div>
    </PrefsProvider>
  );
}
