import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { Bi } from "@/components/bi";

export const metadata = { title: "Free resources" };
export const dynamic = "force-dynamic";

type T = { en: string; hi: string };
type Res = { title: string; url: string; publisher: string; level: string; free: boolean; what: T; use: T };

/** Curated links, checked 2026-11-15. Only official or long-running free sources; none are affiliated with French Setu. */
const CHECKED = "2026-11-15";
const SECTIONS: { id: string; icon: string; title: T; intro: T; items: Res[] }[] = [
  {
    id: "official", icon: "🏛️", title: { en: "Official exam information", hi: "परीक्षा की आधिकारिक जानकारी" },
    intro: { en: "Rules and requirements change. Check these before you book or submit anything.", hi: "नियम और ज़रूरतें बदलती रहती हैं। बुकिंग या आवेदन से पहले इन्हें ज़रूर देखें।" },
    items: [
      { title: "TEF Canada: prepare yourself", url: "https://www.lefrancaisdesaffaires.fr/en/candidate/test-evaluation-francais/tef-canada/preparation/", publisher: "Le français des affaires (CCI Paris Île-de-France), the test's publisher", level: "Exam info", free: true,
        what: { en: "The publisher's own preparation page for TEF Canada, with official sample material.", hi: "TEF Canada बनाने वाली संस्था का अपना तैयारी पेज, आधिकारिक नमूना सामग्री के साथ।" },
        use: { en: "Do one official sample early, then again near your exam, using the timed mocks here in between.", hi: "शुरुआत में एक आधिकारिक नमूना करें, फिर परीक्षा के पास दोबारा; बीच में यहाँ के समयबद्ध मॉक दें।" } },
      { title: "TEF Canada: presentation", url: "https://www.lefrancaisdesaffaires.fr/en/candidate/test-evaluation-francais/tef-canada/presentation/", publisher: "Le français des affaires", level: "Exam info", free: true,
        what: { en: "What the test is, who recognises it and how results are reported.", hi: "परीक्षा क्या है, किसे मान्य है और नतीजे कैसे बताए जाते हैं।" },
        use: { en: "Read once so the format holds no surprises.", hi: "एक बार पढ़ लें ताकि परीक्षा का ढाँचा अनजाना न रहे।" } },
      { title: "IRCC: language test results for Express Entry", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-requirements/language-testing.html", publisher: "Government of Canada (IRCC)", level: "Official", free: true,
        what: { en: "Which tests IRCC accepts (TEF Canada and TCF Canada for French) and how long results stay valid.", hi: "IRCC कौन-सी परीक्षाएँ मानता है (फ़्रेंच के लिए TEF Canada और TCF Canada) और नतीजे कितने समय तक मान्य रहते हैं।" },
        use: { en: "The final word on requirements. French Setu never estimates your level or score.", hi: "ज़रूरतों के बारे में अंतिम जानकारी यही है। French Setu कभी आपका स्तर या अंक नहीं आँकता।" } },
    ],
  },
  {
    id: "listen", icon: "🎧", title: { en: "Daily listening", hi: "रोज़ सुनने के लिए" },
    intro: { en: "TEF listening is fast. A few minutes of real French every day trains your ear more than a long session once a week.", hi: "TEF में बोलना तेज़ होता है। हफ़्ते में एक लंबे सत्र से बेहतर है रोज़ कुछ मिनट असली फ़्रेंच सुनना।" },
    items: [
      { title: "Journal en français facile", url: "https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/", publisher: "RFI", level: "A2–B1", free: true,
        what: { en: "A 10-minute world news bulletin in slower, simpler French, with a full transcript.", hi: "धीमी और आसान फ़्रेंच में 10 मिनट की विश्व समाचार बुलेटिन, पूरे लिखित पाठ के साथ।" },
        use: { en: "Listen once without the text. Then paste a paragraph of the transcript into Web discovery to get vocabulary and gap-fills.", hi: "पहले बिना पाठ के सुनें। फिर लिखित पाठ का एक हिस्सा “वेब से सीखें” में चिपकाकर शब्दावली और रिक्त-स्थान अभ्यास पाएँ।" } },
      { title: "Comprendre l'actualité (B1)", url: "https://francaisfacile.rfi.fr/fr/comprendre-actualit%C3%A9-fran%C3%A7ais/b1/", publisher: "RFI", level: "B1", free: true,
        what: { en: "Short news audio with comprehension exercises by level.", hi: "स्तर के अनुसार छोटे समाचार ऑडियो और समझ के अभ्यास।" },
        use: { en: "Good once you reach Phase 3. Their questions feel close to TEF listening.", hi: "चरण 3 तक पहुँचने के बाद अच्छा है। इनके सवाल TEF सुनने जैसे लगते हैं।" } },
      { title: "Radio-Canada Info", url: "https://ici.radio-canada.ca/info", publisher: "Radio-Canada", level: "B1+", free: true,
        what: { en: "Canadian news in French: the accents and topics of daily life in Canada.", hi: "फ़्रेंच में कनाडा की ख़बरें: कनाडा की रोज़मर्रा की ज़िंदगी के लहजे और विषय।" },
        use: { en: "Later in the course: get used to Canadian French (TEF recordings mostly use standard France French).", hi: "पाठ्यक्रम में आगे: कनाडाई फ़्रेंच की आदत डालें (TEF की रिकॉर्डिंग ज़्यादातर फ़्रांस वाली मानक फ़्रेंच में होती हैं)।" } },
    ],
  },
  {
    id: "read", icon: "📚", title: { en: "Reading and video lessons", hi: "पढ़ना और वीडियो पाठ" },
    intro: { en: "Free exercises built around real videos and articles.", hi: "असली वीडियो और लेखों पर बने मुफ़्त अभ्यास।" },
    items: [
      { title: "TV5MONDE Apprendre le français", url: "https://apprendre.tv5monde.com/fr", publisher: "TV5MONDE", level: "A1–C1", free: true,
        what: { en: "Short videos with interactive exercises, sorted by level. There is also a free app.", hi: "स्तर के अनुसार छोटे वीडियो और इंटरैक्टिव अभ्यास। एक मुफ़्त ऐप भी है।" },
        use: { en: "Pick your level's videos on the topic of today's lesson for extra practice.", hi: "आज के पाठ के विषय पर अपने स्तर के वीडियो चुनकर अतिरिक्त अभ्यास करें।" } },
    ],
  },
];

const ROUTINE: { when: T; what: T; href: string }[] = [
  { when: { en: "Every day · 10 min", hi: "रोज़ · 10 मिनट" }, what: { en: "Spaced review first, then today's lesson block.", hi: "पहले दोहराव, फिर आज के पाठ का हिस्सा।" }, href: "/review" },
  { when: { en: "Every day · 5 min", hi: "रोज़ · 5 मिनट" }, what: { en: "One practice game: numbers or genders.", hi: "एक अभ्यास खेल: संख्याएँ या लिंग।" }, href: "/play" },
  { when: { en: "3× a week · 10 min", hi: "हफ़्ते में 3 बार · 10 मिनट" }, what: { en: "Journal en français facile, then make a study kit from it.", hi: "Journal en français facile सुनें, फिर उससे स्टडी किट बनाएँ।" }, href: "/discover" },
  { when: { en: "2× a week · 15 min", hi: "हफ़्ते में 2 बार · 15 मिनट" }, what: { en: "Speaking tutor: TEF task A or B.", hi: "बोलने का अभ्यास: TEF कार्य A या B।" }, href: "/speaking" },
  { when: { en: "Every checkpoint", hi: "हर चेकपॉइंट पर" }, what: { en: "A timed mock section under exam rules.", hi: "परीक्षा के नियमों के साथ एक समयबद्ध मॉक खंड।" }, href: "/exam" },
];

export default async function ResourcesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="eyebrow"><Bi as="span" t={{ en: "Beyond the app", hi: "ऐप के बाहर भी" }} /></p>
        <h1 className="text-3xl font-bold tracking-tight"><Bi as="span" t={{ en: "Free resources for TEF Canada", hi: "TEF Canada के लिए मुफ़्त संसाधन" }} /></h1>
        <Bi className="text-muted" t={{ en: "A short, hand-picked list of free and official sources, and a weekly routine that ties them to your course. Habits beat cramming: short daily practice keeps you going.", hi: "मुफ़्त और आधिकारिक स्रोतों की छोटी, चुनी हुई सूची, और एक साप्ताहिक दिनचर्या जो इन्हें आपके पाठ्यक्रम से जोड़ती है। रटने से ज़्यादा आदत काम आती है: रोज़ का छोटा अभ्यास आपको आगे बढ़ाता रहता है।" }} />
      </header>

      <section className="card space-y-3" aria-labelledby="routine-h">
        <h2 id="routine-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "A simple weekly routine", hi: "एक आसान साप्ताहिक दिनचर्या" }} /></h2>
        <ol className="space-y-2">
          {ROUTINE.map((r, i) => (
            <li key={i}>
              <Link href={r.href} className="flex items-center gap-3 rounded-xl surface-2 p-3 hover:ring-1 hover:ring-brand-400">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1"><Bi as="span" className="block text-xs font-semibold uppercase tracking-wide text-muted" t={r.when} /><Bi as="span" className="block text-sm" t={r.what} /></span>
                <span aria-hidden className="text-muted">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {SECTIONS.map((sec) => (
        <section key={sec.id} className="space-y-3" aria-labelledby={`${sec.id}-h`}>
          <div>
            <h2 id={`${sec.id}-h`} className="text-lg font-semibold"><span aria-hidden>{sec.icon}</span> <Bi as="span" t={sec.title} /></h2>
            <Bi className="text-sm text-muted" t={sec.intro} />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sec.items.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="res-card h-full">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.title}</span>
                    <span className="chip surface-2">{r.level}</span>
                    {r.free && <span className="chip bg-brand-100 text-brand-900"><Bi as="span" t={{ en: "Free", hi: "मुफ़्त" }} /></span>}
                  </span>
                  <span className="text-xs text-muted">{r.publisher} · {new URL(r.url).hostname.replace(/^www\./, "")} ↗</span>
                  <Bi className="text-sm" t={r.what} />
                  <span className="mt-1 rounded-lg bg-saffron-50 p-2 text-sm dark:bg-saffron-700/20"><Bi as="span" className="font-semibold" t={{ en: "How to use it: ", hi: "कैसे इस्तेमाल करें: " }} /><Bi as="span" t={r.use} /></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Bi className="text-xs text-muted" t={{ en: `Links checked on ${CHECKED}. These sites are not part of French Setu and may change. Curated list, not sponsored.`, hi: `लिंक ${CHECKED} को जाँचे गए। ये साइटें French Setu का हिस्सा नहीं हैं और बदल सकती हैं। चुनी हुई सूची है, प्रायोजित नहीं।` }} />
    </div>
  );
}
