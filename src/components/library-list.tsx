"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { LibraryItem } from "@/server/library";
import { PHASES } from "@/content/outline";
import { useBiLabel } from "./bi";

const TYPE_LABEL: Record<string, { en: string; hi: string }> = {
  dialogue: { en: "Dialogue", hi: "बातचीत" }, monologue: { en: "Monologue", hi: "एकालाप" }, announcement: { en: "Announcement", hi: "घोषणा" }, voicemail: { en: "Voicemail", hi: "वॉइसमेल" }, interview: { en: "Interview", hi: "साक्षात्कार" }, radio: { en: "Radio", hi: "रेडियो" }, street_interview: { en: "Street interview", hi: "सड़क पर बातचीत" }, story: { en: "Story", hi: "कहानी" },
  sign: { en: "Sign", hi: "सूचना-पट" }, menu: { en: "Menu", hi: "मेन्यू" }, advertisement: { en: "Advert", hi: "विज्ञापन" }, message: { en: "Message", hi: "संदेश" }, notice: { en: "Notice", hi: "सूचना" }, email: { en: "Email", hi: "ईमेल" }, form: { en: "Form", hi: "फ़ॉर्म" }, article: { en: "Article", hi: "लेख" }, opinion: { en: "Opinion", hi: "राय" }, schedule: { en: "Timetable", hi: "समय-सारणी" }, chart: { en: "Chart", hi: "चार्ट" }, letter: { en: "Letter", hi: "पत्र" },
};

export function LibraryList({ items, kind, currentDay }: { items: LibraryItem[]; kind: "listening" | "reading"; currentDay: number }) {
  const [phase, setPhase] = useState(0);
  const label = useBiLabel();
  const typeLabel = (t: string) => (TYPE_LABEL[t] ? label(TYPE_LABEL[t]) : t);
  const all = label({ en: "All", hi: "सभी" });
  const [type, setType] = useState("");
  const [status, setStatus] = useState<"" | "new" | "review" | "done">("");
  const types = useMemo(() => [...new Set(items.map((i) => i.type))].sort(), [items]);
  const shown = items.filter((i) => (!phase || i.phase === phase) && (!type || i.type === type) && (
    !status || (status === "new" ? i.answered === 0 : status === "review" ? i.answered > 0 && i.correct < i.questions : i.answered === i.questions && i.correct === i.questions)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">{label({ en: "Phase", hi: "चरण" })} <select className="input mt-1 w-auto" value={phase} onChange={(e) => setPhase(Number(e.target.value))}><option value={0}>{all}</option>{PHASES.map((p) => <option key={p.phase} value={p.phase}>{p.phase}: {label(p)}</option>)}</select></label>
        <label className="text-sm">{label({ en: "Type", hi: "प्रकार" })} <select className="input mt-1 w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">{all}</option>{types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}</select></label>
        <label className="text-sm">{label({ en: "Status", hi: "स्थिति" })} <select className="input mt-1 w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="">{all}</option><option value="new">{label({ en: "Not tried", hi: "अभी नहीं किया" })}</option><option value="review">{label({ en: "Has mistakes", hi: "कुछ ग़लतियाँ हैं" })}</option><option value="done">{label({ en: "All correct", hi: "सब सही" })}</option></select></label>
      </div>
      <p className="text-sm text-muted" aria-live="polite">{label({
          en: `${shown.length} of ${items.length}${kind === "listening" ? " recordings" : " texts"}. Items after your current day (${currentDay}) may use grammar you haven't met yet.`,
          hi: `${items.length} में से ${shown.length}${kind === "listening" ? " रिकॉर्डिंग" : " पाठ"}। आपके मौजूदा दिन (${currentDay}) के बाद वाले हिस्सों में ऐसा व्याकरण हो सकता है जो आपने अभी नहीं सीखा।`,
        })}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((i) => (
          <li key={i.day}>
            <Link href={`/${kind}/${i.day}`} className="card block h-full hover:border-brand-500">
              <span className="flex items-center justify-between text-xs text-muted"><span>{label({ en: "Day", hi: "दिन" })} {i.day} · {typeLabel(i.type)}{i.mode ? ` · ${i.mode === "pedagogical" ? label({ en: "slow & clear", hi: "धीमा और साफ़" }) : label({ en: "natural speed", hi: "सामान्य गति" })}` : ""}</span>{i.day > currentDay && <span className="chip">{label({ en: "ahead", hi: "आगे का" })}</span>}</span>
              <span className="mt-1 block font-medium" lang="fr">{i.title}</span>
              <span className="block text-sm text-muted">{i.titleEn}</span>
              <span className="mt-1 block text-xs">{i.answered === 0 ? label({ en: "Not tried", hi: "अभी नहीं किया" }) : label({ en: `${i.correct}/${i.questions} correct · ${i.answered}/${i.questions} answered`, hi: `${i.correct}/${i.questions} सही · ${i.answered}/${i.questions} के उत्तर दिए` })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
