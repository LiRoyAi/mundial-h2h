import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

const ONBOARDING_TTL = 30 * 24 * 3600;

export async function GET(request: NextRequest) {
  const nick = new URL(request.url).searchParams.get("nick");
  if (!nick) return Response.json({ message: null, showOnboarding: false });

  const [message, onboarded, rankingVal, newBadgeId] = await Promise.all([
    redis.get<string>(`notification:${nick}`),
    redis.exists(`onboarded:${nick}`),
    redis.get(`ranking:${nick}`),
    redis.get<string>(`notification_badge:${nick}`),
  ]);

  const delOps: Promise<unknown>[] = [];
  if (message) delOps.push(redis.del(`notification:${nick}`));
  if (newBadgeId) delOps.push(redis.del(`notification_badge:${nick}`));
  if (delOps.length > 0) await Promise.all(delOps);

  let showOnboarding = false;
  if (!onboarded) {
    if (rankingVal !== null) {
      // Existing player without flag — backfill silently
      void redis.set(`onboarded:${nick}`, "1", { ex: ONBOARDING_TTL });
    } else {
      showOnboarding = true;
    }
  }

  return Response.json({ message: message ?? null, showOnboarding, newBadgeId: newBadgeId ?? null });
}
