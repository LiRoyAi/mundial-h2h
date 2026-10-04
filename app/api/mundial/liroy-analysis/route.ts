import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { tournamentClosed } from "@/lib/tournament";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "matchId required" }, { status: 400 });

  const analysis = await redis.get<string>(`liroy_analysis:${matchId}`);
  return Response.json({ analysis: analysis ?? null });
}

export function POST() {
  return tournamentClosed();
}
