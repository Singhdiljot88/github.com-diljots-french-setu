import { AuthForm } from "@/components/auth-form";
import { Bi } from "@/components/bi";
export const metadata = { title: "Create account" };
export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold"><Bi as="span" t={{ en: "Create your account", hi: "अपना खाता बनाएँ" }} /></h1>
      <Bi className="mb-6 text-muted" t={{ en: "Your progress, words and writing are saved to your account.", hi: "आपकी प्रगति, शब्द और लेखन आपके खाते में सहेजे जाते हैं।" }} />
      <AuthForm mode="signup" />
    </main>
  );
}
