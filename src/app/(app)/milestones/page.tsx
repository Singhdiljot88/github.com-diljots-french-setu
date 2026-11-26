import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/server/auth";
import { listEvaluations } from "@/server/evaluation";
import { syncMilestones } from "@/server/milestones";
import { MILESTONES, milestoneDef } from "@/lib/milestones";
import { Bi } from "@/components/bi";
import { Celebration } from "@/components/celebration";
import { EvaluationCard } from "@/components/evaluation-card";

export const metadata = { title: "Milestones" };
export const dynamic = "force-dynamic";

export default async function MilestonesPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding");
  const { all, fresh } = await syncMilestones(user.id, profile.timezone);
  const history = await listEvaluations(user.id);
  const have = new Set(all.map((m) => m.key));
  const catalog = [...MILESTONES, ...all.filter((m) => m.key.startsWith("nclc_")).map((m) => milestoneDef(m.key))];
  return (
    <div className="space-y-6">
      {fresh.length > 0 && <Celebration items={fresh} />}
      <header>
        <h1><Bi as="span" t={{ en: "Milestones", hi: "उपलब्धियाँ" }} /></h1>
        <p className="text-muted"><Bi as="span" t={{ en: "Badges for showing up, and practice scores so you can see the line move.", hi: "नियमित अभ्यास के बैज, और अभ्यास अंक ताकि प्रगति दिखे।" }} /></p>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {catalog.map((m) => {
          const got = all.find((x) => x.key === m.key);
          return (
            <li key={m.key} className={`badge-tile ${got ? "" : "is-locked"}`}>
              <span className="text-2xl" aria-hidden>{m.badge}</span>
              <Bi className="font-semibold" t={{ en: m.en, hi: m.hi }} />
              {got ? <Bi className="text-xs text-muted" t={got.note} /> : <Bi className="text-xs text-muted" t={{ en: "Not yet", hi: "अभी नहीं" }} />}
            </li>
          );
        })}
      </ul>
      <section className="space-y-3">
        <h2 className="font-semibold"><Bi as="span" t={{ en: "Score history", hi: "अंकों का इतिहास" }} /></h2>
        {history.length === 0 && <p className="text-sm text-muted"><Bi as="span" t={{ en: "Finish a speaking session, a writing check, or an exercise evaluation to start the history.", hi: "इतिहास शुरू करने के लिए बोलने का सत्र, लेखन जाँच, या अभ्यास मूल्यांकन पूरा कीजिए।" }} /> <Link className="underline" href="/speaking"><Bi as="span" t={{ en: "Speaking", hi: "बोलना" }} /></Link></p>}
        {history.map((ev) => <EvaluationCard key={ev.id} ev={ev} />)}
      </section>
      <p className="text-xs text-muted"><Bi as="span" t={{ en: `${have.size} unlocked. Estimates are not official TEF, CLB, or NCLC results.`, hi: `${have.size} खुलीं। अनुमान आधिकारिक TEF, CLB, या NCLC परिणाम नहीं हैं।` }} /></p>
    </div>
  );
}
