import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const nick = new URL(request.url).searchParams.get("nick");
  if (!nick) return Response.json({ message: null });

  const message = await redis.get<string>(`notification:${nick}`);
  if (message) {
    await redis.del(`notification:${nick}`);
  }
  return Response.json({ message: message ?? null });
}
