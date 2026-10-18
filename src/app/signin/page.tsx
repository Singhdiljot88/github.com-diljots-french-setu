import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Sign in" };
export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Sign in to French Setu</h1>
      <AuthForm mode="signin" />
    </main>
  );
}
