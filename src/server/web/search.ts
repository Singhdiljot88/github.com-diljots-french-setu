import "server-only";
import { searchProvider } from "../providers/config";

export type SearchResult = { title: string; url: string; snippet: string; domain: string; publishedAt?: string | null; provider: string };
export class SearchUnavailable extends Error {}

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();

/** Web search through the configured provider. Results are untrusted data; the learner chooses what to open. */
export async function webSearch(query: string, kind: "news" | "web"): Promise<SearchResult[]> {
  const provider = searchProvider();
  if (provider === "none") throw new SearchUnavailable("Web search is not configured on the server.");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    if (provider === "brave") {
      const endpoint = kind === "news" ? "news/search" : "web/search";
      const u = new URL(`https://api.search.brave.com/res/v1/${endpoint}`);
      u.searchParams.set("q", query); u.searchParams.set("search_lang", "fr"); u.searchParams.set("country", "CA"); u.searchParams.set("count", "12"); u.searchParams.set("safesearch", "strict");
      const r = await fetch(u, { signal: ctrl.signal, headers: { accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY! } });
      if (!r.ok) throw new SearchUnavailable(`Search failed (${r.status}).`);
      const j = await r.json() as { web?: { results?: Item[] }; results?: Item[] };
      type Item = { title: string; url: string; description?: string; age?: string; page_age?: string };
      return (j.web?.results ?? j.results ?? []).map((x) => ({ title: strip(x.title), url: x.url, snippet: strip(x.description ?? ""), domain: new URL(x.url).hostname.replace(/^www\./, ""), publishedAt: x.page_age ?? x.age ?? null, provider: "Brave Search" }));
    }
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query: `${query} (en français)`, topic: kind === "news" ? "news" : "general", max_results: 10, include_answer: false }),
    });
    if (!r.ok) throw new SearchUnavailable(`Search failed (${r.status}).`);
    const j = await r.json() as { results?: { title: string; url: string; content?: string; published_date?: string }[] };
    return (j.results ?? []).map((x) => ({ title: strip(x.title), url: x.url, snippet: strip(x.content ?? "").slice(0, 300), domain: new URL(x.url).hostname.replace(/^www\./, ""), publishedAt: x.published_date ?? null, provider: "Tavily" }));
  } catch (e) {
    if (e instanceof SearchUnavailable) throw e;
    throw new SearchUnavailable((e as Error).name === "AbortError" ? "Search timed out." : "Could not reach the search service.");
  } finally { clearTimeout(t); }
}

/** Hand-picked starting points, shown with or without a search key. Labelled as curated in the UI. */
export const CURATED_LINKS = [
  { title: "TEF Canada: official test information", url: "https://www.lefrancaisdesaffaires.fr/tests-diplomes/test-evaluation-francais-tef/tef-canada/", publisher: "Le français des affaires (CCI Paris Île-de-France), the exam's publisher", level: "Exam info", kind: "official" },
  { title: "TV5MONDE Apprendre le français", url: "https://apprendre.tv5monde.com/fr", publisher: "TV5MONDE", level: "A1–C1", kind: "learning" },
  { title: "RFI Savoirs: Journal en français facile", url: "https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/", publisher: "RFI", level: "A2–B1", kind: "learning" },
  { title: "Radio-Canada Info", url: "https://ici.radio-canada.ca/info", publisher: "Radio-Canada", level: "B1+", kind: "news" },
  { title: "Gouvernement du Canada: Immigration et citoyenneté", url: "https://www.canada.ca/fr/services/immigration-citoyennete.html", publisher: "Government of Canada", level: "B1+", kind: "official" },
  { title: "Québec.ca: Immigrer et s'installer", url: "https://www.quebec.ca/immigration", publisher: "Gouvernement du Québec", level: "B1+", kind: "official" },
] as const;
