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
  time: string;
}

const MATCHES = matchesData.matches as RawMatch[];

function cestDateKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 2 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseScore(s: string): { g1: number; g2: number } | null {
  const parts = s.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { g1: parts[0], g2: parts[1] };
}

function calcPts(vote: string, result: string): number {
  const vp = parseScore(vote.replace("-", ":"));
  const rp = parseScore(result);
  if (!vp || !rp) return 0;
  if (vp.g1 === rp.g1 && vp.g2 === rp.g2) return 3;
  const sign = (a: number, b: number) => (a > b ? 1 : a < b ? -1 : 0);
  if (sign(vp.g1, vp.g2) === sign(rp.g1, rp.g2)) return 1;
  return 0;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params;

  const [league, members] = await Promise.all([
    redis.hgetall(`league:${leagueId}`),
    redis.smembers(`league:${leagueId}:members`),
  ]);

  if (!league || Object.keys(league).length === 0) {
    return Response.json({ error: "League not found" }, { status: 404 });
  }

  const ranking: { nick: string; points: number }[] = [];
  if (members.length > 0) {
    const values = await redis.mget<number[]>(...members.map((m) => `ranking:${m}`));
    members.forEach((nick, i) => {
      ranking.push({ nick, points: values[i] ?? 0 });
    });
    ranking.sort((a, b) => b.points - a.points);
  }

  // ── DZIŚ W LIDZE ────────────────────────────────────────────────────────────
  const todayKey = cestDateKey(new Date().toISOString());
  const todayMatches = MATCHES.filter((m) => cestDateKey(m.deadline) === todayKey);

  type MemberVote = { nick: string; vote: string | null; pts: number | null };
  type TodayMatch = {
    id: string;
    t1: { name: string; flag: string };
    t2: { name: string; flag: string };
    time: string;
    result: string | null;
    memberVotes: MemberVote[];
  };

  const todaySection: {
    matches: TodayMatch[];
    todayPoints: { nick: string; pts: number }[];
    bestOfDay: string | null;
    goldenBallMiss: { nick: string } | null;
  } = { matches: [], todayPoints: [], bestOfDay: null, goldenBallMiss: null };

  if (todayMatches.length > 0 && members.length > 0) {
    // Bulk fetch results + all member votes in parallel
    const resultKeys = todayMatches.map((m) => `result:${m.id}`);
    const voteKeys: string[] = [];
    const gbKeys: string[] = [];
    for (const m of todayMatches) {
      for (const nick of members) {
        voteKeys.push(`vote:${m.id}:${nick}`);
        gbKeys.push(`golden_ball_used:${m.id}:${nick}`);
      }
    }

    const [resultValues, voteValues, gbValues] = await Promise.all([
      redis.mget<(string | null)[]>(...resultKeys),
      redis.mget<(string | null)[]>(...voteKeys),
      redis.mget<(string | null)[]>(...gbKeys),
    ]);

    const resultMap: Record<string, string | null> = {};
    todayMatches.forEach((m, i) => { resultMap[m.id] = resultValues[i] ?? null; });

    // vote[matchId][nick]
    const voteMap: Record<string, Record<string, string | null>> = {};
    let vi = 0;
    for (const m of todayMatches) {
      voteMap[m.id] = {};
      for (const nick of members) {
        voteMap[m.id][nick] = voteValues[vi++] ?? null;
      }
    }

    // golden_ball_used map [matchId][nick]
    const gbUsedMap: Record<string, Record<string, boolean>> = {};
    let gbIdx = 0;
    for (const m of todayMatches) {
      gbUsedMap[m.id] = {};
      for (const nick of members) {
        gbUsedMap[m.id][nick] = !!gbValues[gbIdx++];
      }
    }

    const todayPtsMap: Record<string, number> = {};
    for (const nick of members) todayPtsMap[nick] = 0;

    // Sort member votes by ranking position for consistent display
    const rankOrder = ranking.map((e) => e.nick);
    const sortedMembers = [...members].sort((a, b) => {
      const ai = rankOrder.indexOf(a);
      const bi = rankOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    for (const m of todayMatches) {
      const result = resultMap[m.id];
      const memberVotes: MemberVote[] = [];

      for (const nick of sortedMembers) {
        const raw = voteMap[m.id][nick] ?? null;
        const vote = raw ? raw.replace("-", ":") : null;
        let pts: number | null = null;
        if (vote && result) {
          pts = calcPts(vote, result);
          todayPtsMap[nick] += pts;
        }
        memberVotes.push({ nick, vote, pts });
      }

      todaySection.matches.push({
        id: m.id,
        t1: m.t1,
        t2: m.t2,
        time: m.time,
        result: result ?? null,
        memberVotes,
      });
    }

    todaySection.todayPoints = Object.entries(todayPtsMap)
      .filter(([, pts]) => pts > 0)
      .map(([nick, pts]) => ({ nick, pts }))
      .sort((a, b) => b.pts - a.pts);

    if (todaySection.todayPoints.length > 0) {
      todaySection.bestOfDay = todaySection.todayPoints[0].nick;
    }

    // Find first league member who used a golden ball today and missed (-1)
    outer: for (const m of todayMatches) {
      const result = resultMap[m.id];
      if (!result) continue;
      for (const nick of members) {
        if (gbUsedMap[m.id][nick]) {
          const vote = voteMap[m.id][nick];
          if (vote && calcPts(vote, result) === 0) {
            todaySection.goldenBallMiss = { nick };
            break outer;
          }
        }
      }
    }
  }

  return Response.json({
    id: leagueId,
    name: league.name,
    owner: league.owner,
    members: members.length,
    ranking,
    todaySection,
  });
}
