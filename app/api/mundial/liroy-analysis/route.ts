import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "matchId required" }, { status: 400 });

  const analysis = await redis.get<string>(`liroy_analysis:${matchId}`);
  return Response.json({ analysis: analysis ?? null });
}

export async function POST(request: NextRequest) {
  let body: { matchId?: string; analysis?: string; adminKey?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, analysis, adminKey } = body;

  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!matchId) {
    return Response.json({ error: "Missing matchId" }, { status: 400 });
  }
  if (typeof analysis !== "string") {
    return Response.json({ error: "Missing analysis" }, { status: 400 });
  }

  if (analysis.trim() === "") {
    await redis.del(`liroy_analysis:${matchId}`);
  } else {
    await redis.set(`liroy_analysis:${matchId}`, analysis.trim(), { ex: 30 * 24 * 3600 });
  }

  return Response.json({ ok: true });
}
