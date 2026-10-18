import { requireUser } from "@/server/auth";
import { listMistakes } from "@/server/mistakes";
import { MistakeNotebook } from "@/components/mistake-notebook";

export const metadata = { title: "Mistake notebook" };
export const dynamic = "force-dynamic";

export default async function MistakesPage() {
  const user = await requireUser();
  const rows = await listMistakes(user.id);
  const initial = rows.map((m) => ({ ...m, lastSeenAt: m.lastSeenAt.toISOString(), createdAt: m.createdAt.toISOString() }));
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Mistake notebook <span lang="hi" className="deva text-lg font-normal text-muted">· गलतियों की कॉपी</span></h1>
        <p className="text-muted">Every error you make is collected here with a fix, an explanation and a short drill. Get the drill right and it is marked resolved; make the same error again and it comes back.</p>
      </header>
      <MistakeNotebook initial={initial} />
    </div>
  );
}
