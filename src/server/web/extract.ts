import "server-only";

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", icirc: "î", iuml: "ï", ugrave: "ù", ucirc: "û", oelig: "œ", Eacute: "É" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);
const meta = (html: string, name: string) => new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i").exec(html)?.[1] ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i").exec(html)?.[1];

/** Pulls the readable text out of a page. The result is treated as untrusted data everywhere it goes. */
export function extractReadable(html: string, url: string) {
  const title = decode((meta(html, "og:title") ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? new URL(url).hostname).trim()).slice(0, 200);
  const publisher = decode(meta(html, "og:site_name") ?? new URL(url).hostname.replace(/^www\./, "")).slice(0, 100);
  const publishedAt = meta(html, "article:published_time") ?? meta(html, "date") ?? /<time[^>]+datetime=["']([^"']+)/i.exec(html)?.[1] ?? null;
  const lang = /<html[^>]+lang=["']([\w-]+)/i.exec(html)?.[1]?.toLowerCase() ?? null;
  const license = meta(html, "dc.rights") ?? /<link[^>]+rel=["']license["'][^>]+href=["']([^"']+)/i.exec(html)?.[1] ?? null;
  let body = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|button|select)[\s\S]*?<\/\1>/gi, " ");
  const main = /<(article|main)[\s\S]*?<\/\1>/i.exec(body)?.[0];
  if (main && main.length > 500) body = main;
  const blocks = [...body.matchAll(/<(p|h[1-3]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => decode(m[2].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 25 && !/cookie|abonnez|newsletter|javascript|©/i.test(t));
  const text = [...new Set(blocks)].join("\n\n").slice(0, 8000);
  return { title, publisher, publishedAt: publishedAt?.slice(0, 40) ?? null, lang, license, text };
}

/** Rough share of French function words: tells French pages from others without a language model. */
export function frenchScore(text: string) {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (words.length < 20) return 0;
  const fr = new Set(["le", "la", "les", "de", "des", "du", "et", "est", "un", "une", "en", "que", "qui", "pour", "dans", "sur", "pas", "au", "aux", "avec", "il", "elle", "nous", "vous", "ce", "cette", "sont", "plus", "par"]);
  return words.filter((w) => fr.has(w)).length / words.length;
}
