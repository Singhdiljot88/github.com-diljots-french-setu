import Link from "next/link";
import { getLesson } from "@/server/content";
import { PrefsProvider, defaultPrefs } from "@/components/prefs";
import { TryWords, type TryWord } from "./try-words";
import { GuestButton } from "@/components/auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Try your first French words" };

const PICK = ["bonjour", "merci", "oui", "non", "au revoir"];

/** Public taste of the method: five words with Devanagari pronunciation and audio, no account needed. */
export default async function TryPage() {
  const lesson = await getLesson(1);
  const vocab = lesson?.day.vocabulary ?? [];
  const words: TryWord[] = PICK.map((fr) => vocab.find((v) => v.fr === fr)).filter((v): v is NonNullable<typeof v> => !!v && !!v.pron)
    .map((v) => ({ fr: v.fr, pron: v.pron!, en: v.en, hi: v.hi }));
  return (
    <PrefsProvider value={defaultPrefs}>
      <main id="main" className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><img src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-lg" /> French Setu</Link>
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Your first 5 French words</h1>
          <p lang="hi" className="deva text-lg text-muted">आपके पहले 5 फ़्रेंच शब्द</p>
          <p className="text-muted">No sign-up. Listen, read the Devanagari, say it aloud, then check yourself.</p>
          <p lang="hi" className="deva text-sm text-muted">साइन-अप की ज़रूरत नहीं। सुनिए, देवनागरी पढ़िए, ज़ोर से बोलिए, फिर ख़ुद को जाँचिए।</p>
        </header>
        <TryWords words={words} />
        <section className="card space-y-3">
          <p className="font-semibold">Like it? This is how all 120 days work. · <span lang="hi" className="deva">पसंद आया? सभी 120 दिन ऐसे ही चलते हैं।</span></p>
          <div className="flex flex-wrap gap-2">
            <Link href="/signup" className="btn btn-primary">Start the course · <span lang="hi" className="deva">कोर्स शुरू करें</span></Link>
            <GuestButton />
          </div>
        </section>
      </main>
    </PrefsProvider>
  );
}
