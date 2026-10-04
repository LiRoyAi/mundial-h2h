import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { tournamentClosed } from "@/lib/tournament";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "Missing matchId" }, { status: 400 });

  const pick = await redis.get<string>(`liroy_pick:${matchId}`);
  return Response.json({ pick: pick ?? null });
}

export function POST() {
  return tournamentClosed();
}
