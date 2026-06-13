import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { calculateAndSaveBadges } from "@/lib/badges";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

function parseScore(score: string): { g1: number; g2: number } | null {
  const parts = score.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { g1: parts[0], g2: parts[1] };
}

function winner(g1: number, g2: number): "t1" | "t2" | "draw" {
  if (g1 > g2) return "t1";
  if (g2 > g1) return "t2";
  return "draw";
}

export async function GET(request: NextRequest) {
  const adminKey = new URL(request.url).searchParams.get("adminKey");
  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const resultKeys = await redis.keys("result:*");
  const results: Record<string, string> = {};
  if (resultKeys.length > 0) {
    const values = await redis.mget<(string | null)[]>(...resultKeys);
    resultKeys.forEach((k, i) => {
      if (values[i]) results[k.replace("result:", "")] = values[i]!;
    });
  }
  return Response.json({ results });
}

export async function POST(request: NextRequest) {
  let body: { matchId?: string; result?: string; adminKey?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, result, adminKey } = body;

  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!matchId || !result) {
    return Response.json({ error: "Missing matchId or result" }, { status: 400 });
  }

  const parsed = parseScore(result);
  if (!parsed) {
    return Response.json({ error: "Invalid result format, use e.g. 2:0" }, { status: 400 });
  }

  const alreadyApplied = await redis.get(`result_applied:${matchId}`);
  if (alreadyApplied) {
    return Response.json({ error: "Result already applied for this match" }, { status: 409 });
  }

  // Fetch all per-nick votes for this match
  const voteKeys = await redis.keys(`vote:${matchId}:*`);
  const { g1, g2 } = parsed;
  const actualWinner = winner(g1, g2);

  const pointOps: Promise<unknown>[] = [];
  const notifOps: Promise<unknown>[] = [];
  for (const vk of voteKeys) {
    const nick = vk.replace(`vote:${matchId}:`, "");
    const voted = await redis.get<string>(vk);
    if (!voted) continue;

    const vParsed = parseScore(voted.replace("-", ":"));
    if (!vParsed) continue;

    let pts = 0;
    if (vParsed.g1 === g1 && vParsed.g2 === g2) {
      pts = 3;
    } else if (winner(vParsed.g1, vParsed.g2) === actualWinner) {
      pts = 1;
    }
    if (pts > 0) {
      pointOps.push(redis.incrby(`ranking:${nick}`, pts));
    }

    const msg =
      pts === 3 ? "+3 pkt — trafiłeś dokładny wynik ✅" :
      pts === 1 ? "+1 pkt — trafiony zwycięzca" :
                  "pudło — 0 pkt, następnym razem";
    notifOps.push(redis.set(`notification:${nick}`, msg, { ex: 7 * 24 * 3600 }));
  }

  await Promise.all([
    ...pointOps,
    ...notifOps,
    redis.set(`result:${matchId}`, result),
    redis.set(`result_applied:${matchId}`, "1"),
  ]);

  // Best-effort update of matches.json (works in dev; read-only in Vercel prod)
  try {
    const dataPath = join(process.cwd(), "data", "matches.json");
    const data = JSON.parse(readFileSync(dataPath, "utf-8"));
    const idx = data.matches.findIndex((m: { id: string }) => m.id === matchId);
    if (idx !== -1) {
      data.matches[idx].result = result;
      writeFileSync(dataPath, JSON.stringify(data, null, 2));
    }
  } catch {
    // Silently ignore — filesystem is read-only in Vercel; result is in Redis
  }

  // Recalculate badges for all voters of this match
  try {
    const nicks = voteKeys.map((vk) => vk.replace(`vote:${matchId}:`, ""));
    await Promise.all(nicks.map((n) => calculateAndSaveBadges(redis, n)));
  } catch { /* don't fail the result save if badge calc errors */ }

  // Calculate challenge wins
  try {
    const liroyVote = await redis.get<string>(`vote:${matchId}:LiROY`);
    let liroyPts = 0;
    if (liroyVote) {
      const lParsed = parseScore(liroyVote.replace("-", ":"));
      if (lParsed) {
        if (lParsed.g1 === g1 && lParsed.g2 === g2) liroyPts = 3;
        else if (winner(lParsed.g1, lParsed.g2) === actualWinner) liroyPts = 1;
      }
    }
    const challengeKeys = await redis.keys(`challenge:${matchId}:*`);
    const challengeOps: Promise<unknown>[] = [];
    for (const ck of challengeKeys) {
      const challengeNick = ck.slice(`challenge:${matchId}:`.length);
      const side = await redis.get<string>(ck);
      if (!side) continue;
      const playerVote = await redis.get<string>(`vote:${matchId}:${challengeNick}`);
      if (!playerVote) continue;
      const pParsed = parseScore(playerVote.replace("-", ":"));
      if (!pParsed) continue;
      let playerPts = 0;
      if (pParsed.g1 === g1 && pParsed.g2 === g2) playerPts = 3;
      else if (winner(pParsed.g1, pParsed.g2) === actualWinner) playerPts = 1;
      const won =
        (side === "against" && playerPts > liroyPts) ||
        (side === "with" && playerPts === liroyPts);
      if (won) {
        challengeOps.push(redis.incrby(`challenge_wins:${challengeNick}`, 1));
        challengeOps.push(redis.zincrby("challenge_ranking", 1, challengeNick));
      }
    }
    if (challengeOps.length > 0) await Promise.all(challengeOps);
  } catch { /* don't fail result save if challenge calc errors */ }

  return Response.json({
    ok: true,
    matchId,
    result,
    playersScored: voteKeys.length,
  });
}

export async function DELETE(request: NextRequest) {
  let body: { matchId?: string; adminKey?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, adminKey } = body;

  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!matchId) {
    return Response.json({ error: "Missing matchId" }, { status: 400 });
  }

  const storedResult = await redis.get<string>(`result:${matchId}`);
  if (!storedResult) {
    return Response.json({ error: "No result found for this match" }, { status: 404 });
  }

  const parsed = parseScore(storedResult);
  if (!parsed) {
    return Response.json({ error: "Stored result is malformed" }, { status: 500 });
  }

  const voteKeys = await redis.keys(`vote:${matchId}:*`);
  const { g1, g2 } = parsed;
  const actualWinner = winner(g1, g2);

  const reverseOps: Promise<unknown>[] = [];
  for (const vk of voteKeys) {
    const nick = vk.replace(`vote:${matchId}:`, "");
    const voted = await redis.get<string>(vk);
    if (!voted) continue;

    const vParsed = parseScore(voted.replace("-", ":"));
    if (!vParsed) continue;

    let pts = 0;
    if (vParsed.g1 === g1 && vParsed.g2 === g2) pts = 3;
    else if (winner(vParsed.g1, vParsed.g2) === actualWinner) pts = 1;

    if (pts > 0) {
      reverseOps.push(redis.incrby(`ranking:${nick}`, -pts));
    }
    reverseOps.push(redis.del(`notification:${nick}`));
  }

  await Promise.all([
    ...reverseOps,
    redis.del(`result:${matchId}`),
    redis.del(`result_applied:${matchId}`),
  ]);

  return Response.json({
    ok: true,
    matchId,
    reversedResult: storedResult,
    playersAffected: voteKeys.length,
  });
}
