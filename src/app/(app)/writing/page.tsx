import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mistakes, writingDrafts } from "@/db/schema";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { allLessons } from "@/server/content";
import { studioTasks } from "@/server/writing-tasks";
import { SentenceBuilder, type BuilderItem } from "@/components/sentence-builder";
import { Bi } from "@/components/bi";

export const metadata = { title: "Writing studio" };
export const dynamic = "force-dynamic";

const CAT: Record<string, string> = { grammar: "Grammar", spelling: "Spelling and accents", gender: "Gender", agreement: "Agreement", tense: "Tenses", vocabulary: "Word choice", organization: "Organisation" };

export default async function WritingStudio() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const st = await learnerState(user.id, profile);
  const tasks = await studioTasks();
  const db = await getDb();
  const drafts = await db.select({ taskRef: writingDrafts.taskRef, status: writingDrafts.status, updatedAt: writingDrafts.updatedAt }).from(writingDrafts).where(eq(writingDrafts.userId, user.id)).orderBy(desc(writingDrafts.updatedAt));
  const status = new Map<string, string>();
  for (const d of drafts) if (!status.has(d.taskRef)) status.set(d.taskRef, d.status);
  const errs = await db.select().from(mistakes).where(and(eq(mistakes.userId, user.id), inArray(mistakes.source, ["writing", "speaking"]), eq(mistakes.resolved, false))).orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt)).limit(40);
  const byCat = new Map<string, number>();
  for (const m of errs) byCat.set(m.category, (byCat.get(m.category) ?? 0) + m.occurrences);

  // Sentence builder: grammar example sentences from lessons the learner has reached
  const items: BuilderItem[] = [];
  for (const { day } of [...(await allLessons()).values()].filter((l) => l.day.day <= Math.max(st.todayDay, 5))) {
    for (const ex of day.grammar.examples) {
      const n = ex.fr.split(/\s+/).length;
      if (n >= 3 && n <= 10) items.push({ day: day.day, fr: ex.fr, en: ex.en, hi: ex.hi });
    }
  }
  const refFor = (id: string) => (id.startsWith("day-") ? `day:${id.slice(4)}` : `studio:${id}`);
  const groups: { key: string; title: string; note: string }[] = [
    { key: "tef_a", title: "TEF writing task A", note: "Continue a news story: 80+ words in 25 minutes." },
    { key: "tef_b", title: "TEF writing task B", note: "Give and defend your opinion: 200+ words in 35 minutes, three arguments." },
    { key: "free", title: "Emails and paragraphs", note: "Everyday writing for life in Canada." },
    { key: "lesson", title: "Lesson writing tasks", note: "The writing task from each lesson, to redo at any time." },
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Writing studio <span lang="hi" className="deva text-lg font-normal text-muted">· लेखन स्टूडियो</span></h1>
        <p className="text-muted">Three modes for every task: Learn (help while you write), Practice (write first, then help), Exam (timed, no help). Drafts save automatically.</p>
      </header>

      <section className="card space-y-2" aria-labelledby="nb-h">
        <h2 id="nb-h" className="font-semibold">My recurring errors</h2>
        {errs.length === 0 ? <p className="text-sm text-muted">Errors from your writing and speaking feedback will collect here, so you can see patterns.</p> : (
          <>
            <ul className="flex flex-wrap gap-2 text-sm">{[...byCat].sort((a, b) => b[1] - a[1]).map(([c, n]) => <li key={c} className="chip">{CAT[c] ?? c}: {n}</li>)}</ul>
            <ul className="space-y-1 text-sm">
              {errs.slice(0, 5).map((m) => <li key={m.id}><mark className="del" lang="fr">{m.original}</mark> → <mark className="add" lang="fr">{m.corrected}</mark>{m.occurrences > 1 && <span className="text-muted"> ×{m.occurrences}</span>} <Bi as="span" t={{ en: m.explanation.en, hi: m.explanation.hi ?? "" }} className="text-muted" /></li>)}
            </ul>
            <Link className="text-sm underline" href="/mistakes">Practise them in the mistake notebook →</Link>
          </>
        )}
      </section>

      <section className="card space-y-2" aria-labelledby="sb-h">
        <h2 id="sb-h" className="font-semibold">Sentence builder</h2>
        <p className="text-sm text-muted">Put the words in order to make the French sentence. Sentences come from the grammar of the lessons you have reached.</p>
        <SentenceBuilder items={items} />
      </section>

      {groups.map((g) => {
        const list = tasks.filter((t) => t.group === g.key);
        return (
          <section key={g.key} aria-labelledby={`g-${g.key}`}>
            <h2 id={`g-${g.key}`} className="text-lg font-semibold">{g.title}</h2>
            <p className="mb-2 text-sm text-muted">{g.note}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((t) => {
                const s = status.get(refFor(t.id));
                return (
                  <li key={t.id}>
                    <Link href={`/writing/${t.id}`} className="card block h-full hover:border-brand-500">
                      <span className="flex justify-between text-xs text-muted"><span>{t.minWords}+ words{t.timeLimitSec ? ` · ${t.timeLimitSec / 60} min` : ""}</span>{s && <span className="chip">{s === "submitted" ? "Submitted" : "Draft saved"}</span>}</span>
                      <span className="mt-1 block font-medium">{t.title}</span>
                      <span className="line-clamp-2 block text-sm text-muted">{t.prompt.en}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
