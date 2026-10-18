import { NextResponse } from "next/server";
import { authed } from "@/server/http";
import { exportUserData } from "@/server/account";

export const GET = authed(async ({ user }) => {
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="french-setu-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
