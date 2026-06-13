import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nick = searchParams.get("nick");
  const matchId = searchParams.get("matchId");

  if (!nick) return Response.json({ error: "Missing nick" }, { status: 400 });

  const remaining = await redis.get<number>(`golden_balls:${nick}`);
  const result: { remaining: number; used?: boolean } = {
    remaining: remaining ?? 3,
  };

  if (matchId) {
    const used = await redis.exists(`golden_ball_used:${matchId}:${nick}`);
    result.used = used === 1;
  }

  return Response.json(result);
}
