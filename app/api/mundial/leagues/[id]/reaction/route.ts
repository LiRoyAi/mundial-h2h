import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

const REACTIONS: Record<string, string> = {
  co_typujesz: "😂 Co ty typujesz?",
  var: "⚖️ VAR ci nie pomoże",
  farciarz: "🍀 Farciarz",
  szacun: "👊 Szacun za typ",
  dogonie: "🏃 Dzisiaj cię dogonię",
  strzal: "💥 To był strzał życia",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params;

  let body: { nick?: string; matchId?: string; reactionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nick = body.nick?.trim().slice(0, 24);
  const matchId = body.matchId?.trim().slice(0, 40);
  const reactionId = body.reactionId?.trim();

  if (!nick || !matchId || !reactionId) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const label = REACTIONS[reactionId];
  if (!label) {
    return Response.json({ error: "Invalid reaction" }, { status: 400 });
  }

  const isMember = await redis.sismember(`league:${leagueId}:members`, nick);
  if (!isMember) {
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  const rateLimitKey = `league_reaction:${leagueId}:${matchId}:${nick}`;
  const alreadyReacted = await redis.exists(rateLimitKey);
  if (alreadyReacted) {
    return Response.json({ error: "Already reacted" }, { status: 429 });
  }

  const entry = JSON.stringify({
    nick,
    reactionId,
    label,
    matchId,
    createdAt: new Date().toISOString(),
  });

  await Promise.all([
    redis.set(rateLimitKey, reactionId, { ex: 7 * 24 * 3600 }),
    redis.lpush(`league_reactions:${leagueId}`, entry),
  ]);
  await redis.ltrim(`league_reactions:${leagueId}`, 0, 19);

  return Response.json({ ok: true });
}
