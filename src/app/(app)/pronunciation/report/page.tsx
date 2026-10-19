import Link from "next/link";
import { requireUser, getProfile } from "@/server/auth";
import { sayReport } from "@/server/say-report";
import { STATUS_LABEL } from "@/lib/speech-match";
import { PrintButton } from "@/components/print-button";
import { Bi } from "@/components/bi";

export const metadata = { title: "Pronunciation practice report" };
export const dynamic = "force-dynamic";

const RANGES = {
  all: { en: "All time", hi: "शुरू से अब तक" }, "30": { en: "Last 30 days", hi: "पिछले 30 दिन" }, "7": { en: "Last 7 days", hi: "पिछले 7 दिन" }, "1": { en: "Today", hi: "आज" },
} as const;
const STATUS_HI: Record<string, string> = { all: "हर शब्द पहचाना गया", most: "ज़्यादातर शब्द पहचाने गए", some: "कुछ शब्द पहचाने गए", none: "अभी पहचाना नहीं गया" };
const fmtDate = (d: Date, tz: string) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: tz });

export default async function SayReportPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const tz = profile?.timezone ?? "UTC";
  const range = ((await searchParams).range ?? "all") as keyof typeof RANGES;
  const days = range === "all" ? null : Number(range);
  const since = days ? new Date(Date.now() - days * 86_400_000) : undefined;
  const r = await sayReport(user.id, since);
  const name = profile?.displayName || (user.isGuest ? "Learner" : user.email.split("@")[0]);
  const perfect = r.phrases.filter((p) => p.status === "all");
  const improved = r.phrases.filter((p) => p.improved);
  const work = r.phrases.filter((p) => p.status !== "all");
  const missedWords = [...new Set(work.flatMap((p) => p.stillMissed))].slice(0, 20);
  const nameHi = profile?.displayName || (user.isGuest ? "शिक्षार्थी" : user.email.split("@")[0]);
  const via = r.usedBrowser && r.usedKeyboard
    ? { en: " (the browser's built-in recognizer, or a phone voice keyboard)", hi: " (ब्राउज़र की अपनी पहचान प्रणाली, या फ़ोन का वॉइस कीबोर्ड)" }
    : r.usedKeyboard ? { en: " (a phone voice keyboard)", hi: " (फ़ोन का वॉइस कीबोर्ड)" } : { en: " (the browser's built-in recognizer)", hi: " (ब्राउज़र की अपनी पहचान प्रणाली)" };
  const top = perfect.sort((a, b) => b.best.count - a.best.count)[0];

  return (
    <article className="space-y-5 print:space-y-3 print:text-[11pt]">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/pronunciation?tab=say" className="text-sm underline">← <Bi as="span" t={{ en: "Say it practice", hi: "बोलकर अभ्यास" }} /></Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-labelledby="range-h" className="flex flex-wrap gap-1">
            <h2 id="range-h" className="sr-only"><Bi as="span" t={{ en: "Date range", hi: "समय अवधि" }} /></h2>
            {Object.entries(RANGES).map(([k, v]) => <Link key={k} href={`/pronunciation/report?range=${k}`} className={`chip ${range === k ? "bg-brand-100 text-brand-900" : "surface-2"}`} aria-current={range === k ? "page" : undefined}><Bi as="span" t={v} /></Link>)}
          </nav>
          <PrintButton />
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: `${name}'s French pronunciation: best attempts`, hi: `${nameHi} का फ़्रेंच उच्चारण: सबसे अच्छे प्रयास` }} /></h1>
        <Bi className="text-sm text-muted" t={r.from
          ? { en: `Practice from ${fmtDate(r.from, tz)} to ${fmtDate(r.to!, tz)} · ${r.attempts} attempts on ${r.phrases.length} phrases · Printed from French Setu`, hi: `${fmtDate(r.from, tz)} से ${fmtDate(r.to!, tz)} तक का अभ्यास · ${r.phrases.length} वाक्यांशों पर ${r.attempts} प्रयास · French Setu से प्रिंट किया गया` }
          : { en: "No attempts in this period yet. · Printed from French Setu", hi: "इस अवधि में अभी कोई प्रयास नहीं। · French Setu से प्रिंट किया गया" }} />
      </header>

      <section className="card space-y-1 text-sm print:border print:shadow-none" aria-labelledby="how-h">
        <h2 id="how-h" className="font-semibold"><Bi as="span" t={{ en: "How this was measured", hi: "इसे कैसे मापा गया" }} /></h2>
        <Bi t={{
          en: `Each attempt is what a French speech recognizer wrote down when ${name} said the phrase${via.en}. The phrase is compared with that text word by word, ignoring capitals, accents and punctuation. A word counts as recognised when the recognizer wrote it in the right order.`,
          hi: `हर प्रयास वह है जो फ़्रेंच बोली पहचानने वाले सिस्टम ने तब लिखा जब ${nameHi} ने वाक्यांश बोला${via.hi}। वाक्यांश को उस लिखे हुए पाठ से शब्द-दर-शब्द मिलाया जाता है; बड़े अक्षर, accent चिह्न और विराम चिह्न नहीं गिने जाते। कोई शब्द तब पहचाना हुआ माना जाता है जब सिस्टम ने उसे सही क्रम में लिखा हो।`,
        }} />
        <Bi t={{ en: "This shows whether the sounds were clear enough for a machine to understand. It is not an accent score, a CEFR or NCLC level, or a TEF result, and no audio was kept.", hi: "इससे बस यह पता चलता है कि ध्वनियाँ इतनी साफ़ थीं या नहीं कि मशीन उन्हें समझ सके। यह उच्चारण के अंक, CEFR या NCLC स्तर, या TEF परिणाम नहीं है, और कोई ऑडियो नहीं रखा गया।" }} />
      </section>

      {r.phrases.length === 0 ? (
        <p className="card text-sm print:hidden">
          <Bi as="span" t={{ en: "Practise in the", hi: "उच्चारण लैब के" }} />{" "}
          <Link className="underline" href="/pronunciation?tab=say"><Bi as="span" t={{ en: "Say it", hi: "बोलकर अभ्यास" }} /></Link>{" "}
          <Bi as="span" t={{ en: "tab of the pronunciation lab, then come back here.", hi: "टैब में अभ्यास करें, फिर यहाँ लौटें।" }} />
        </p>
      ) : (
        <>
          <section className="space-y-1 text-sm" aria-labelledby="hl-h">
            <h2 id="hl-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "Highlights", hi: "मुख्य बातें" }} /></h2>
            <ul className="list-disc space-y-1 pl-5">
              <Bi as="li" t={{ en: `${perfect.length} of ${r.phrases.length} phrases had every word recognised at least once.`, hi: `${r.phrases.length} में से ${perfect.length} वाक्यांशों का हर शब्द कम से कम एक बार पहचाना गया।` }} />
              {top && <li><Bi as="span" t={{ en: "Most reliable:", hi: "सबसे भरोसेमंद:" }} /> <span lang="fr" className="italic">{top.fr}</span>, <Bi as="span" t={{ en: `recognised in full ${top.best.count} time${top.best.count === 1 ? "" : "s"}.`, hi: `${top.best.count} बार पूरा पहचाना गया।` }} /></li>}
              {improved.length > 0 && <Bi as="li" t={{ en: `${improved.length} phrase${improved.length === 1 ? "" : "s"} improved between the first and the best attempt.`, hi: `पहले और सबसे अच्छे प्रयास के बीच ${improved.length} वाक्यांशों में सुधार हुआ।` }} />}
            </ul>
          </section>

          <section aria-labelledby="pp-h" className="space-y-2">
            <h2 id="pp-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "Phrase by phrase", hi: "हर वाक्यांश" }} /></h2>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm print:min-w-0 print:text-[9.5pt]">
                <thead>
                  <tr className="border-b border-app align-bottom">
                    <th className="py-1 pr-2"><Bi as="span" t={{ en: "French", hi: "फ़्रेंच" }} /></th><th className="pr-2"><Bi as="span" t={{ en: "Meaning", hi: "अर्थ" }} /></th><th className="pr-2"><Bi as="span" t={{ en: "Approx. pronunciation", hi: "उच्चारण सहायता" }} /></th><th className="pr-2"><Bi as="span" t={{ en: "Best attempt (what was heard)", hi: "सबसे अच्छा प्रयास (जो सुना गया)" }} /></th><th><Bi as="span" t={{ en: "Result", hi: "नतीजा" }} /></th>
                  </tr>
                </thead>
                <tbody>
                  {r.phrases.map((p) => (
                    <tr key={p.fr} className="border-b border-app align-top break-inside-avoid">
                      <td className="py-1.5 pr-2" lang="fr"><span className="font-medium">{p.fr}</span>{p.day && <Bi as="span" className="block text-xs text-muted" t={{ en: `Day ${p.day}`, hi: `दिन ${p.day}` }} />}</td>
                      <td className="pr-2"><Bi as="div" t={{ en: p.en, hi: p.hi }} /></td>
                      <td className="pr-2" lang="hi"><span className="deva">{p.pron ?? "—"}</span></td>
                      <td className="pr-2"><q lang="fr">{p.best.transcript}</q><Bi as="span" className="block text-xs text-muted" t={{ en: `${p.tries} tr${p.tries === 1 ? "y" : "ies"}`, hi: `${p.tries} प्रयास` }} /></td>
                      <td>{STATUS_LABEL[p.status].icon} {p.best.heard}/{p.total}<Bi as="span" className="block text-xs text-muted" t={{ en: STATUS_LABEL[p.status].en, hi: STATUS_HI[p.status] }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Bi className="text-xs text-muted" t={{
              en: "Approximate pronunciation in Devanagari only. French has sounds with no exact Hindi letter: र is the soft throaty French r, यू is ई said with rounded lips, ज is often the sound in English “measure”, and ँ or ं marks a nasal vowel.",
              hi: "देवनागरी में उच्चारण सिर्फ़ अंदाज़न है। फ़्रेंच की कुछ ध्वनियों के लिए हिंदी में ठीक-ठीक अक्षर नहीं है: र गले से निकलने वाला नरम फ़्रेंच r है, यू होंठ गोल करके बोला गया ई है, ज अक्सर अंग्रेज़ी “measure” वाली ध्वनि है, और ँ या ं नाक से बोले जाने वाले स्वर को दिखाते हैं।",
            }} />
          </section>

          {improved.length > 0 && (
            <section className="space-y-1 text-sm break-inside-avoid" aria-labelledby="imp-h">
              <h2 id="imp-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "What improved", hi: "किसमें सुधार हुआ" }} /></h2>
              <ul className="list-disc space-y-1 pl-5">
                {improved.slice(0, 12).map((p) => <li key={p.fr}><span lang="fr" className="italic">{p.fr}</span>: <Bi as="span" t={{ en: "first heard as", hi: "पहली बार सुना गया" }} /> <q lang="fr">{p.first.transcript}</q> ({p.first.heard}/{p.total}), <Bi as="span" t={{ en: "best", hi: "सबसे अच्छा" }} /> <q lang="fr">{p.best.transcript}</q> ({p.best.heard}/{p.total}).</li>)}
              </ul>
            </section>
          )}

          {work.length > 0 && (
            <section className="space-y-1 text-sm break-inside-avoid" aria-labelledby="wk-h">
              <h2 id="wk-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "What to work on next", hi: "आगे किस पर काम करें" }} /></h2>
              <ul className="list-disc space-y-1 pl-5">
                {work.slice(0, 10).map((p) => <li key={p.fr}><span lang="fr" className="italic">{p.fr}</span>{p.stillMissed.length ? <>: <Bi as="span" t={{ en: "the recognizer has not yet written", hi: "सिस्टम ने अभी तक ये नहीं लिखे:" }} /> <span lang="fr" className="font-medium">{p.stillMissed.join(", ")}</span>.</> : "."} <Bi as="span" t={{ en: "Listen to the model at slow speed, then say it again.", hi: "नमूना धीमी गति पर सुनें, फिर दोबारा बोलें।" }} /></li>)}
              </ul>
              {missedWords.length > 0 && <p><Bi as="span" t={{ en: "Words not recognised in any attempt so far:", hi: "अब तक किसी भी प्रयास में न पहचाने गए शब्द:" }} /> <span lang="fr">{missedWords.join(" · ")}</span>. <Bi as="span" t={{ en: "The sound lessons in the pronunciation lab explain the hardest French sounds for Hindi and English speakers.", hi: "उच्चारण लैब के ध्वनि-पाठ हिंदी और अंग्रेज़ी बोलने वालों के लिए फ़्रेंच की सबसे कठिन ध्वनियाँ समझाते हैं।" }} /></p>}
            </section>
          )}
        </>
      )}
    </article>
  );
}
