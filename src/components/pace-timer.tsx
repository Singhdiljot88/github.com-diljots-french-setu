"use client";
import { useEffect, useState } from "react";

/** Soft countdown for practice at exam pace. It never locks anything; the strict timers are in the mock exam. */
export function PaceTimer({ seconds, note }: { seconds: number; note: string }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.round(seconds - (now - start) / 1000);
  const fmt = (s: number) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
  return (
    <div className={`sticky top-16 z-10 rounded-xl border p-2 text-sm ${left < 0 ? "border-red-500 bg-red-50 dark:bg-red-950" : "border-app surface"}`} role="timer" aria-live="off">
      <span className="font-mono text-lg font-semibold">{left >= 0 ? fmt(left) : `+${fmt(left)}`}</span> <span className="text-muted">{left >= 0 ? "left" : "over the exam pace"} · {note}</span>
    </div>
  );
}
