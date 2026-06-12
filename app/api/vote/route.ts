import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { matchId?: string; score?: string; nick?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, score, nick } = body;
  if (!matchId || !score || !nick) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const scoreKey = `votes:${matchId}:${score}`;
  const nickKey  = `ranking:${nick}`;
  const voteKey  = `vote:${matchId}:${nick}`;

  await Promise.all([
    redis.incr(scoreKey),
    redis.incr(nickKey),
    redis.set(voteKey, score),
  ]);

  const keys = await redis.keys(`votes:${matchId}:*`);
  const counts: Record<string, number> = {};
  if (keys.length > 0) {
    const values = await redis.mget<number[]>(...keys);
    keys.forEach((k, i) => {
      counts[k.replace(`votes:${matchId}:`, "")] = values[i] ?? 0;
    });
  }

  return Response.json({ matchId, results: counts });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");
  const nickParam = searchParams.get("nick");

  const results: Record<string, number> = {};
  if (matchId) {
    const voteKeys = await redis.keys(`votes:${matchId}:*`);
    if (voteKeys.length > 0) {
      const values = await redis.mget<number[]>(...voteKeys);
      voteKeys.forEach((k, i) => {
        results[k.replace(`votes:${matchId}:`, "")] = values[i] ?? 0;
      });
    }
  }

  const rankingKeys = await redis.keys("ranking:*");
  const ranking: { nick: string; points: number }[] = [];
  if (rankingKeys.length > 0) {
    const values = await redis.mget<number[]>(...rankingKeys);
    rankingKeys.forEach((k, i) => {
      ranking.push({ nick: k.replace("ranking:", ""), points: values[i] ?? 0 });
    });
  }
  ranking.sort((a, b) => b.points - a.points);

  const total = ranking.length;
  let userRank: { position: number; points: number } | null = null;
  if (nickParam) {
    const idx = ranking.findIndex((e) => e.nick === nickParam);
    if (idx !== -1) {
      userRank = { position: idx + 1, points: ranking[idx].points };
    }
  }

  const result = matchId ? await redis.get<string>(`result:${matchId}`) : null;

  return Response.json({
    matchId,
    results,
    result: result ?? null,
    ranking: ranking.slice(0, 50),
    total,
    userRank,
  });
}
