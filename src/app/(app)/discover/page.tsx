import { CURATED_LINKS } from "@/server/web/search";
import { Discover } from "@/components/discover";

export const metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Discover <span lang="hi" className="deva text-lg font-normal text-muted">· खोजिए</span></h1>
        <p className="text-muted">Turn real French from the web, or any text you paste, into a reading exercise with vocabulary and gap-fills.</p>
      </header>
      <Discover curated={[...CURATED_LINKS]} />
    </div>
  );
}
