import { authed } from "@/server/http";
import { personalDrills } from "@/server/coach";

export const POST = authed(async ({ user }) => personalDrills(user.id));
