import { CURATED_LINKS } from "@/server/web/search";
import { Discover } from "@/components/discover";
import { Bi } from "@/components/bi";

export const metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Discover", hi: "खोजिए" }} /></h1>
        <Bi className="text-muted" t={{ en: "Turn real French from the web, or any text you paste, into a reading exercise with vocabulary and gap-fills.", hi: "वेब की असली फ़्रेंच, या आपका चिपकाया कोई भी पाठ, शब्दावली और खाली जगह भरने वाले अभ्यास के साथ पढ़ने के अभ्यास में बदलें।" }} />
      </header>
      <Discover curated={[...CURATED_LINKS]} />
    </div>
  );
}
