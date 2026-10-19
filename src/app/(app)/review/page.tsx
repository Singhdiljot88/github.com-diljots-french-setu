import { ReviewSession } from "@/components/review-session";
import { Bi } from "@/components/bi";

export const metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Review", hi: "दोहराव" }} /></h1>
        <Bi className="text-muted" t={{ en: "Spaced repetition: words come back just before you would forget them. Answer, then rate how well you knew it.", hi: "दोहराव का तरीका: शब्द ठीक उस समय वापस आते हैं जब आप उन्हें भूलने वाले होते हैं। जवाब दीजिए, फिर बताइए कि आपको वह कितना अच्छी तरह याद था।" }} />
      </header>
      <ReviewSession />
    </div>
  );
}
