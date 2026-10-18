import { z } from "zod";
import { authed, body, HttpError } from "@/server/http";
import { FetchBlocked, safeFetch } from "@/server/web/safe-fetch";
import { extractReadable, frenchScore } from "@/server/web/extract";

/** Loads a public page and returns its readable text for this session only. Nothing from the page is followed as an instruction. */
export const POST = authed(async ({ req }) => {
  const { url } = await body(req, z.object({ url: z.string().url().max(2000) }));
  try {
    const page = await safeFetch(url);
    const ex = page.contentType.includes("html") ? extractReadable(page.body, page.url) : { title: new URL(page.url).hostname, publisher: new URL(page.url).hostname, publishedAt: null, lang: null, license: null, text: page.body.slice(0, 8000) };
    if (ex.text.length < 200) throw new HttpError(422, "Could not find enough article text on that page. Try another link, or copy the text and paste it.");
    return { ...ex, url: page.url, retrievedAt: new Date().toISOString(), frenchScore: frenchScore(ex.text) };
  } catch (e) {
    if (e instanceof FetchBlocked) throw new HttpError(400, e.message);
    throw e;
  }
});
