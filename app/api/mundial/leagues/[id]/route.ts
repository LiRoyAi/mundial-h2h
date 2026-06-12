import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params;

  const [league, members] = await Promise.all([
    redis.hgetall(`league:${leagueId}`),
    redis.smembers(`league:${leagueId}:members`),
  ]);

  if (!league || Object.keys(league).length === 0) {
    return Response.json({ error: "League not found" }, { status: 404 });
  }

  const ranking: { nick: string; points: number }[] = [];
  if (members.length > 0) {
    const values = await redis.mget<number[]>(...members.map((m) => `ranking:${m}`));
    members.forEach((nick, i) => {
      ranking.push({ nick, points: values[i] ?? 0 });
    });
    ranking.sort((a, b) => b.points - a.points);
  }

  return Response.json({
    id: leagueId,
    name: league.name,
    owner: league.owner,
    members: members.length,
    ranking,
  });
}
