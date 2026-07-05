import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

function parseScore(raw: string): { g1: number; g2: number } | null {
  const parts = raw.replace("-", ":").split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { g1: parts[0], g2: parts[1] };
}

function sign(a: number, b: number): 1 | -1 | 0 {
  return a > b ? 1 : a < b ? -1 : 0;
}

function calcPts(pick: string, result: string): number {
  const p = parseScore(pick);
  const r = parseScore(result);
  if (!p || !r) return 0;
  if (p.g1 === r.g1 && p.g2 === r.g2) return 3;
  if (sign(p.g1, p.g2) === sign(r.g1, r.g2)) return 1;
  return 0;
}

interface BonusEntry {
  nick: string;
  matchId: string;
  liroyPick: string;
  result: string;
  playerVote: string;
  alreadyApplied: boolean;
}

export async function POST(request: NextRequest) {
  let body: { adminKey?: string; dryRun?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = body.dryRun !== false; // default: dry run

  const resultKeys = await redis.keys("result:*");
  const bonuses: BonusEntry[] = [];

  for (const key of resultKeys) {
    const matchId = key.replace("result:", "");
    const result = await redis.get<string>(key);
    if (!result) continue;

    const liroyPick = await redis.get<string>(`liroy_pick:${matchId}`);
    if (!liroyPick) continue;

    if (calcPts(liroyPick, result) > 0) continue; // LiROY did NOT pudłować

    const challengeKeys = await redis.keys(`challenge:${matchId}:*`);
    for (const ck of challengeKeys) {
      const nick = ck.slice(`challenge:${matchId}:`.length);
      const side = await redis.get<string>(ck);
      if (side !== "against") continue;

      const playerVote = await redis.get<string>(`vote:${matchId}:${nick}`);
      if (!playerVote) continue;
      if (calcPts(playerVote, result) === 0) continue; // player also pudłował

      const flag = await redis.get<string>(`challenge_backfilled:${matchId}:${nick}`);
      bonuses.push({
        nick,
        matchId,
        liroyPick,
        result,
        playerVote,
        alreadyApplied: flag === "1",
      });
    }
  }

  const pending = bonuses.filter((b) => !b.alreadyApplied);
  const skipped = bonuses.filter((b) => b.alreadyApplied);

  const log: string[] = pending.map(
    (b) =>
      `Nick ${b.nick} +1 for ${b.matchId} (LiROY: ${b.liroyPick}, result: ${b.result}, player: ${b.playerVote})`
  );

  if (dryRun) {
    return Response.json({
      dryRun: true,
      pending: pending.length,
      skipped: skipped.length,
      log,
      bonuses: pending,
    });
  }

  // Apply
  for (const b of pending) {
    await redis.zincrby("challenge_ranking", 1, b.nick);
    await redis.incrby(`challenge_wins:${b.nick}`, 1);
    await redis.set(`challenge_backfilled:${b.matchId}:${b.nick}`, "1");
  }

  return Response.json({
    dryRun: false,
    applied: pending.length,
    skipped: skipped.length,
    log,
  });
}
