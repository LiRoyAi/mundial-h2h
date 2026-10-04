import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { tournamentClosed } from "@/lib/tournament";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");
  const nick = searchParams.get("nick");

  // No matchId/nick → return ranking
  if (!matchId || !nick) {
    const raw = await redis.zrange<(string | number)[]>("challenge_ranking", 0, 9, {
      rev: true,
      withScores: true,
    });
    const ranking: { nick: string; wins: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      ranking.push({ nick: raw[i] as string, wins: Number(raw[i + 1]) });
    }
    return Response.json({ ranking });
  }

  const side = await redis.get<string>(`challenge:${matchId}:${nick}`);
  return Response.json({ side: side ?? null });
}

export function POST() {
  return tournamentClosed();
}
