import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { GuestButton } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default async function Welcome({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/today");
  const { deleted } = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      {deleted && <p role="status" className="card mb-6 text-sm">Your account and all its data have been deleted.</p>}
      <div className="mb-6 flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="rounded-xl" />
        <p className="text-lg font-bold">French Setu</p>
      </div>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">120 days of French, from your first <span lang="fr">bonjour</span> to TEF practice.</h1>
      <p lang="hi" className="deva mt-3 text-xl text-muted">पहले «bonjour» से TEF की तैयारी तक — 120 दिन की फ़्रेंच।</p>
      <p className="mt-6 max-w-2xl">
        A structured daily course for people who speak English and Hindi and are starting French from zero.
        Each day tells you exactly what to learn, practise and review, with explanations in English and Hindi,
        approximate Devanagari pronunciation help, listening and speaking from Day 1, and TEF Canada practice later in the course.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="btn btn-primary">Start the course</Link>
        <Link href="/signin" className="btn btn-secondary">Sign in</Link>
        <GuestButton />
      </div>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {[
          ["Starts from zero", "No French placement test for beginners. Day 1 assumes you know nothing."],
          ["Hindi and English", "Every word and grammar point is explained in English, Hindi or both — your choice."],
          ["Honest about results", "The phases are a plan, not a promise. Practice scores are never presented as official TEF, CEFR or NCLC results."],
          ["Works without paid keys", "Without AI keys, a clearly labelled demo mode uses rule-based and scripted helpers."],
        ].map(([t, d]) => (
          <li key={t} className="card"><p className="font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></li>
        ))}
      </ul>
    </main>
  );
}
