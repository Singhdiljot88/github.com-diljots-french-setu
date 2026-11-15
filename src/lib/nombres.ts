/**
 * French numbers for listening drills: prices, times, phone numbers and years are where
 * TEF listening answers often hide. Standard (France) forms: soixante-dix, quatre-vingts.
 */
const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const TENS: Record<number, string> = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

function under100(n: number): string {
  if (n <= 16) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10), u = n % 10;
    if (u === 0) return TENS[t];
    if (u === 1) return `${TENS[t]} et un`;
    return `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) {
    const r = n - 60;
    if (r === 11) return "soixante et onze";
    return `soixante-${under100(r)}`;
  }
  const r = n - 80;
  if (r === 0) return "quatre-vingts";
  return `quatre-vingt-${under100(r)}`;
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100), r = n % 100;
  const head = h === 1 ? "cent" : `${UNITS[h]} cent${r === 0 ? "s" : ""}`;
  return r === 0 ? head : `${head} ${under100(r)}`;
}

/** 0 to 999 999 in words. */
export function frenchNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) throw new RangeError("0..999999 only");
  if (n < 1000) return under1000(n);
  const th = Math.floor(n / 1000), r = n % 1000;
  // "quatre-vingts" and "deux cents" lose their s before mille.
  const head = th === 1 ? "mille" : `${under1000(th).replace(/(vingt|cent)s$/, "$1")} mille`;
  return r === 0 ? head : `${head} ${under1000(r)}`;
}

export type NumberKind = "small" | "seventies" | "big" | "price" | "time" | "phone" | "year";
export type NumberChallenge = { kind: NumberKind; spoken: string; display: string; answer: string; accept: string[]; /** Approximate Devanagari (CONVENTIONS.md §3) */ pron: string };

const rnd = (lo: number, hi: number, r: () => number) => lo + Math.floor(r() * (hi - lo + 1));

export function makeChallenge(kind: NumberKind, r: () => number = Math.random): NumberChallenge {
  const c = rawChallenge(kind, r);
  return { ...c, pron: numberPron(c.spoken) };
}

function rawChallenge(kind: NumberKind, r: () => number): Omit<NumberChallenge, "pron"> {
  switch (kind) {
    case "small": { const n = rnd(0, 69, r); return { kind, spoken: frenchNumber(n), display: String(n), answer: String(n), accept: [] }; }
    case "seventies": { const n = rnd(70, 99, r); return { kind, spoken: frenchNumber(n), display: String(n), answer: String(n), accept: [] }; }
    case "big": { const n = rnd(100, 9999, r); return { kind, spoken: frenchNumber(n), display: String(n), answer: String(n), accept: [] }; }
    case "year": { const n = rnd(1950, 2030, r); return { kind, spoken: frenchNumber(n), display: String(n), answer: String(n), accept: [] }; }
    case "price": {
      const e = rnd(1, 199, r), c = [0, 50, 99, 20, 75, 95, 10][rnd(0, 6, r)];
      const spoken = c === 0 ? `${frenchNumber(e)} euro${e > 1 ? "s" : ""}` : `${frenchNumber(e)} euro${e > 1 ? "s" : ""} ${frenchNumber(c)}`;
      const cc = String(c).padStart(2, "0");
      return { kind, spoken, display: c === 0 ? `${e} €` : `${e},${cc} €`, answer: c === 0 ? String(e) : `${e}.${cc}`, accept: c === 0 ? [`${e}.00`, `${e},00`] : [`${e},${cc}`] };
    }
    case "time": {
      const h = rnd(0, 23, r), m = [0, 5, 10, 15, 20, 30, 40, 45, 50, 55][rnd(0, 9, r)];
      const hs = h === 0 ? "zéro heure" : h === 1 ? "une heure" : h === 21 ? "vingt et une heures" : `${frenchNumber(h)} heures`;
      const spoken = m === 0 ? hs : `${hs} ${frenchNumber(m)}`;
      const mm = String(m).padStart(2, "0");
      return { kind, spoken, display: `${h} h ${mm}`, answer: `${h}:${mm}`, accept: [`${h}h${mm}`, `${String(h).padStart(2, "0")}:${mm}`, `${h}${mm}`, ...(m === 0 ? [`${h}h`, String(h)] : [])] };
    }
    case "phone": {
      const pairs = [["06", "07", "01", "05"][rnd(0, 3, r)], ...Array.from({ length: 4 }, () => String(rnd(0, 99, r)).padStart(2, "0"))];
      const spoken = pairs.map((p) => (p.startsWith("0") && p !== "00" ? `zéro ${frenchNumber(Number(p))}` : p === "00" ? "zéro zéro" : frenchNumber(Number(p)))).join(", ");
      return { kind, spoken, display: pairs.join(" "), answer: pairs.join(""), accept: [] };
    }
  }
}

/** Compares a typed answer: ignores spaces, the euro sign and "h" vs ":" in times. */
export function checkNumber(ch: NumberChallenge, typed: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s€]/g, "").replace(/,/g, ".").replace(/h/g, ":").replace(/:$/, "");
  const t = norm(typed);
  if (!t) return false;
  return [ch.answer, ...ch.accept].some((a) => norm(a) === t);
}

/* ───── Approximate Devanagari for spoken numbers (content/CONVENTIONS.md §3) ───── */

const PRON: Record<string, string> = {
  "zéro": "ज़े-रो", un: "ऐं", une: "यून", deux: "द", trois: "त्रवा", quatre: "कात्र", cinq: "सैंक", six: "सीस", sept: "सेत",
  huit: "यूइत", neuf: "नफ़", dix: "दीस", onze: "ओंज़", douze: "दूज़", treize: "त्रेज़", quatorze: "का-तॉर्ज़", quinze: "कैंज़", seize: "सेज़",
  vingt: "वैं", vingts: "वैं", trente: "त्राँत", quarante: "का-राँत", cinquante: "सैं-काँत", soixante: "स्वा-साँत",
  cent: "साँ", cents: "साँ", mille: "मील", et: "ए", euro: "अ-रो", euros: "अ-रो", heure: "अर", heures: "अर",
};
/** How a number word links into a following vowel (liaison / enchaînement), e.g. deux euros = द ज़-रो. */
const LINK: Record<string, [string, string]> = {
  un: ["ऐं", "न"], une: ["यू", "न"], deux: ["द", "ज़"], trois: ["त्रवा", "ज़"], six: ["सी", "ज़"], dix: ["दी", "ज़"], neuf: ["न", "व"],
  cinq: ["सैं", "क"], sept: ["से", "त"], huit: ["यूइ", "त"], vingt: ["वैं", "त"], cent: ["साँ", "त"], cents: ["साँ", "ज़"], vingts: ["वैं", "ज़"],
  onze: ["ओं", "ज़"], douze: ["दू", "ज़"], treize: ["त्रे", "ज़"], quatorze: ["का-तॉर", "ज़"], quinze: ["कैं", "ज़"], seize: ["से", "ज़"],
  trente: ["त्राँ", "त"], quarante: ["का-राँ", "त"], cinquante: ["सैं-काँ", "त"], soixante: ["स्वा-साँ", "त"], quatre: ["का", "त्र"], mille: ["मी", "ल"],
};
/** Vowel-initial words whose first letter takes the linking consonant: अ-रो → ज़-रो, अर → ज़र, ए → ते. */
const VOWEL_START: Record<string, (c: string) => string> = {
  euro: (c) => `${c}-रो`, euros: (c) => `${c}-रो`, heure: (c) => `${c}र`, heures: (c) => `${c}र`, et: (c) => `${c}े`, onze: (c) => `${c}ओंज़`, huit: (c) => `${c}ूइत`,
};

/** Approximate Devanagari for a spoken French number phrase, with liaison into euros/heures/et. */
export function numberPron(spoken: string): string {
  return spoken.split(/,\s*/).map((group) => {
    const words = group.split(" ").flatMap((w) => w.split("-").map((p, j, parts) => ({ p, joinNext: j < parts.length - 1 })));
    let out = "";
    for (let k = 0; k < words.length; k++) {
      const { p, joinNext } = words[k];
      const next = words[k + 1]?.p;
      const sep = joinNext ? "-" : " ";
      let piece: string;
      if (p === "dix" && joinNext && next === "neuf") piece = "दीज़";
      else if (p === "dix" && joinNext && next === "huit") piece = "दी";
      else if ((p === "dix" || p === "six") && joinNext) piece = p === "dix" ? "दी" : "सी";
      else if (p === "dix" && joinNext === false && next === "huit") piece = "दी";
      else if (next && VOWEL_START[next] && LINK[p] && p !== "une") {
        const [head, c] = LINK[p];
        out += `${head} ${VOWEL_START[next](c)}`;
        k++;
        out += words[k].joinNext ? "-" : " ";
        continue;
      } else piece = PRON[p] ?? p;
      // dix-huit: the x links as z (दी-ज़ूइत).
      if (p === "huit" && words[k - 1]?.p === "dix") piece = "ज़ूइत";
      out += piece + sep;
    }
    return out.replace(/\s+/g, " ").trim();
  }).join(", ");
}
