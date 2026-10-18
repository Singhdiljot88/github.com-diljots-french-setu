import { authed, HttpError } from "@/server/http";
import { SearchUnavailable, webSearch } from "@/server/web/search";

export const GET = authed(async ({ req }) => {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 150);
  if (q.length < 2) throw new HttpError(400, "Type at least two characters.");
  try { return { results: await webSearch(q, u.searchParams.get("kind") === "news" ? "news" : "web") }; }
  catch (e) { if (e instanceof SearchUnavailable) throw new HttpError(503, e.message); throw e; }
});
