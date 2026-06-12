import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { nick?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nick = body.nick?.trim().slice(0, 24);
  const name = body.name?.trim().slice(0, 40);
  if (!nick || !name) {
    return Response.json({ error: "Missing nick or name" }, { status: 400 });
  }

  const id = randomBytes(4).toString("hex");

  await Promise.all([
    redis.hset(`league:${id}`, { name, owner: nick, createdAt: Date.now() }),
    redis.sadd(`league:${id}:members`, nick),
    redis.sadd(`leagues:${nick}`, id),
  ]);

  return Response.json({ id, name, owner: nick });
}
