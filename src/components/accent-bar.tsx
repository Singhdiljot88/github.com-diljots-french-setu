"use client";

const CHARS = ["é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "ù", "û", "ü", "œ", "«", "»"];

/** French accent keyboard: inserts into the most recently focused text field. */
export function AccentBar({ targetId }: { targetId?: string }) {
  const insert = (ch: string) => {
    const el = (targetId ? document.getElementById(targetId) : (document.activeElement as HTMLElement | null) ?? (window as unknown as { __fsLastInput?: HTMLElement }).__fsLastInput) as HTMLInputElement | HTMLTextAreaElement | null;
    const target = el && ("value" in el) ? el : (window as unknown as { __fsLastInput?: HTMLInputElement }).__fsLastInput;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
    setter.call(target, target.value.slice(0, start) + ch + target.value.slice(end));
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
    target.setSelectionRange(start + ch.length, start + ch.length);
  };
  return (
    <div className="flex flex-wrap gap-1" role="toolbar" aria-label="French accents"
      onMouseDown={(e) => e.preventDefault() /* keep focus in the text field */}>
      {CHARS.map((c) => (
        <button key={c} type="button" className="btn btn-secondary btn-sm min-w-9 px-2" onClick={() => insert(c)} aria-label={`Insert ${c}`}>{c}</button>
      ))}
    </div>
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("focusin", (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) (window as unknown as { __fsLastInput?: HTMLElement }).__fsLastInput = t;
  });
}
