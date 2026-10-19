import { DictionarySearch } from "@/components/dictionary-search";
import { Bi } from "@/components/bi";

export const metadata = { title: "Dictionary" };

export default async function DictionaryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Dictionary", hi: "शब्दकोश" }} /></h1>
        <Bi className="text-muted" t={{ en: "Search in French, English or Hindi. Conjugated forms (mangeons, allé), plurals and common misspellings find the main word too.", hi: "फ़्रेंच, अंग्रेज़ी या हिंदी में खोजें। क्रिया के बदले हुए रूप (mangeons, allé), बहुवचन और आम ग़लत वर्तनी से भी मूल शब्द मिल जाता है।" }} />
      </header>
      <DictionarySearch initial={q ?? ""} />
    </div>
  );
}
