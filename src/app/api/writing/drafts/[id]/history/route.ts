import { authed } from "@/server/http";
import { draftHistory } from "@/server/writing";

export const GET = authed<{ id: string }>(async ({ user, params }) => draftHistory(user.id, params.id));
