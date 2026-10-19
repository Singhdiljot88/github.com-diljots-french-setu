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
import { taskTitle } from "./task-title";

export const metadata = { title: "Writing studio" };
export const dynamic = "force-dynamic";

const CAT: Record<string, { en: string; hi: string }> = {
  grammar: { en: "Grammar", hi: "व्याकरण" }, spelling: { en: "Spelling and accents", hi: "वर्तनी और accent चिह्न" }, gender: { en: "Gender", hi: "लिंग" }, agreement: { en: "Agreement", hi: "मेल (agreement)" },
  tense: { en: "Tenses", hi: "काल" }, vocabulary: { en: "Word choice", hi: "शब्द चयन" }, organization: { en: "Organisation", hi: "लेख का ढाँचा" },
};

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
  const lessons = [...(await allLessons()).values()];
  const lessonHi = new Map(lessons.map((l) => [l.day.day, l.day.title.hi]));
  for (const { day } of lessons.filter((l) => l.day.day <= Math.max(st.todayDay, 1))) {
    for (const ex of day.grammar.examples) {
      const n = ex.fr.split(/\s+/).length;
      if (n >= 3 && n <= 10) items.push({ day: day.day, fr: ex.fr, en: ex.en, hi: ex.hi });
    }
  }
  const refFor = (id: string) => (id.startsWith("day-") ? `day:${id.slice(4)}` : `studio:${id}`);
  const groups: { key: string; title: { en: string; hi: string }; note: { en: string; hi: string } }[] = [
    { key: "tef_a", title: { en: "TEF writing task A", hi: "TEF लेखन कार्य A" }, note: { en: "Continue a news story: 80+ words in 25 minutes.", hi: "एक समाचार कहानी आगे बढ़ाइए: 25 मिनट में 80+ शब्द।" } },
    { key: "tef_b", title: { en: "TEF writing task B", hi: "TEF लेखन कार्य B" }, note: { en: "Give and defend your opinion: 200+ words in 35 minutes, three arguments.", hi: "अपनी राय दीजिए और उसका समर्थन कीजिए: 35 मिनट में 200+ शब्द, तीन तर्क।" } },
    { key: "free", title: { en: "Emails and paragraphs", hi: "ईमेल और अनुच्छेद" }, note: { en: "Everyday writing for life in Canada.", hi: "कनाडा की रोज़मर्रा ज़िंदगी के लिए लेखन।" } },
    { key: "lesson", title: { en: "Lesson writing tasks", hi: "पाठों के लेखन कार्य" }, note: { en: "The writing task from each lesson, to redo at any time.", hi: "हर पाठ का लेखन कार्य, जिसे आप कभी भी दोबारा कर सकते हैं।" } },
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Writing studio", hi: "लेखन स्टूडियो" }} /></h1>
        <Bi className="text-muted" t={{ en: "Three modes for every task: Learn (help while you write), Practice (write first, then help), Exam (timed, no help). Drafts save automatically.", hi: "हर कार्य के तीन मोड: सीखें (लिखते समय मदद), अभ्यास (पहले लिखें, फिर मदद), परीक्षा (समय सीमा के साथ, कोई मदद नहीं)। ड्राफ़्ट अपने-आप सहेजे जाते हैं।" }} />
      </header>

      <section className="card space-y-2" aria-labelledby="nb-h">
        <h2 id="nb-h" className="font-semibold"><Bi as="span" t={{ en: "My recurring errors", hi: "मेरी बार-बार होने वाली ग़लतियाँ" }} /></h2>
        {errs.length === 0 ? <Bi className="text-sm text-muted" t={{ en: "Errors from your writing and speaking feedback will collect here, so you can see patterns.", hi: "लिखने और बोलने के फ़ीडबैक की ग़लतियाँ यहाँ जमा होंगी, ताकि आप उनमें पैटर्न देख सकें।" }} /> : (
          <>
            <ul className="flex flex-wrap gap-2 text-sm">{[...byCat].sort((a, b) => b[1] - a[1]).map(([c, n]) => <li key={c} className="chip">{CAT[c] ? <Bi as="span" t={CAT[c]} /> : c}: {n}</li>)}</ul>
            <ul className="space-y-1 text-sm">
              {errs.slice(0, 5).map((m) => <li key={m.id}><mark className="del" lang="fr">{m.original}</mark> → <mark className="add" lang="fr">{m.corrected}</mark>{m.occurrences > 1 && <span className="text-muted"> ×{m.occurrences}</span>} <Bi as="span" t={{ en: m.explanation.en, hi: m.explanation.hi ?? "" }} className="text-muted" /></li>)}
            </ul>
            <Link className="text-sm underline" href="/mistakes"><Bi as="span" t={{ en: "Practise them in the mistake notebook", hi: "ग़लतियों की कॉपी में इनका अभ्यास करें" }} /> →</Link>
          </>
        )}
      </section>

      <section className="card space-y-2" aria-labelledby="sb-h">
        <h2 id="sb-h" className="font-semibold"><Bi as="span" t={{ en: "Sentence builder", hi: "वाक्य बनाइए" }} /></h2>
        <Bi className="text-sm text-muted" t={{ en: "Put the words in order to make the French sentence. Sentences come from the grammar of the lessons you have reached.", hi: "शब्दों को सही क्रम में रखकर फ़्रेंच वाक्य बनाइए। वाक्य उन पाठों के व्याकरण से लिए गए हैं जहाँ तक आप पहुँच चुके हैं।" }} />
        <SentenceBuilder items={items} />
      </section>

      {groups.map((g) => {
        const list = tasks.filter((t) => t.group === g.key);
        return (
          <section key={g.key} aria-labelledby={`g-${g.key}`}>
            <h2 id={`g-${g.key}`} className="text-lg font-semibold"><Bi as="span" t={g.title} /></h2>
            <Bi className="mb-2 text-sm text-muted" t={g.note} />
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((t) => {
                const s = status.get(refFor(t.id));
                return (
                  <li key={t.id}>
                    <Link href={`/writing/${t.id}`} className="card block h-full hover:border-brand-500">
                      <span className="flex justify-between text-xs text-muted"><Bi as="span" t={{ en: `${t.minWords}+ words${t.timeLimitSec ? ` · ${t.timeLimitSec / 60} min` : ""}`, hi: `${t.minWords}+ शब्द${t.timeLimitSec ? ` · ${t.timeLimitSec / 60} मिनट` : ""}` }} />{s && <Bi as="span" className="chip" t={s === "submitted" ? { en: "Submitted", hi: "जमा किया गया" } : { en: "Draft saved", hi: "ड्राफ़्ट सहेजा गया" }} />}</span>
                      <Bi as="span" className="mt-1 block font-medium" t={taskTitle(t, t.day ? lessonHi.get(t.day) : undefined)} />
                      <Bi as="span" className="line-clamp-2 block text-sm text-muted" t={t.prompt} />
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
