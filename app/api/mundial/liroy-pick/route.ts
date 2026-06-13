import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "Missing matchId" }, { status: 400 });

  const pick = await redis.get<string>(`liroy_pick:${matchId}`);
  return Response.json({ pick: pick ?? null });
}

export async function POST(request: NextRequest) {
  let body: { matchId?: string; pick?: string; adminKey?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, pick, adminKey } = body;

  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!matchId || !pick) {
    return Response.json({ error: "Missing matchId or pick" }, { status: 400 });
  }
  if (!/^\d{1,2}:\d{1,2}$/.test(pick)) {
    return Response.json({ error: "Invalid pick format, use e.g. 2:1" }, { status: 400 });
  }

  await redis.set(`liroy_pick:${matchId}`, pick);

  // Auto-cast LiROY's personal vote if not already set
  const voteKey = `vote:${matchId}:LiROY`;
  const alreadyVoted = await redis.exists(voteKey);
  if (!alreadyVoted) {
    await Promise.all([
      redis.incr(`votes:${matchId}:${pick}`),
      redis.incr(`ranking:LiROY`),
      redis.set(voteKey, pick),
      redis.set(`onboarded:LiROY`, "1", { ex: 30 * 24 * 3600 }),
      redis.set(`golden_balls:LiROY`, 3, { nx: true }),
    ]);
    const alreadyReg = await redis.exists(`registered_seq:LiROY`);
    if (!alreadyReg) {
      const seq = await redis.incr("player_registration_count");
      await redis.set(`registered_seq:LiROY`, seq);
    }
  }

  return Response.json({ ok: true, matchId, pick, autoVoted: !alreadyVoted });
}
