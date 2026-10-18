import { authed } from "@/server/http";
import { endSession } from "@/server/speaking";

export const POST = authed<{ id: string }>(async ({ user, params }) => endSession(user.id, params.id));
