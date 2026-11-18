"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bi, useBiLabel } from "./bi";

const KEY = "fs-guest-banner-dismissed";

/** A visible reminder that a guest's progress is tied to this browser until they add an email. */
export function GuestBanner() {
  const [hidden, setHidden] = useState(false);
  const L = useBiLabel();
  useEffect(() => { if (sessionStorage.getItem(KEY) === "1") setHidden(true); }, []);
  if (hidden) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-saffron-300 bg-saffron-100 px-3 py-2 text-sm text-saffron-700 dark:border-saffron-700 dark:bg-saffron-700/20 dark:text-saffron-200">
      <Bi as="span" className="min-w-0 flex-1" t={{
        en: "You are using a guest account. Progress stays in this browser until you add an email and password.",
        hi: "आप मेहमान खाते का इस्तेमाल कर रहे हैं। जब तक आप ईमेल और पासवर्ड नहीं जोड़ते, प्रगति इसी ब्राउज़र में रहती है।",
      }} />
      <Link href="/settings#account" className="btn btn-primary btn-sm">{L({ en: "Keep this account", hi: "खाता सहेजें" })}</Link>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { sessionStorage.setItem(KEY, "1"); setHidden(true); }}>{L({ en: "Dismiss", hi: "छिपाएँ" })}</button>
    </div>
  );
}
