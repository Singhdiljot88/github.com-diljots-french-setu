import { MyWords } from "@/components/my-words";
import { Bi } from "@/components/bi";

export const metadata = { title: "My words" };

export default async function WordsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "My words", hi: "मेरे शब्द" }} /></h1>
        <Bi className="text-muted" t={{ en: "Everything you saved from lessons and the dictionary. Add your own example sentence to remember a word better.", hi: "पाठों और शब्दकोश से आपने जो कुछ सहेजा है, सब यहाँ है। किसी शब्द को बेहतर याद रखने के लिए उसका अपना उदाहरण वाक्य जोड़ें।" }} />
      </header>
      <MyWords addInitial={add ?? ""} />
    </div>
  );
}
