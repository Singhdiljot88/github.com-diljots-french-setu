import { requireUser } from "@/server/auth";
import { listMistakes } from "@/server/mistakes";
import { MistakeNotebook } from "@/components/mistake-notebook";
import { Bi } from "@/components/bi";

export const metadata = { title: "Mistake notebook" };
export const dynamic = "force-dynamic";

export default async function MistakesPage() {
  const user = await requireUser();
  const rows = await listMistakes(user.id);
  const initial = rows.map((m) => ({ ...m, lastSeenAt: m.lastSeenAt.toISOString(), createdAt: m.createdAt.toISOString() }));
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Mistake notebook", hi: "ग़लतियों की कॉपी" }} /></h1>
        <Bi className="text-muted" t={{ en: "Every error you make is collected here with a fix, an explanation and a short drill. Get the drill right and it is marked resolved; make the same error again and it comes back.", hi: "आपकी हर ग़लती यहाँ सुधार, समझाइश और एक छोटे अभ्यास के साथ जमा होती है। अभ्यास सही करने पर वह सुलझी हुई मानी जाती है; वही ग़लती दोबारा करने पर वह फिर लौट आती है।" }} />
      </header>
      <MistakeNotebook initial={initial} />
    </div>
  );
}
