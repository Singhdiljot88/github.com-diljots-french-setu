"use client";
import { useEffect, useState } from "react";
import { Bi, useBiLabel } from "./bi";

type Theme = "system" | "light" | "dark";
const KEY = "fs-theme";

function apply(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const L = useBiLabel();
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const next: Theme = saved === "light" || saved === "dark" ? saved : "system";
    setTheme(next);
    apply(next);
  }, []);
  const choose = (next: Theme) => {
    setTheme(next);
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
    apply(next);
  };
  const opts: { id: Theme; en: string; hi: string }[] = [
    { id: "system", en: "Auto", hi: "ऑटो" },
    { id: "light", en: "Light", hi: "हल्का" },
    { id: "dark", en: "Dark", hi: "गहरा" },
  ];
  return (
    <div className="segmented" role="group" aria-label={L({ en: "Colour theme", hi: "रंग थीम" })}>
      {opts.map((o) => (
        <button key={o.id} type="button" aria-pressed={theme === o.id} onClick={() => choose(o.id)}>
          <Bi as="span" t={o} />
        </button>
      ))}
    </div>
  );
}
