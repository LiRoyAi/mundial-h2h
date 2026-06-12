import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import matchesData from "@/data/matches.json";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

interface RawMatch {
  id: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  deadline: string;
  group: string;
}

const MATCHES = matchesData.matches as RawMatch[];

function parseScore(s: string): { g1: number; g2: number } | null {
  const parts = s.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { g1: parts[0], g2: parts[1] };
}

function winner(g1: number, g2: number): "t1" | "t2" | "draw" {
  if (g1 > g2) return "t1";
  if (g2 > g1) return "t2";
  return "draw";
}

function cestDateKey(deadline: string): string {
  const d = new Date(new Date(deadline).getTime() + 2 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nick: string }> }
) {
  const { nick: rawNick } = await params;
  const nick = decodeURIComponent(rawNick);

  const [voteValues, resultValues] = await Promise.all([
    redis.mget<(string | null)[]>(...MATCHES.map((m) => `vote:${m.id}:${nick}`)),
    redis.mget<(string | null)[]>(...MATCHES.map((m) => `result:${m.id}`)),
  ]);

  const votes: {
    matchId: string;
    t1: { name: string; flag: string };
    t2: { name: string; flag: string };
    deadline: string;
    group: string;
    myVote: string;
    result: string | null;
    pts: number | null;
  }[] = [];

  let totalPoints = 0;
  let resolvedCount = 0;
  let correctCount = 0;
  const votedDays = new Set<string>();

  for (let i = 0; i < MATCHES.length; i++) {
    const match = MATCHES[i];
    const raw = voteValues[i];
    if (!raw) continue;

    const myVote = raw.replace("-", ":");
    const result = resultValues[i] ?? null;
    votedDays.add(cestDateKey(match.deadline));

    let pts: number | null = null;
    if (result) {
      const vp = parseScore(myVote);
      const rp = parseScore(result);
      if (vp && rp) {
        if (vp.g1 === rp.g1 && vp.g2 === rp.g2) pts = 3;
        else if (winner(vp.g1, vp.g2) === winner(rp.g1, rp.g2)) pts = 1;
        else pts = 0;
        totalPoints += pts;
        resolvedCount++;
        if (pts > 0) correctCount++;
      }
    }

    votes.push({
      matchId: match.id,
      t1: match.t1,
      t2: match.t2,
      deadline: match.deadline,
      group: match.group,
      myVote,
      result,
      pts,
    });
  }

  votes.sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());

  // Global rank from ranking:* keys (consistent with leaderboard)
  const rankingKeys = await redis.keys("ranking:*");
  let globalRank = rankingKeys.length + 1;
  const globalTotal = rankingKeys.length;
  if (rankingKeys.length > 0) {
    const values = await redis.mget<(number | null)[]>(...rankingKeys);
    const ranking = rankingKeys
      .map((k, i) => ({ nick: k.replace("ranking:", ""), pts: values[i] ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    const idx = ranking.findIndex((e) => e.nick === nick);
    if (idx !== -1) globalRank = idx + 1;
  }

  const accuracy = resolvedCount > 0 ? Math.round((correctCount / resolvedCount) * 100) : null;

  // Streak: consecutive past match-days (newest first) with ≥1 vote
  const now = Date.now();
  const passedDays = [
    ...new Set(
      MATCHES.filter((m) => new Date(m.deadline).getTime() < now).map((m) => cestDateKey(m.deadline))
    ),
  ]
    .sort()
    .reverse();

  let streak = 0;
  for (const day of passedDays) {
    if (votedDays.has(day)) streak++;
    else break;
  }

  return Response.json({
    nick,
    totalPoints,
    globalRank,
    globalTotal,
    accuracy,
    streak,
    votedCount: votes.length,
    votes,
  });
}
