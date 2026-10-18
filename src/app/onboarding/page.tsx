import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { localDate } from "@/lib/dates";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = await getProfile(user.id);
  if (profile?.onboardedAt) redirect("/today");
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Let&apos;s set up your plan</h1>
      <p lang="hi" className="deva mb-6 text-muted">चलिए आपकी योजना बनाते हैं</p>
      <OnboardingForm defaultTz="UTC" today={localDate("UTC")} />
    </main>
  );
}
