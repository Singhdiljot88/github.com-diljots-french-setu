"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Bi } from "./bi";

type Plan = { behindBy: number; currentDay: number; options: { key: string; en: string; hi: string }[]; examWarning?: { en: string; hi: string } };

export function RecoveryCard({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <section className="card border-saffron-500/50" aria-labelledby="recovery-h">
      <h2 id="recovery-h" className="font-semibold"><Bi as="span" t={{ en: "Welcome back — let's get you back on track", hi: "फिर से स्वागत है — चलिए, आपको दोबारा समय पर लाते हैं" }} /></h2>
      <Bi className="text-sm text-muted" t={{ en: `Life happens. You are ${plan.behindBy} day(s) behind the plan, and your completed work is safe. Pick what feels manageable:`, hi: `ऐसा होता है। आप योजना से ${plan.behindBy} दिन पीछे हैं, और आपका पूरा किया हुआ काम सुरक्षित है। जो आसान लगे, वह चुनिए:` }} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {plan.options.map((o) => (
          <button key={o.key} type="button" disabled={busy} className={`rounded-xl border p-3 text-left text-sm ${chosen === o.key ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40" : "border-app"}`}
            onClick={async () => {
              setChosen(o.key);
              if (o.key === "shift") { setBusy(true); await api("/api/schedule/shift", { body: {} }); router.refresh(); setBusy(false); }
            }}>
            <Bi t={o} />
          </button>
        ))}
      </div>
      {chosen === "catch_up" && <Bi className="mt-2 text-sm" t={{ en: `Good choice. Start with today's review, then continue with Day ${plan.currentDay}.`, hi: `अच्छा फ़ैसला। आज के दोहराव से शुरू कीजिए, फिर दिन ${plan.currentDay} जारी रखिए।` }} />}
      {plan.examWarning && <Bi className="mt-3 rounded-lg bg-saffron-100 p-2 text-sm text-saffron-700" t={plan.examWarning} />}
    </section>
  );
}
