import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { allLessons, dictIndex } from "@/server/content";
import { toGrammarPoints } from "@/lib/grammar-ref";
import { resolveDrillVerbs } from "@/lib/verb-drill";
import { GrammarStudio } from "@/components/grammar-studio";

export const metadata = { title: "Grammar and verbs" };
export const dynamic = "force-dynamic";

export default async function GrammarPage({ searchParams }: { searchParams: Promise<{ verb?: string; all?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding");
  const st = await learnerState(user.id, profile);
  const lessons = await allLessons();
  const points = toGrammarPoints([...lessons.values()].map((l) => l.day));
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const loaded = showAll ? points : points.filter((p) => p.day <= st.todayDay);
  const idx = await dictIndex();
  const verbs = resolveDrillVerbs(idx.entries.map((e) => ({ id: e.id, entry: e.entry })));
  return <GrammarStudio points={loaded} total={points.length} showAll={showAll} verbs={verbs} courseDay={st.todayDay} initialVerb={sp.verb ?? ""} />;
}
