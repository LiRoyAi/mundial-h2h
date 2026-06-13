import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params;

  const raw = await redis.lrange(`league_reactions:${leagueId}`, 0, 9);
  const reactions = raw
    .map((item) => {
      if (typeof item === "string") {
        try { return JSON.parse(item); } catch { return null; }
      }
      return item ?? null;
    })
    .filter(Boolean);

  return Response.json({ reactions });
}
