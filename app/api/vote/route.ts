import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { tournamentClosed } from "@/lib/tournament";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export function POST() {
  return tournamentClosed();
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

  // Compute accuracy for top-50 players
  const top50 = ranking.slice(0, 50);
  const accuracyMap: Record<string, number | null> = {};

  const resultKeys = await redis.keys("result:*");
  if (resultKeys.length > 0 && top50.length > 0) {
    const resultValues = await redis.mget<(string | null)[]>(...resultKeys);
    const resolved: { matchId: string; result: string }[] = [];
    resultKeys.forEach((k, i) => {
      if (resultValues[i]) resolved.push({ matchId: k.replace("result:", ""), result: resultValues[i]! });
    });

    if (resolved.length > 0) {
      const voteKeys: string[] = [];
      for (const entry of top50) {
        for (const { matchId: mid } of resolved) {
          voteKeys.push(`vote:${mid}:${entry.nick}`);
        }
      }
      const voteValues = await redis.mget<(string | null)[]>(...voteKeys);

      const sign = (a: number, b: number) => (a > b ? 1 : a < b ? -1 : 0);
      let ki = 0;
      for (const entry of top50) {
        let resolvedCount = 0;
        let correctCount = 0;
        for (const { result: res } of resolved) {
          const voted = voteValues[ki++];
          if (!voted) continue;
          const [v1, v2] = voted.replace("-", ":").split(":").map(Number);
          const [r1, r2] = res.split(":").map(Number);
          if ([v1, v2, r1, r2].some(isNaN)) continue;
          resolvedCount++;
          if (v1 === r1 && v2 === r2) correctCount++;
          else if (sign(v1, v2) === sign(r1, r2)) correctCount++;
        }
        accuracyMap[entry.nick] = resolvedCount > 0
          ? Math.round((correctCount / resolvedCount) * 100)
          : null;
      }
    }
  }

  // Fetch badges for top-50 in one batch
  const badgeRaws = top50.length > 0
    ? await redis.mget<(string | null)[]>(...top50.map((e) => `badge:${e.nick}`))
    : [];

  return Response.json({
    matchId,
    results,
    result: result ?? null,
    ranking: top50.map((e, i) => {
      let badges: string[] = [];
      try { if (badgeRaws[i]) badges = JSON.parse(badgeRaws[i]!); } catch { /* */ }
      return { ...e, accuracy: accuracyMap[e.nick] ?? null, badges };
    }),
    total,
    userRank,
  });
}
