import Link from "next/link";
import { notFound } from "next/navigation";
import { studioTasks } from "@/server/writing-tasks";
import { getLesson } from "@/server/content";
import { WritingEditor } from "@/components/writing-editor";
import { Bi } from "@/components/bi";
import { taskTitle } from "../task-title";

export const dynamic = "force-dynamic";

export default async function WritingTask({ params }: { params: Promise<{ task: string }> }) {
  const id = (await params).task;
  const t = (await studioTasks()).find((x) => x.id === id);
  if (!t) notFound();
  const tef = t.group === "tef_a" || t.group === "tef_b";
  const lessonHi = t.day ? (await getLesson(t.day))?.day.title.hi : undefined;
  const limits = {
    en: `At least ${t.minWords} words${t.maxWords ? `, at most ${t.maxWords}` : ""}${t.timeLimitSec ? ` · ${t.timeLimitSec / 60} minutes in exam mode` : ""}`,
    hi: `कम से कम ${t.minWords} शब्द${t.maxWords ? `, ज़्यादा से ज़्यादा ${t.maxWords}` : ""}${t.timeLimitSec ? ` · परीक्षा मोड में ${t.timeLimitSec / 60} मिनट` : ""}`,
  };
  return (
    <div className="space-y-4">
      <Link href="/writing" className="text-sm underline">← <Bi as="span" t={{ en: "Writing studio", hi: "लेखन स्टूडियो" }} /></Link>
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={taskTitle(t, lessonHi)} /></h1>
        <Bi className="text-sm text-muted" t={limits} />
      </header>
      <div className="card space-y-3">
        <Bi t={t.prompt} className="font-medium" />
        {t.prompt.fr && <p lang="fr">{t.prompt.fr}</p>}
        {t.stimulus && <blockquote lang="fr" className="whitespace-pre-wrap rounded-lg border-l-4 border-brand-500 surface-2 p-3">{t.stimulus}</blockquote>}
        <WritingEditor taskType={t.taskType} taskRef={t.day ? `day:${t.day}` : `studio:${t.id}`} minWords={t.minWords} maxWords={t.maxWords}
          prompt={[t.prompt.fr ?? t.prompt.en, t.stimulus].filter(Boolean).join("\n\n")} learn={t.learn} timeLimitSec={t.timeLimitSec ?? Math.max(10, Math.ceil(t.minWords / 6)) * 60} defaultMode={tef ? "exam" : "practice"} />
      </div>
    </div>
  );
}
