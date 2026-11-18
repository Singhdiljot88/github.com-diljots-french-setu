"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bi, useBiLabel } from "./bi";
import { usePrefs } from "./prefs";
import { CommandPalette } from "./command-palette";
import { NAV_GROUPS } from "@/lib/nav-items";

const SHORT: Record<string, { en: string; hi: string }> = { "/play": { en: "Games", hi: "खेल" }, "/speaking": { en: "Speak", hi: "बोलें" }, "/hindi": { en: "Hindi→FR", hi: "हिंदी→FR" } };

const GROUPS = NAV_GROUPS;

const find = (href: string) => GROUPS.flatMap((g) => g.items).find((i) => i.href === href)!;
const MOBILE = [find("/today"), find("/review"), find("/play"), find("/speaking"), find("/hindi")].map((i) => ({ ...i, short: SHORT[i.href] ?? { en: i.label, hi: i.hi } }));

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { explanationLang: lang } = usePrefs();
  const L = useBiLabel();
  return (
    <nav aria-label={L({ en: "Main", hi: "मुख्य" })}>
      {GROUPS.map((g) => (
        <div key={g.title.en} className="mb-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{lang === "hi" ? g.title.hi : g.title.en}</p>
          <ul>
            {g.items.map((it) => {
              const active = path === it.href || path.startsWith(it.href + "/");
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${active ? "bg-brand-100 font-semibold text-brand-900 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-brand-600 dark:bg-brand-900 dark:text-brand-50" : "hover:bg-[var(--surface-2)]"}`}>
                    <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-[var(--surface-2)] text-base">{it.icon}</span>
                    {lang !== "hi" && <span>{it.label}</span>}
                    {lang !== "en" && <span lang="hi" className={`deva ${lang === "both" ? "ml-auto text-xs text-muted" : ""}`}>{it.hi}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const PAGES = GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, en: i.label, hi: i.hi, icon: i.icon })));

export function AppNav({ demoAi, isGuest }: { demoAi: boolean; isGuest: boolean }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const path = usePathname();
  const L = useBiLabel();
  const { explanationLang: lang } = usePrefs();
  const openPalette = useCallback(() => setPalette(true), []);
  const closePalette = useCallback(() => setPalette(false), []);
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <aside className="surface fixed inset-y-0 left-0 hidden print:!hidden w-64 overflow-y-auto border-y-0 border-l-0 p-3 lg:block">
        <Link href="/today" className="mb-3 flex items-center gap-2 px-3 py-2">
          <img src="/icons/icon-192.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="font-bold">French Setu</span>
        </Link>
        <button type="button" onClick={openPalette} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-app px-3 py-2 text-left text-sm text-muted hover:border-brand-400">
          <span aria-hidden>🔎</span>
          <span className="min-w-0 flex-1 truncate">{lang === "hi" ? "खोजें या जाएँ" : "Search or jump to…"}</span>
          <kbd className="chip surface-2">Ctrl K</kbd>
        </button>
        <NavList />
        <Badges demoAi={demoAi} isGuest={isGuest} />
      </aside>
      <header className="sticky top-0 z-30 flex print:hidden items-center gap-2 border-b border-app bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-2 backdrop-blur-lg lg:hidden">
        <Link href="/today" className="flex min-w-0 items-center gap-2 font-bold"><img src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-md" /><span className="truncate">French Setu</span></Link>
        {demoAi && <span className="chip ml-auto shrink-0 bg-saffron-100 text-saffron-700">{lang === "hi" ? "डेमो मोड" : "Demo AI"}</span>}
        <button type="button" className={`btn btn-ghost btn-sm shrink-0 ${demoAi ? "" : "ml-auto"}`} onClick={openPalette} aria-label={L({ en: "Search or jump to", hi: "खोजें या जाएँ" })}>🔎</button>
        <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-menu" aria-label={L({ en: "Menu", hi: "मेन्यू" })}><span aria-hidden>☰</span> <span className="hidden sm:inline">{lang === "hi" ? "मेन्यू" : "Menu"}</span></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={L({ en: "Menu", hi: "मेन्यू" })} id="mobile-menu">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={L({ en: "Close menu", hi: "मेन्यू बंद करें" })} onClick={() => setOpen(false)} />
          <div className="surface absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-y-auto p-3">
            <div className="mb-2 flex justify-end"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕ <Bi as="span" t={{ en: "Close", hi: "बंद करें" }} /></button></div>
            <NavList onNavigate={() => setOpen(false)} />
            <Badges demoAi={demoAi} isGuest={isGuest} />
          </div>
        </div>
      )}
      <nav aria-label={L({ en: "Quick links", hi: "जल्दी पहुँचें" })} className="print:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-app bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        {MOBILE.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "font-semibold text-brand-700 dark:text-brand-200" : "text-muted"}`}>
              <span aria-hidden className={`grid h-7 w-12 place-items-center rounded-full text-lg transition-colors ${active ? "bg-brand-100 dark:bg-brand-900" : ""}`}>{it.icon}</span>{lang === "hi" ? <span lang="hi" className="deva">{it.short.hi}</span> : it.short.en}
            </Link>
          );
        })}
      </nav>
      <CommandPalette open={palette} onOpen={openPalette} onClose={closePalette} pages={PAGES} />
    </>
  );
}

function Badges({ demoAi, isGuest }: { demoAi: boolean; isGuest: boolean }) {
  return (
    <div className="mt-2 space-y-2 px-3 text-xs text-muted">
      {demoAi && <Bi className="rounded-lg bg-saffron-100 p-2 text-saffron-700" t={{
        en: "Demo mode. No AI key is configured, so feedback comes from rule-based and scripted helpers, clearly labelled. It is not live AI.",
        hi: "यह डेमो मोड है। कोई AI कुंजी सेट नहीं है, इसलिए फ़ीडबैक नियमों पर आधारित और पहले से लिखे सहायकों से आता है, जिन पर साफ़ लेबल लगा होता है। यह लाइव AI नहीं है।",
      }} />}
      {isGuest && <p className="rounded-lg surface-2 p-2"><Bi as="span" t={{ en: "You are using a guest account.", hi: "आप मेहमान खाते का इस्तेमाल कर रहे हैं।" }} /> <Link className="underline" href="/settings#account"><Bi as="span" t={{ en: "Add an email and password to keep it.", hi: "इसे बनाए रखने के लिए ईमेल और पासवर्ड जोड़ें।" }} /></Link></p>}
      <form action="/api/auth/signout" method="post"><button className="underline" type="submit"><Bi as="span" t={{ en: "Sign out", hi: "साइन आउट करें" }} /></button></form>
    </div>
  );
}
