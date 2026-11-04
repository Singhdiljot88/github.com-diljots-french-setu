import { z } from "zod";
import { AiUnavailable } from "@/server/ai";
import { hindiToFrench } from "@/server/hindi-bridge";
import { authed, HttpError } from "@/server/http";

const Body = z.object({ text: z.string().trim().min(1).max(600) });

/** Hindi / Hinglish / English → natural French with Devanagari pronunciation and a Hindi explanation. */
export const POST = authed(async ({ req, user }) => {
  const { text } = Body.parse(await req.json());
  try {
    return await hindiToFrench(user.id, text);
  } catch (e) {
    if (e instanceof AiUnavailable) throw new HttpError(503, e.message);
    throw e;
  }
});
