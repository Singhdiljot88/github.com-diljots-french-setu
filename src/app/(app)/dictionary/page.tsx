import { DictionarySearch } from "@/components/dictionary-search";

export const metadata = { title: "Dictionary" };

export default async function DictionaryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Dictionary <span lang="hi" className="deva text-lg font-normal text-muted">· शब्दकोश</span></h1>
        <p className="text-muted">Search in French, English or Hindi. Conjugated forms (mangeons, allé), plurals and common misspellings find the main word too.</p>
      </header>
      <DictionarySearch initial={q ?? ""} />
    </div>
  );
}
