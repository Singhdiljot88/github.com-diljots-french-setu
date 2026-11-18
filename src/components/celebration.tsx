"use client";
import { useEffect, useState } from "react";
import { Bi } from "./bi";

type Item = { key: string; badge: string; en: string; hi: string; note: { en: string; hi: string } };

export function Celebration({ items }: { items: Item[] }) {
  const [show, setShow] = useState(items.length > 0);
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    setMotion(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  if (!show || !items.length) return null;
  const first = items[0];
  return (
    <div className="card relative overflow-hidden" role="status">
      {motion && <div className="confetti" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 17) % 100}%`, animationDelay: `${(i % 6) * 0.07}s` }} />)}</div>}
      <p className="text-2xl" aria-hidden>{items.map((m) => m.badge).join(" ")}</p>
      <h2 className="font-semibold"><Bi as="span" t={{ en: first.en, hi: first.hi }} /></h2>
      <Bi t={first.note} className="mt-1 text-sm" />
      {items.length > 1 && <p className="mt-1 text-sm text-muted"><Bi as="span" t={{ en: `${items.length} milestones at once.`, hi: `एक साथ ${items.length} उपलब्धियाँ।` }} /></p>}
      <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setShow(false)}><Bi as="span" t={{ en: "Keep going", hi: "आगे बढ़ें" }} /></button>
    </div>
  );
}
