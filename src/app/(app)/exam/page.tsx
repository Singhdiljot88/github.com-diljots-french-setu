import Link from "next/link";
import { requireUser, getProfile } from "@/server/auth";
import { attemptSummary, examCatalog, listAttempts } from "@/server/exam";
import { TEF_CANADA, SECTION_ORDER } from "@/content/tef-config";
import { ExamStart } from "@/components/exam-start";
import { Bi } from "@/components/bi";

export const metadata = { title: "Practice exams" };
export const dynamic = "force-dynamic";

export default async function ExamPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const attempts = (await listAttempts(user.id)).map(attemptSummary);
  const mocks = examCatalog();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Exam practice - TEF", hi: "परीक्षा अभ्यास - TEF" }} /></h1>
        <Bi className="text-muted" t={{ en: "This page is for understanding the TEF Canada format and practising under real-exam conditions, either the full exam or one section at a time. Below, every section's rules, time and task are explained. Read your section's rules carefully before starting practice.", hi: "यह पेज TEF परीक्षा के प्रारूप को समझने और असली परीक्षा जैसी परिस्थितियों में अभ्यास करने के लिए है। नीचे हर खंड का नियम, समय और काम हिंदी में समझाया गया है। अभ्यास शुरू करने से पहले अपने खंड के नियम ध्यान से पढ़ें।" }} />
      </header>
      {profile && profile.examVariant !== "tef_canada" && <Bi className="card text-sm" t={{ en: "Your profile names a TEF variant other than TEF Canada. Only the TEF Canada format is built so far.", hi: "आपकी प्रोफ़ाइल में TEF Canada के अलावा कोई दूसरा TEF प्रकार चुना गया है। अभी केवल TEF Canada का प्रारूप बना है।" }} />}

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "The format used here", hi: "यहाँ इस्तेमाल होने वाला प्रारूप" }} /></h2>
        <table className="w-full text-left">
          <thead><tr><th className="py-1"><Bi as="span" t={{ en: "Section", hi: "खंड" }} /></th><th><Bi as="span" t={{ en: "Time allowed", hi: "समय सीमा" }} /></th><th><Bi as="span" t={{ en: "Rules and what you do", hi: "नियम और निर्देश" }} /></th></tr></thead>
          <tbody>
            {SECTION_ORDER.map((k) => { const c = TEF_CANADA.sections[k]; return (
              <tr key={k} className="border-t border-app align-top"><td className="py-1 pr-2"><span lang="fr" className="font-medium">{c.title}</span><br /><Bi as="span" className="text-muted" t={{ en: c.en, hi: c.hi }} /></td><td className="pr-2"><Bi as="span" t={{ en: `${c.minutes} min`, hi: `${c.minutes} मिनट` }} /></td><td><ul className="list-disc pl-4">{c.rules.map((r, i) => <li key={i}><Bi as="span" t={{ en: r.text, hi: r.hi }} />{r.source === "prep-guides" ? " *" : ""}</li>)}</ul><p className="mt-1 text-xs"><Bi as="span" t={{ en: `Tip: ${c.tip.en}`, hi: `सुझाव: ${c.tip.hi}` }} /></p></td></tr>
            ); })}
          </tbody>
        </table>
        <p className="text-xs text-muted"><Bi as="span" t={{ en: `Checked on ${TEF_CANADA.checkedOn} against:`, hi: `${TEF_CANADA.checkedOn} को इस स्रोत से जाँचा गया:` }} /> {TEF_CANADA.sources.map((s) => <a key={s.url} href={s.url} className="underline" target="_blank" rel="noreferrer">{s.label}</a>)}. <Bi as="span" t={{ en: "Rules marked * come from widely published preparation guides and are not stated in that handbook. Check the official site before your exam, since the format can change.", hi: "* वाले नियम आम तौर पर छपी तैयारी पुस्तिकाओं से लिए गए हैं, उस आधिकारिक पुस्तिका में नहीं लिखे हैं। परीक्षा से पहले आधिकारिक वेबसाइट ज़रूर देखें, क्योंकि प्रारूप बदल सकता है।" }} /></p>
        <Bi className="text-xs text-muted" t={{ en: "All practice material is original. It is not official TEF material, and results are raw practice counts, not TEF scores, CEFR levels or NCLC levels.", hi: "सारी अभ्यास सामग्री हमारी अपनी बनाई हुई है। यह आधिकारिक TEF सामग्री नहीं है, और परिणाम केवल अभ्यास में सही उत्तरों की गिनती हैं, TEF अंक, CEFR स्तर या NCLC स्तर नहीं।" }} />
      </section>

      <ExamStart mocks={mocks} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold"><Bi as="span" t={{ en: "Your attempts", hi: "आपके प्रयास" }} /></h2>
        {attempts.length === 0 && <Bi className="text-sm text-muted" t={{ en: "No attempts yet.", hi: "अभी तक कोई प्रयास नहीं।" }} />}
        <ul className="space-y-2">
          {attempts.map((a) => (
            <li key={a.id}>
              <Link href={`/exam/${a.id}`} className="card block hover:border-brand-500">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{a.title}</span>
                  <span className="text-xs text-muted">{new Date(a.createdAt).toLocaleDateString()} · <Bi as="span" t={a.strict ? { en: "exam rules", hi: "परीक्षा के नियम" } : { en: "relaxed", hi: "ढील वाले नियम" }} /> · <Bi as="span" t={a.status === "completed" ? { en: "done", hi: "पूरा" } : { en: "in progress", hi: "जारी है" }} /></span>
                </span>
                <span className="mt-1 flex flex-wrap gap-2 text-sm">
                  {a.sections.map((k) => { const s = a.scores[k]; return (
                    <span key={k} className="chip surface-2"><Bi as="span" t={{ en: TEF_CANADA.sections[k].en, hi: TEF_CANADA.sections[k].hi }} />: {!s ? <Bi as="span" t={{ en: "not finished", hi: "पूरा नहीं" }} /> : "correct" in s ? `${s.correct}/${s.total}` : "words" in s ? <Bi as="span" t={{ en: `A ${s.words.a} words, B ${s.words.b} words`, hi: `A ${s.words.a} शब्द, B ${s.words.b} शब्द` }} /> : <Bi as="span" t={{ en: "done", hi: "पूरा" }} />}</span>
                  ); })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
