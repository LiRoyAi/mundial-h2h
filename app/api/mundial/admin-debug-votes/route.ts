import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

// TEMPORARY diagnostic endpoint — read-only, admin-key gated.
// Lists vote:{matchId}:{nick} entries for the given matchIds, to audit
// suspicious 0-0 votes before any data cleanup. Remove after the
// gha-pan / ned-swe / ger-civ cleanup is done.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminKey = searchParams.get("adminKey");
  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matchIdsParam = searchParams.get("matchIds");
  if (!matchIdsParam) {
    return Response.json({ error: "Missing matchIds (comma-separated)" }, { status: 400 });
  }
  const matchIds = matchIdsParam.split(",").map((s) => s.trim()).filter(Boolean);

  const out: Record<string, { nick: string; score: string }[]> = {};
  for (const matchId of matchIds) {
    const voteKeys = await redis.keys(`vote:${matchId}:*`);
    const entries: { nick: string; score: string }[] = [];
    if (voteKeys.length > 0) {
      const values = await redis.mget<(string | null)[]>(...voteKeys);
      voteKeys.forEach((k, i) => {
        const nick = k.slice(`vote:${matchId}:`.length);
        if (values[i]) entries.push({ nick, score: values[i]! });
      });
    }
    out[matchId] = entries;
  }

  return Response.json({ votes: out });
}
