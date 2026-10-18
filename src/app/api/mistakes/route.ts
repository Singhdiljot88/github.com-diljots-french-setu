import { authed } from "@/server/http";
import { listMistakes } from "@/server/mistakes";

export const GET = authed(async ({ user }) => ({ mistakes: await listMistakes(user.id) }));
