import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/server/auth";
import { EXAM_VARIANTS } from "@/server/profile-schema";
import { SettingsForm } from "@/components/settings-form";

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
        <h1 className="text-2xl font-bold">Settings <span lang="hi" className="deva text-lg font-normal text-muted">· सेटिंग्स</span></h1>
        <p className="text-muted">Signed in as {user.isGuest ? "a guest" : user.email}.</p>
      </header>
      <SettingsForm isGuest={user.isGuest} variants={variants} initial={{
        displayName: p.displayName, explanationLang: p.explanationLang, dailyMinutes: p.dailyMinutes, pace: p.pace, examDate: p.examDate,
        examVariant: p.examVariant, desiredOutcome: p.desiredOutcome, micOptIn: p.micOptIn, slowAudioDefault: p.slowAudioDefault,
        devanagariMode: p.devanagariMode, showIpa: p.showIpa, keepRecordings: p.keepRecordings, timezone: p.timezone, startDate: p.startDate,
      }} />
    </div>
  );
}
