import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nick = searchParams.get("nick")?.trim().slice(0, 24);
  if (!nick) return Response.json({ error: "Missing nick" }, { status: 400 });

  const leagueIds = await redis.smembers(`leagues:${nick}`);
  if (!leagueIds.length) return Response.json(null);

  const leagueId = leagueIds[0];

  const [league, members] = await Promise.all([
    redis.hgetall(`league:${leagueId}`),
    redis.smembers(`league:${leagueId}:members`),
  ]);

  if (!league || Object.keys(league).length === 0) return Response.json(null);

  let rank = members.length;
  if (members.length > 0) {
    const values = await redis.mget<number[]>(...members.map((m) => `ranking:${m}`));
    const sorted = members
      .map((m, i) => ({ nick: m, points: values[i] ?? 0 }))
      .sort((a, b) => b.points - a.points);
    const idx = sorted.findIndex((e) => e.nick === nick);
    if (idx !== -1) rank = idx + 1;
  }

  return Response.json({ id: leagueId, name: league.name, rank, total: members.length });
}
