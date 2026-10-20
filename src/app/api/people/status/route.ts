import { connection } from "next/server";
import { status } from "@/lib/network/server/service";
import { readSession } from "@/lib/network/server/session";

/** Depends on server configuration and live state, so never prerender it. */
export async function GET(request: Request) {
  await connection();
  return Response.json(await status(readSession(request)), { headers: { "cache-control": "no-store" } });
}
