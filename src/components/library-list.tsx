"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { LibraryItem } from "@/server/library";
import { PHASES } from "@/content/outline";

const TYPE_LABEL: Record<string, string> = {
  dialogue: "Dialogue", monologue: "Monologue", announcement: "Announcement", voicemail: "Voicemail", interview: "Interview", radio: "Radio", street_interview: "Street interview", story: "Story",
  sign: "Sign", menu: "Menu", advertisement: "Advert", message: "Message", notice: "Notice", email: "Email", form: "Form", article: "Article", opinion: "Opinion", schedule: "Timetable", chart: "Chart", letter: "Letter",
};

export function LibraryList({ items, kind, currentDay }: { items: LibraryItem[]; kind: "listening" | "reading"; currentDay: number }) {
  const [phase, setPhase] = useState(0);
  const [type, setType] = useState("");
  const [status, setStatus] = useState<"" | "new" | "review" | "done">("");
  const types = useMemo(() => [...new Set(items.map((i) => i.type))].sort(), [items]);
  const shown = items.filter((i) => (!phase || i.phase === phase) && (!type || i.type === type) && (
    !status || (status === "new" ? i.answered === 0 : status === "review" ? i.answered > 0 && i.correct < i.questions : i.answered === i.questions && i.correct === i.questions)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">Phase <select className="input mt-1 w-auto" value={phase} onChange={(e) => setPhase(Number(e.target.value))}><option value={0}>All</option>{PHASES.map((p) => <option key={p.phase} value={p.phase}>{p.phase}: {p.en}</option>)}</select></label>
        <label className="text-sm">Type <select className="input mt-1 w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All</option>{types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}</select></label>
        <label className="text-sm">Status <select className="input mt-1 w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="">All</option><option value="new">Not tried</option><option value="review">Has mistakes</option><option value="done">All correct</option></select></label>
      </div>
      <p className="text-sm text-muted" aria-live="polite">{shown.length} of {items.length}{kind === "listening" ? " recordings" : " texts"}. Items after your current day ({currentDay}) may use grammar you haven&apos;t met yet.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((i) => (
          <li key={i.day}>
            <Link href={`/${kind}/${i.day}`} className="card block h-full hover:border-brand-500">
              <span className="flex items-center justify-between text-xs text-muted"><span>Day {i.day} · {TYPE_LABEL[i.type] ?? i.type}{i.mode ? ` · ${i.mode === "pedagogical" ? "slow & clear" : "natural speed"}` : ""}</span>{i.day > currentDay && <span className="chip">ahead</span>}</span>
              <span className="mt-1 block font-medium" lang="fr">{i.title}</span>
              <span className="block text-sm text-muted">{i.titleEn}</span>
              <span className="mt-1 block text-xs">{i.answered === 0 ? "Not tried" : `${i.correct}/${i.questions} correct · ${i.answered}/${i.questions} answered`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
