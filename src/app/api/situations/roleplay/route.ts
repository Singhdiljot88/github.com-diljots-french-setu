import { z } from "zod";
import { authed, body } from "@/server/http";
import { situationScene } from "@/server/coach";

export const POST = authed(async ({ req, user }) => {
  const { id } = await body(req, z.object({ id: z.string().min(1).max(40) }));
  return situationScene(user.id, id);
});
