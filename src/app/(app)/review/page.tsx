import { ReviewSession } from "@/components/review-session";

export const metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Review <span lang="hi" className="deva text-lg font-normal text-muted">· दोहराई</span></h1>
        <p className="text-muted">Spaced repetition: words come back just before you would forget them. Answer, then rate how well you knew it.</p>
      </header>
      <ReviewSession />
    </div>
  );
}
