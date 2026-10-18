import { MyWords } from "@/components/my-words";

export const metadata = { title: "My words" };

export default async function WordsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">My words <span lang="hi" className="deva text-lg font-normal text-muted">· मेरे शब्द</span></h1>
        <p className="text-muted">Everything you saved from lessons and the dictionary. Add your own example sentence to remember a word better.</p>
      </header>
      <MyWords addInitial={add ?? ""} />
    </div>
  );
}
