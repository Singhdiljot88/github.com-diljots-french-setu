import { authed } from "@/server/http";
import { savedResources } from "@/server/web/service";

export const GET = authed(async ({ user }) => ({ items: await savedResources(user.id) }));
