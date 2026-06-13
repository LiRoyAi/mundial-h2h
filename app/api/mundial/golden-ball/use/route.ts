import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { matchId?: string; nick?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, nick } = body;
  if (!matchId || !nick) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  // Idempotency — already used on this match
  const alreadyUsed = await redis.exists(`golden_ball_used:${matchId}:${nick}`);
  if (alreadyUsed) {
    const remaining = await redis.get<number>(`golden_balls:${nick}`);
    return Response.json({ ok: true, remaining: remaining ?? 0 });
  }

  const remaining = await redis.get<number>(`golden_balls:${nick}`);
  const current = remaining ?? 3;

  if (current <= 0) {
    return Response.json({ error: "no_balls_left" }, { status: 400 });
  }

  await Promise.all([
    redis.set(`golden_ball_used:${matchId}:${nick}`, "1", { ex: 90 * 24 * 3600 }),
    redis.decrby(`golden_balls:${nick}`, 1),
  ]);

  return Response.json({ ok: true, remaining: current - 1 });
}
