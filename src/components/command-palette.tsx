"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { dayFromQuery, filterPages, isDayOnlyQuery, type JumpPage } from "@/lib/jump";
import { Bi, useBiLabel } from "./bi";

type Hit = { id: string; lemma: string; en: string[]; hi: string[]; pos: string };

type Item =
  | { key: string; href: string; icon: string; en: string; hi: string; hint: { en: string; hi: string } };

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Ctrl/⌘K (or /) jump box: pages, a lesson day, or a dictionary word. */
export function CommandPalette({ open, onOpen, onClose, pages }: { open: boolean; onOpen: () => void; onClose: () => void; pages: JumpPage[] }) {
  const router = useRouter();
  const L = useBiLabel();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const seq = useRef(0);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose(); else onOpen();
        return;
      }
      if (!open && e.key === "/" && !meta && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpen, onClose]);

  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQ(""); setHits([]); setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => { clearTimeout(t); back.current?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2 || isDayOnlyQuery(term)) { setHits([]); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ hits: Hit[] }>(`/api/dictionary?q=${encodeURIComponent(term)}`);
        if (n === seq.current) setHits(r.hits.slice(0, 6));
      } catch { if (n === seq.current) setHits([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const items = useMemo(() => {
    const out: Item[] = [];
    const day = dayFromQuery(q);
    if (day) out.push({ key: `day-${day}`, href: `/lesson/${day}`, icon: "📅", en: `Open Day ${day}`, hi: `दिन ${day} खोलें`, hint: { en: "Lesson", hi: "पाठ" } });
    for (const p of filterPages(pages, q)) out.push({ key: p.href, href: p.href, icon: p.icon, en: p.en, hi: p.hi, hint: { en: "Page", hi: "पृष्ठ" } });
    for (const h of hits) out.push({
      key: `dict-${h.id}`, href: `/dictionary/${encodeURIComponent(h.id)}`, icon: "📖",
      en: h.lemma, hi: h.hi[0] ?? h.lemma, hint: { en: h.en[0] ?? h.pos, hi: h.hi[0] ?? h.pos },
    });
    return out;
  }, [q, pages, hits]);

  useEffect(() => { setActive(0); }, [q, hits]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId, items.length]);

  if (!open) return null;
  const choose = (it: Item) => { onClose(); router.push(it.href); };
  const index = items.length ? Math.min(Math.max(active, 0), items.length - 1) : 0;
  const current = items[index];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={L({ en: "Close search", hi: "खोज बंद करें" })} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={L({ en: "Search or jump to", hi: "खोजें या जाएँ" })} className="surface relative z-10 flex max-h-[min(32rem,70vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-lg">
        <label htmlFor={`${listId}-q`} className="sr-only">{L({ en: "Search pages, a day number, or a word", hi: "पृष्ठ, दिन की संख्या, या शब्द खोजें" })}</label>
        <input
          id={`${listId}-q`} ref={inputRef} role="combobox" aria-expanded="true" aria-controls={listId}
          aria-activedescendant={current ? `${listId}-opt-${index}` : undefined} aria-autocomplete="list"
          className="border-b border-app bg-transparent px-4 py-3 text-lg outline-none" placeholder={L({ en: "Page, day, or word…", hi: "पृष्ठ, दिन, या शब्द…" })}
          value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (items.length ? Math.min(items.length - 1, i + 1) : 0)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && current) { e.preventDefault(); choose(current); }
          }}
        />
        <ul id={listId} role="listbox" aria-label={L({ en: "Results", hi: "परिणाम" })} className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted"><Bi as="span" t={{ en: "Nothing matches. Try a page name, a day from 1 to 120, or a French, English or Hindi word.", hi: "कुछ नहीं मिला। किसी पृष्ठ का नाम, 1 से 120 तक कोई दिन, या फ़्रेंच, अंग्रेज़ी या हिंदी शब्द लिखें।" }} /></li>}
          {items.map((it, i) => (
            <li key={it.key} id={`${listId}-opt-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${i === index ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-50" : "hover:bg-[var(--surface-2)]"}`} onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-base">{it.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" lang={it.icon === "📖" ? "fr" : "en"}>{it.en}</span>
                  {it.icon !== "📖" && <span lang="hi" className="deva block truncate text-xs text-muted">{it.hi}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted"><Bi as="span" t={it.hint} /></span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-app bg-[var(--surface)] px-4 py-2 text-xs text-muted"><Bi as="span" t={{ en: "↑↓ move · Enter open · Esc close", hi: "↑↓ चलें · Enter खोलें · Esc बंद करें" }} /></p>
      </div>
    </div>
  );
}
