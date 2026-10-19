import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { examView, loadAttempt } from "@/server/exam";
import { HttpError } from "@/server/http";
import { ExamRunner } from "@/components/exam-runner";

export const metadata = { title: "Practice exam · अभ्यास परीक्षा" };
export const dynamic = "force-dynamic";

export default async function ExamAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    const { attempt, mock } = await loadAttempt(user.id, id);
    return <ExamRunner initial={await examView(user.id, attempt, mock)} />;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
