import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import matchesData from "@/data/matches.json";
import { calculateAndSaveBadges } from "@/lib/badges";

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
  const dayPoints: Record<string, number> = {};
  const scoreFreq: Record<string, number> = {};
  const now = Date.now();

  for (let i = 0; i < MATCHES.length; i++) {
    const match = MATCHES[i];
    const raw = voteValues[i];
    if (!raw) continue;

    const myVote = raw.replace("-", ":");
    const result = resultValues[i] ?? null;
    const day = cestDateKey(match.deadline);
    votedDays.add(day);
    scoreFreq[myVote] = (scoreFreq[myVote] ?? 0) + 1;

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
        dayPoints[day] = (dayPoints[day] ?? 0) + pts;
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

  const bestDay = Object.values(dayPoints).length > 0 ? Math.max(...Object.values(dayPoints)) : 0;
  const favoriteScore = Object.entries(scoreFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const missedCount = MATCHES.filter((m, i) => new Date(m.deadline).getTime() < now && !voteValues[i]).length;

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

  const badges = await calculateAndSaveBadges(redis, nick);

  return Response.json({
    nick,
    totalPoints,
    globalRank,
    globalTotal,
    accuracy,
    streak,
    bestDay,
    favoriteScore,
    missedCount,
    votedCount: votes.length,
    votes,
    badges,
  });
}
