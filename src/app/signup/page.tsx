import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Create account" };
export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold">Create your account</h1>
      <p className="mb-6 text-muted">Your progress, words and writing are saved to your account.</p>
      <AuthForm mode="signup" />
    </main>
  );
}
