import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
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
