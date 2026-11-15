import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { dictIndex } from "@/server/content";
import { PracticeArcade, type ArcadeNoun } from "@/components/practice-arcade";
import { CONFUSABLES } from "@/lib/confusables";
import { Bi } from "@/components/bi";

export const metadata = { title: "Practice games" };
export const dynamic = "force-dynamic";

const ARTICLE_PRON: Record<string, string> = { le: "ल", la: "ला", un: "ऐं", une: "यून" };

export default async function PlayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const idx = await dictIndex();
  const byLemma = new Map(idx.entries.map((e) => [e.entry.lemma.toLowerCase(), e.entry]));

  // Everyday nouns with a clear gender and a Devanagari guide (A1/A2 first, so beginners know most of them).
  const nouns: ArcadeNoun[] = idx.entries
    .map((e) => e.entry)
    .filter((e) => e.pos === "noun" && (e.gender === "m" || e.gender === "f") && e.pron && (e.level === "A1" || e.level === "A2") && !e.lemma.includes(" ") && e.en.length > 0 && e.hi.length > 0)
    .map((e) => ({ lemma: e.lemma, gender: e.gender as "m" | "f", en: e.en[0], hi: e.hi[0], pron: e.pron }));

  // Devanagari for the false-friend headwords, built from dictionary entries (article + word).
  const prons: Record<string, string> = {};
  for (const c of CONFUSABLES) {
    if (c.kind === "sound_alike") continue;
    const m = c.fr.match(/^(le|la|l'|un|une)\s*(.+)$/i);
    const word = (m ? m[2] : c.fr).replace(/\s+à$/, "").toLowerCase();
    const entry = byLemma.get(word) ?? byLemma.get(c.fr.toLowerCase());
    if (!entry?.pron) continue;
    const art = m?.[1].toLowerCase();
    prons[c.fr] = art && ARTICLE_PRON[art] ? `${ARTICLE_PRON[art]} ${entry.pron}` : entry.pron + (c.fr.endsWith(" à") ? " आ" : "");
  }

  return (
    <div>
      <PracticeArcade nouns={nouns} prons={prons} />
    </div>
  );
}
