import { authed, HttpError } from "@/server/http";
import { getEntry } from "@/server/content";
import { conjugate } from "@/lib/conjugate";

export const GET = authed<{ id: string }>(async ({ params }) => {
  const e = await getEntry(decodeURIComponent(params.id));
  if (!e) throw new HttpError(404, "Entry not found");
  return { ...e, conjugation: e.entry.verb ? conjugate(e.entry.lemma, e.entry.verb) : null };
});
