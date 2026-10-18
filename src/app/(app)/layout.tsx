import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { providerStatus } from "@/server/providers/config";
import { PrefsProvider } from "@/components/prefs";
import { AppNav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = await getProfile(user.id);
  if (!profile?.onboardedAt) redirect("/onboarding");
  const state = await learnerState(user.id, profile);
  const providers = providerStatus();
  return (
    <PrefsProvider value={{
      explanationLang: profile.explanationLang, devanagariMode: profile.devanagariMode, showIpa: profile.showIpa,
      slowAudioDefault: profile.slowAudioDefault, micOptIn: profile.micOptIn, keepRecordings: profile.keepRecordings,
      timezone: profile.timezone, courseDay: state.todayDay, providers,
    }}>
      <AppNav demoAi={!providers.ai.available} isGuest={user.isGuest} />
      <main id="main" className="mx-auto max-w-4xl px-4 pb-28 pt-4 print:p-0 print:ml-0 lg:ml-64 lg:max-w-none lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </PrefsProvider>
  );
}
