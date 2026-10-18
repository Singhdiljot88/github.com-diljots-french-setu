"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const GROUPS: { title: string; items: { href: string; label: string; hi: string; icon: string }[] }[] = [
  { title: "Learn", items: [
    { href: "/today", label: "Today", hi: "आज", icon: "☀️" },
    { href: "/course", label: "Course map", hi: "कोर्स नक्शा", icon: "🗺️" },
    { href: "/review", label: "Review", hi: "दोहराई", icon: "🔁" },
    { href: "/dictionary", label: "Dictionary", hi: "शब्दकोश", icon: "📖" },
    { href: "/words", label: "My words", hi: "मेरे शब्द", icon: "⭐" },
  ] },
  { title: "Practise", items: [
    { href: "/pronunciation", label: "Pronunciation lab", hi: "उच्चारण लैब", icon: "👄" },
    { href: "/speaking", label: "Speaking tutor", hi: "बोलने का अभ्यास", icon: "🗣️" },
    { href: "/writing", label: "Writing studio", hi: "लेखन स्टूडियो", icon: "✍️" },
    { href: "/listening", label: "Listening library", hi: "सुनने का अभ्यास", icon: "🎧" },
    { href: "/reading", label: "Reading library", hi: "पढ़ने का अभ्यास", icon: "📰" },
    { href: "/discover", label: "Web discovery", hi: "वेब से सीखें", icon: "🔎" },
  ] },
  { title: "TEF", items: [{ href: "/exam", label: "TEF practice & mocks", hi: "TEF अभ्यास", icon: "📝" }] },
  { title: "You", items: [
    { href: "/mistakes", label: "Mistake notebook", hi: "ग़लतियों की कॉपी", icon: "📒" },
    { href: "/progress", label: "Progress", hi: "प्रगति", icon: "📈" },
    { href: "/settings", label: "Settings", hi: "सेटिंग्स", icon: "⚙️" },
  ] },
];

const MOBILE = [GROUPS[0].items[0], GROUPS[0].items[1], GROUPS[0].items[2], GROUPS[0].items[3]];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</p>
          <ul>
            {g.items.map((it) => {
              const active = path === it.href || path.startsWith(it.href + "/");
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-100 font-semibold text-brand-900 dark:bg-brand-900 dark:text-brand-50" : "hover:bg-[var(--surface-2)]"}`}>
                    <span aria-hidden>{it.icon}</span>
                    <span>{it.label}</span>
                    <span lang="hi" className="deva ml-auto text-xs text-muted">{it.hi}</span>
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

export function AppNav({ demoAi, isGuest }: { demoAi: boolean; isGuest: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <aside className="surface fixed inset-y-0 left-0 hidden print:!hidden w-64 overflow-y-auto border-y-0 border-l-0 p-3 lg:block">
        <Link href="/today" className="mb-4 flex items-center gap-2 px-3 py-2">
          <img src="/icons/icon-192.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="font-bold">French Setu</span>
        </Link>
        <NavList />
        <Badges demoAi={demoAi} isGuest={isGuest} />
      </aside>
      <header className="surface sticky top-0 z-30 flex print:hidden items-center gap-2 border-x-0 border-t-0 px-4 py-2 lg:hidden">
        <Link href="/today" className="flex items-center gap-2 font-bold"><img src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-md" />French Setu</Link>
        {demoAi && <span className="chip ml-auto bg-saffron-100 text-saffron-700">Demo AI</span>}
        <button type="button" className={`btn btn-ghost btn-sm ${demoAi ? "" : "ml-auto"}`} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-menu">☰ Menu</button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" id="mobile-menu">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="surface absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-y-auto p-3">
            <div className="mb-2 flex justify-end"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕ Close</button></div>
            <NavList onNavigate={() => setOpen(false)} />
            <Badges demoAi={demoAi} isGuest={isGuest} />
          </div>
        </div>
      )}
      <nav aria-label="Quick" className="print:hidden surface fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center py-2 text-xs ${active ? "font-semibold text-brand-700 dark:text-brand-200" : "text-muted"}`}>
              <span aria-hidden className="text-lg">{it.icon}</span>{it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function Badges({ demoAi, isGuest }: { demoAi: boolean; isGuest: boolean }) {
  return (
    <div className="mt-2 space-y-2 px-3 text-xs text-muted">
      {demoAi && <p className="rounded-lg bg-saffron-100 p-2 text-saffron-700"><strong>Demo mode.</strong> No AI key is configured, so feedback comes from rule-based and scripted helpers, clearly labelled. It is not live AI.</p>}
      {isGuest && <p className="rounded-lg surface-2 p-2">You are using a guest account. <Link className="underline" href="/settings#account">Add an email and password</Link> to keep it.</p>}
      <form action="/api/auth/signout" method="post"><button className="underline" type="submit">Sign out</button></form>
    </div>
  );
}
