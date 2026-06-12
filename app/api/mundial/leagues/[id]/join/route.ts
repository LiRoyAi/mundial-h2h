import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params;

  let body: { nick?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nick = body.nick?.trim().slice(0, 24);
  if (!nick) {
    return Response.json({ error: "Missing nick" }, { status: 400 });
  }

  const league = await redis.hgetall(`league:${leagueId}`);
  if (!league || Object.keys(league).length === 0) {
    return Response.json({ error: "League not found" }, { status: 404 });
  }

  const isMember = await redis.sismember(`league:${leagueId}:members`, nick);
  if (isMember) {
    return Response.json({ error: "Already in league" }, { status: 409 });
  }

  await Promise.all([
    redis.sadd(`league:${leagueId}:members`, nick),
    redis.sadd(`leagues:${nick}`, leagueId),
  ]);

  return Response.json({ ok: true });
}
