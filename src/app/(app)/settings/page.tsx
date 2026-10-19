import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/server/auth";
import { EXAM_VARIANTS } from "@/server/profile-schema";
import { SettingsForm } from "@/components/settings-form";
import { Bi } from "@/components/bi";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const p = await getProfile(user.id);
  if (!p) redirect("/onboarding");
  const variants = Object.entries(EXAM_VARIANTS).map(([id, v]) => ({ id, en: v.en, supported: v.supported }));
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Settings", hi: "सेटिंग्स" }} /></h1>
        <Bi className="text-muted" t={user.isGuest ? { en: "Signed in as a guest.", hi: "आप मेहमान के रूप में साइन इन हैं।" } : { en: `Signed in as ${user.email}.`, hi: `${user.email} से साइन इन हैं।` }} />
      </header>
      <SettingsForm isGuest={user.isGuest} variants={variants} initial={{
        displayName: p.displayName, explanationLang: p.explanationLang, dailyMinutes: p.dailyMinutes, pace: p.pace, examDate: p.examDate,
        examVariant: p.examVariant, desiredOutcome: p.desiredOutcome, micOptIn: p.micOptIn, slowAudioDefault: p.slowAudioDefault,
        devanagariMode: p.devanagariMode, showIpa: p.showIpa, keepRecordings: p.keepRecordings, timezone: p.timezone, startDate: p.startDate,
      }} />
    </div>
  );
}
