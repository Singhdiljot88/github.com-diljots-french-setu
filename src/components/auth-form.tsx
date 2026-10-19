"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Bi, useBiLabel } from "./bi";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const L = useBiLabel();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api(`/api/auth/${mode}`, { body: { email, password } });
      router.push(mode === "signup" ? "/onboarding" : "/today");
      router.refresh();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">{L({ en: "Email", hi: "ईमेल" })}</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">{L({ en: "Password", hi: "पासवर्ड" })}</label>
        <input id="password" className="input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === "signup" && <Bi className="mt-1 text-xs text-muted" t={{ en: "At least 8 characters.", hi: "कम से कम 8 अक्षर।" }} />}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}><Bi as="span" t={busy ? { en: "Please wait…", hi: "कृपया रुकें…" } : mode === "signup" ? { en: "Create account", hi: "खाता बनाएँ" } : { en: "Sign in", hi: "साइन इन करें" }} /></button>
      <p className="text-center text-sm text-muted">
        {mode === "signup"
          ? <><Bi as="span" t={{ en: "Already have an account?", hi: "पहले से खाता है?" }} /> <Link className="underline" href="/signin"><Bi as="span" t={{ en: "Sign in", hi: "साइन इन करें" }} /></Link></>
          : <><Bi as="span" t={{ en: "New here?", hi: "पहली बार आए हैं?" }} /> <Link className="underline" href="/signup"><Bi as="span" t={{ en: "Create an account", hi: "खाता बनाएँ" }} /></Link></>}
      </p>
    </form>
  );
}

export function GuestButton({ className = "btn btn-secondary" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const L = useBiLabel();
  const start = async () => {
    setBusy(true); setError(null);
    try {
      await api("/api/auth/guest", { body: {}, signal: AbortSignal.timeout(90_000) });
      router.push("/onboarding"); router.refresh();
    } catch (err) {
      setError((err as Error).name === "TimeoutError" ? L({ en: "The server did not answer within 90 seconds. Try again; if it keeps happening, check the hosting logs.", hi: "सर्वर ने 90 सेकंड में जवाब नहीं दिया। फिर से कोशिश करें; अगर ऐसा बार-बार हो, तो होस्टिंग के लॉग देखें।" }) : (err as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <button type="button" className={className} disabled={busy} onClick={start}>
        <Bi as="span" t={busy ? { en: "Creating guest account…", hi: "मेहमान खाता बनाया जा रहा है…" } : { en: "Try it as a guest", hi: "मेहमान के रूप में आज़माएँ" }} />
      </button>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
