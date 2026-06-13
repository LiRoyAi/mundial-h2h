import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

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

export async function POST(request: NextRequest) {
  let body: { matchId?: string; nick?: string; side?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, nick, side } = body;
  if (!matchId || !nick || !side) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }
  if (side !== "with" && side !== "against") {
    return Response.json({ error: "side must be 'with' or 'against'" }, { status: 400 });
  }

  await redis.set(`challenge:${matchId}:${nick}`, side, { ex: 30 * 24 * 3600 });
  return Response.json({ ok: true });
}
