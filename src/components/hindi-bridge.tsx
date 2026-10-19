"use client";
import { Bi } from "./bi";
import { HINDI_BRIDGES, type BridgeKey } from "@/lib/hindi-bridges";

/** One reusable box for French ideas that Hindi grammar already teaches. */
export function HindiBridge({ topic, className = "" }: { topic: BridgeKey; className?: string }) {
  const b = HINDI_BRIDGES[topic];
  return (
    <aside className={`rounded-xl border-l-4 border-saffron-500 bg-saffron-100/50 p-3 dark:bg-saffron-700/20 ${className}`} aria-label={b.title.en}>
      <p className="text-sm font-semibold"><Bi as="span" t={b.title} /></p>
      <Bi t={b.text} className="mt-1 text-sm" />
    </aside>
  );
}
