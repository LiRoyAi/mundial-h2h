import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

// Tournament is over: serve previously generated briefs only, never call the AI.
export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "matchId required" }, { status: 400 });

  const cached = await redis.get<string>(`ai_brief:${matchId}`);
  if (cached) return Response.json({ brief: cached });

  return Response.json({ brief: null });
}
