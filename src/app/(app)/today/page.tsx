import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/server/auth";
import { learnerState } from "@/server/learner";
import { getLesson } from "@/server/content";
import { reviewQueue, vocabularyStats } from "@/server/words";
import { skillStats, topMistakes } from "@/server/stats";
import { adaptations } from "@/server/adapt";
import { BLOCK_LABELS, blockMinutes, blocksForPart, partsPerLesson, type DailyMinutes, type Pace } from "@/lib/schedule";
import { PHASES, isCheckpointDay } from "@/content/outline";
import { diffDays, formatLocalDate } from "@/lib/dates";
import { RecoveryCard } from "@/components/recovery";
import { Bi } from "@/components/bi";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

const SKILL_LABEL: Record<string, { en: string; hi: string }> = {
  listening: { en: "Listening", hi: "सुनना" }, reading: { en: "Reading", hi: "पढ़ना" }, speaking: { en: "Speaking", hi: "बोलना" }, writing: { en: "Writing", hi: "लिखना" },
  vocabulary: { en: "Vocabulary", hi: "शब्दावली" }, grammar: { en: "Grammar", hi: "व्याकरण" }, pronunciation: { en: "Pronunciation", hi: "उच्चारण" },
};

export default async function Today() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const profile = (await getProfile(user.id))!;
  const st = await learnerState(user.id, profile);
  const day = st.todayDay;
  const lesson = await getLesson(day);
  const minutes = profile.dailyMinutes as DailyMinutes;
  const pace = profile.pace as Pace;
  const parts = partsPerLesson(minutes, pace);
  const part = st.slot.beforeStart ? 1 : st.slot.part;
  const blocks = blocksForPart(parts, Math.min(part, parts));
  const mins = blockMinutes(day, minutes, pace);
  const progressRow = st.progress.find((p) => p.day === day);
  const done = progressRow?.activities ?? {};
  const planned = blocks.reduce((s, b) => s + mins[b], 0);
  const queue = await reviewQueue(user.id, { timezone: profile.timezone, dailyMinutes: minutes });
  const vocab = await vocabularyStats(user.id);
  const skills = (await skillStats(user.id)).filter((s) => ["listening", "reading", "speaking", "writing"].includes(s.skill));
  const mistakesTop = await topMistakes(user.id, 3);
  const extra = await adaptations(user.id, day);
  const phase = PHASES.find((p) => day >= p.from && day <= p.to)!;
  const completedCount = st.completed.size;
  const nextBlock = blocks.find((b) => !done[b]);
  const lessonDone = progressRow?.status === "completed";
  const label = (t: { en: string; hi: string }) => (profile.explanationLang === "hi" ? t.hi : profile.explanationLang === "both" ? `${t.en} · ${t.hi}` : t.en);

  let next: { href: string; en: string; hi: string };
  if (queue.cards.length > 0 && !done.review) next = { href: "/review", en: `Start with spaced review (${queue.cards.length} cards)`, hi: `दोहराव से शुरू कीजिए (${queue.cards.length} कार्ड)` };
  else if (nextBlock) next = { href: `/lesson/${day}#${nextBlock}`, en: `Continue Day ${day}: ${BLOCK_LABELS[nextBlock].en}`, hi: `दिन ${day} जारी रखिए: ${BLOCK_LABELS[nextBlock].hi}` };
  else if (extra[0]) next = { href: extra[0].href, en: extra[0].en, hi: extra[0].hi };
  else if (lessonDone && day < 120) next = { href: `/lesson/${day + 1}`, en: `Today's plan is done. You can preview Day ${day + 1} or practise freely.`, hi: `आज की योजना पूरी हो गई। आप दिन ${day + 1} देख सकते हैं या खुलकर अभ्यास कर सकते हैं।` };
  else next = { href: "/speaking", en: "Practise speaking with the tutor", hi: "ट्यूटर के साथ बोलने का अभ्यास कीजिए" };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{formatLocalDate(st.today)} · {profile.timezone}</p>
        <h1 className="text-2xl font-bold">{profile.displayName ? `Bonjour, ${profile.displayName} !` : "Bonjour !"}</h1>
        <p className="text-muted"><Bi as="span" t={{ en: `Day ${day} of 120 · Phase ${phase.phase}: ${phase.en}`, hi: `दिन ${day} / 120 · चरण ${phase.phase}: ${phase.hi}` }} />{isCheckpointDay(day) && <Bi as="span" className="chip ml-2 bg-brand-100 text-brand-900" t={{ en: "Checkpoint", hi: "चेकपॉइंट" }} />}</p>
        {st.slot.beforeStart && <Bi className="mt-2 rounded-lg surface-2 p-2 text-sm" t={{ en: `Your plan starts on ${formatLocalDate(profile.startDate)}. You can already look at Day ${day}.`, hi: `आपकी योजना ${formatLocalDate(profile.startDate)} से शुरू होगी। आप अभी से दिन ${day} देख सकते हैं।` }} />}
      </header>

      {st.recovery && <RecoveryCard plan={st.recovery} />}

      <section className="card bg-brand-50 dark:bg-brand-900/30" aria-labelledby="next-h">
        <h2 id="next-h" className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200"><Bi as="span" t={{ en: "Recommended next", hi: "आगे यह करें" }} /></h2>
        <Bi t={next} className="mt-1 text-lg font-medium" />
        <Link href={next.href} className="btn btn-primary mt-3"><Bi as="span" t={{ en: "Go", hi: "चलें" }} /></Link>
      </section>

      <section className="card" aria-labelledby="tasks-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tasks-h" className="text-lg font-semibold"><Bi as="span" t={{ en: "Today's tasks", hi: "आज के काम" }} /> {parts > 1 && <Bi as="span" className="text-sm font-normal text-muted" t={{ en: `(part ${part} of ${parts} of this lesson)`, hi: `(इस पाठ का भाग ${part} / ${parts})` }} />}</h2>
          <Bi className="text-sm text-muted" t={{ en: `Planned ${planned} min · studied ${Math.round(st.minutesToday)} min`, hi: `योजना ${planned} मिनट · पढ़ाई ${Math.round(st.minutesToday)} मिनट` }} />
        </div>
        {lesson ? (
          <>
            <p className="mt-1"><Link className="font-medium underline" href={`/lesson/${day}`}><Bi as="span" t={lesson.day.title} /></Link></p>
            <Bi t={lesson.day.objective} className="mt-1 text-sm text-muted" />
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {blocks.map((b) => (
                <li key={b} className="flex items-center gap-3 py-2">
                  <span aria-hidden className={`grid size-6 place-items-center rounded-full text-xs ${done[b] ? "bg-brand-600 text-white" : "border border-app"}`}>{done[b] ? "✓" : ""}</span>
                  <Link href={b === "review" ? "/review" : `/lesson/${day}#${b}`} className="flex-1 hover:underline">
                    <Bi as="span" t={BLOCK_LABELS[b]} />
                  </Link>
                  <Bi as="span" className="text-sm text-muted" t={mins[b] > 0 ? { en: `${mins[b]} min`, hi: `${mins[b]} मिनट` } : { en: "optional", hi: "वैकल्पिक" }} />
                  <Bi as="span" className="sr-only" t={done[b] ? { en: "completed", hi: "पूरा हुआ" } : { en: "not completed", hi: "पूरा नहीं हुआ" }} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm"><Bi as="span" t={{ en: `The full lesson for Day ${day} is not available in this build yet.`, hi: `दिन ${day} का पूरा पाठ अभी इस संस्करण में उपलब्ध नहीं है।` }} /> <Link className="underline" href="/course"><Bi as="span" t={{ en: "See the course map", hi: "पाठ्यक्रम देखें" }} /></Link></p>
        )}
      </section>

      {extra.length > 0 && (
        <section className="card" aria-labelledby="extra-h">
          <h2 id="extra-h" className="font-semibold"><Bi as="span" t={{ en: "Adjusted for you", hi: "आपके लिए जोड़ा गया" }} /></h2>
          <Bi className="text-sm text-muted" t={{ en: "Extra practice based on your recent answers. Your course plan stays the same.", hi: "आपके हाल के उत्तरों के आधार पर अतिरिक्त अभ्यास। आपकी पाठ्यक्रम योजना वही रहेगी।" }} />
          <ul className="mt-2 space-y-2">{extra.map((x) => <li key={x.key}><Link className="underline" href={x.href}><Bi as="span" t={x} /></Link> <span className="text-xs text-muted">({x.reason})</span></li>)}</ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card" aria-labelledby="review-h">
          <h2 id="review-h" className="font-semibold"><Bi as="span" t={{ en: "Review queue", hi: "दोहराव की सूची" }} /></h2>
          <p className="text-3xl font-bold">{queue.cards.length}</p>
          <Bi className="text-sm text-muted" t={{ en: `${queue.dueTotal} due · ${queue.newLimitRemaining} new allowed today · ${queue.newWaiting} new waiting`, hi: `${queue.dueTotal} दोहराने बाक़ी · आज ${queue.newLimitRemaining} नए कार्ड की अनुमति · ${queue.newWaiting} नए कार्ड इंतज़ार में` }} />
          {queue.overdueCapped && <Bi className="mt-1 text-sm" t={{ en: "You have a backlog, so today's reviews are capped to keep things manageable.", hi: "आपके कई दोहराव बाक़ी हैं, इसलिए आज के दोहराव सीमित रखे गए हैं ताकि काम संभालने लायक रहे।" }} />}
          <Link href="/review" className="btn btn-secondary btn-sm mt-2"><Bi as="span" t={{ en: "Review now", hi: "अभी दोहराएँ" }} /></Link>
        </section>
        <section className="card" aria-labelledby="vocab-h">
          <h2 id="vocab-h" className="font-semibold"><Bi as="span" t={{ en: "Vocabulary", hi: "शब्दावली" }} /></h2>
          <p className="text-3xl font-bold">{vocab.retained} <Bi as="span" className="text-base font-normal text-muted" t={{ en: "retained", hi: "याद रहे" }} /></p>
          <Bi className="text-sm text-muted" t={{ en: `of ${vocab.words} saved words and phrases. “Retained” means recalled with an interval of 7+ days.`, hi: `${vocab.words} सहेजे गए शब्दों और वाक्यांशों में से। “याद रहे” का मतलब है 7 या ज़्यादा दिनों के अंतराल पर भी सही याद आया।` }} />
        </section>
      </div>

      <section className="card" aria-labelledby="skills-h">
        <h2 id="skills-h" className="font-semibold"><Bi as="span" t={{ en: "Skills — demonstrated, not just completed", hi: "कौशल — सिर्फ़ पूरे किए नहीं, सचमुच दिखाए गए" }} /></h2>
        <Bi className="text-sm text-muted" t={{ en: `Lessons completed: ${completedCount} of 120. Below is accuracy on your recent scored answers, which is separate from completion.`, hi: `पूरे किए गए पाठ: 120 में से ${completedCount}। नीचे आपके हाल के जाँचे गए उत्तरों की सटीकता है, जो पाठ पूरे करने से अलग है।` }} />
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {skills.map((s) => (
            <li key={s.skill} className="rounded-xl surface-2 p-3">
              <Bi className="font-medium" t={SKILL_LABEL[s.skill] ?? { en: s.skill }} />
              {s.recentAccuracy === null ? <Bi className="text-sm text-muted" t={{ en: `Not enough evidence yet (${s.attempts} attempts).`, hi: `अभी पर्याप्त प्रमाण नहीं है (${s.attempts} प्रयास)।` }} /> : (
                <>
                  <div className="mt-1 h-2 rounded-full bg-[var(--border)]" role="img" aria-label={label({ en: `${Math.round(s.recentAccuracy * 100)}% recent accuracy`, hi: `हाल की सटीकता ${Math.round(s.recentAccuracy * 100)}%` })}><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.round(s.recentAccuracy * 100)}%` }} /></div>
                  <Bi className="mt-1 text-sm" t={{
                    en: `${Math.round(s.recentAccuracy * 100)}% on recent answers${s.previousAccuracy !== null ? ` · before: ${Math.round(s.previousAccuracy * 100)}%${s.recentAccuracy > s.previousAccuracy + 0.05 ? " — improving" : ""}` : ""}`,
                    hi: `हाल के उत्तरों में ${Math.round(s.recentAccuracy * 100)}%${s.previousAccuracy !== null ? ` · पहले: ${Math.round(s.previousAccuracy * 100)}%${s.recentAccuracy > s.previousAccuracy + 0.05 ? " — सुधार हो रहा है" : ""}` : ""}`,
                  }} />
                </>
              )}
              {(s.skill === "speaking" || s.skill === "writing") && <Bi className="text-xs text-muted" t={{ en: "Speaking and writing are judged from feedback on your texts and conversations, not percentages alone.", hi: "बोलने और लिखने को आपके लेखों और बातचीत पर मिले फ़ीडबैक से परखा जाता है, सिर्फ़ प्रतिशत से नहीं।" }} />}
            </li>
          ))}
        </ul>
        <Link href="/progress" className="mt-3 inline-block text-sm underline"><Bi as="span" t={{ en: "See full progress and checkpoint reports", hi: "पूरी प्रगति और चेकपॉइंट रिपोर्ट देखें" }} /></Link>
      </section>

      {mistakesTop.length > 0 && (
        <section className="card" aria-labelledby="mist-h">
          <h2 id="mist-h" className="font-semibold"><Bi as="span" t={{ en: "Recurring mistakes", hi: "बार-बार होने वाली ग़लतियाँ" }} /></h2>
          <ul className="mt-2 space-y-1 text-sm">{mistakesTop.map((m) => <li key={m.id}><span className="chip surface-2 mr-2">{m.category}</span><span lang="fr" className="line-through decoration-red-500">{m.original.slice(0, 60)}</span> → <span lang="fr" className="font-medium">{m.corrected.slice(0, 60)}</span> {m.occurrences > 1 && <span className="text-muted">×{m.occurrences}</span>}</li>)}</ul>
          <Link href="/mistakes" className="mt-2 inline-block text-sm underline"><Bi as="span" t={{ en: "Open the mistake notebook", hi: "ग़लतियों की कॉपी खोलें" }} /></Link>
        </section>
      )}

      {profile.examDate && (
        <Bi className="text-sm text-muted" t={{
          en: `Exam date: ${formatLocalDate(profile.examDate)} (${diffDays(st.today, profile.examDate)} days away). French Setu does not estimate exam readiness as a percentage; checkpoint reports show evidence instead.`,
          hi: `परीक्षा की तारीख़: ${formatLocalDate(profile.examDate)} (${diffDays(st.today, profile.examDate)} दिन बाक़ी)। French Setu परीक्षा की तैयारी को प्रतिशत में नहीं आँकता; इसके बजाय चेकपॉइंट रिपोर्ट प्रमाण दिखाती हैं।`,
        }} />
      )}
    </div>
  );
}
