import { AuthForm } from "@/components/auth-form";
import { Bi } from "@/components/bi";
export const metadata = { title: "Sign in" };
export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold"><Bi as="span" t={{ en: "Sign in to French Setu", hi: "French Setu में साइन इन करें" }} /></h1>
      <AuthForm mode="signin" />
    </main>
  );
}
