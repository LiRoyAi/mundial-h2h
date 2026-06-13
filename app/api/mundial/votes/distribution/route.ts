import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "Missing matchId" }, { status: 400 });

  const keys = await redis.keys(`votes:${matchId}:*`);
  if (!keys.length) return Response.json({ top3: [], total: 0 });

  const values = await redis.mget<number[]>(...keys);
  const counts: { score: string; count: number }[] = [];
  let total = 0;
  keys.forEach((k, i) => {
    const count = values[i] ?? 0;
    total += count;
    counts.push({ score: k.replace(`votes:${matchId}:`, ""), count });
  });

  if (total < 3) return Response.json({ top3: [], total });

  const top3 = counts
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ score, count }) => ({
      score,
      pct: Math.round((count / total) * 100),
    }));

  return Response.json({ top3, total });
}
