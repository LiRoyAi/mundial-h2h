import { Redis } from "@upstash/redis";
import matchesData from "@/data/matches.json";

interface MatchInfo { id: string; deadline: string }
const MATCHES = matchesData.matches as MatchInfo[];

export type BadgeId = "snajper" | "hot_streak" | "perfect_day" | "underdog" | "pierwsza_krew";

function parseScore(s: string): [number, number] | null {
  const parts = s.replace("-", ":").split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return [parts[0], parts[1]];
}

function sign(a: number, b: number): number {
  return a > b ? 1 : a < b ? -1 : 0;
}

function cestDay(deadline: string): string {
  const d = new Date(new Date(deadline).getTime() + 2 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function calculateAndSaveBadges(redis: Redis, nick: string): Promise<BadgeId[]> {
  const [resultValues, voteValues, regSeq] = await Promise.all([
    redis.mget<(string | null)[]>(...MATCHES.map((m) => `result:${m.id}`)),
    redis.mget<(string | null)[]>(...MATCHES.map((m) => `vote:${m.id}:${nick}`)),
    redis.get<number>(`registered_seq:${nick}`),
  ]);

  const results = new Map<string, string>();
  const playerVotes = new Map<string, string>();
  MATCHES.forEach((m, i) => {
    if (resultValues[i]) results.set(m.id, resultValues[i]!);
    if (voteValues[i]) playerVotes.set(m.id, voteValues[i]!.replace("-", ":"));
  });

  if (playerVotes.size === 0) {
    await redis.set(`badge:${nick}`, "[]");
    return [];
  }

  // Points per voted+resolved match
  const matchPoints = new Map<string, number>();
  for (const [matchId, actual] of results) {
    const voted = playerVotes.get(matchId);
    if (!voted) continue;
    const vp = parseScore(voted);
    const ap = parseScore(actual);
    if (!vp || !ap) continue;
    let pts = 0;
    if (vp[0] === ap[0] && vp[1] === ap[1]) pts = 3;
    else if (sign(vp[0], vp[1]) === sign(ap[0], ap[1])) pts = 1;
    matchPoints.set(matchId, pts);
  }

  const badges = new Set<BadgeId>();

  // snajper: at least one exact score
  if ([...matchPoints.values()].some((p) => p === 3)) badges.add("snajper");

  // hot_streak: 3 consecutive correct results in deadline order
  const sortedByDeadline = MATCHES
    .filter((m) => matchPoints.has(m.id))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  let run = 0;
  for (const m of sortedByDeadline) {
    if ((matchPoints.get(m.id) ?? 0) > 0) {
      if (++run >= 3) { badges.add("hot_streak"); break; }
    } else {
      run = 0;
    }
  }

  // perfect_day: all matches on a CEST day resolved, player voted all, all correct
  const matchesByDay = new Map<string, MatchInfo[]>();
  for (const m of MATCHES) {
    const day = cestDay(m.deadline);
    if (!matchesByDay.has(day)) matchesByDay.set(day, []);
    matchesByDay.get(day)!.push(m);
  }
  for (const [, dayMatches] of matchesByDay) {
    if (!dayMatches.every((m) => results.has(m.id))) continue;       // all resolved
    if (!dayMatches.every((m) => playerVotes.has(m.id))) continue;   // voted on all
    if (dayMatches.every((m) => (matchPoints.get(m.id) ?? 0) > 0)) {
      badges.add("perfect_day");
      break;
    }
  }

  // underdog: correct when <20% of community voted for same winner direction
  const correctIds = [...matchPoints.entries()].filter(([, p]) => p > 0).map(([id]) => id);
  if (correctIds.length > 0) {
    const allVoteKeys = await redis.keys("votes:*");
    if (allVoteKeys.length > 0) {
      const counts = await redis.mget<number[]>(...allVoteKeys);
      const voteMap = new Map<string, number>();
      allVoteKeys.forEach((k, i) => voteMap.set(k, counts[i] ?? 0));

      for (const matchId of correctIds) {
        if (badges.has("underdog")) break;
        const ap = parseScore(results.get(matchId)!);
        if (!ap) continue;
        let total = 0, sameDir = 0;
        const prefix = `votes:${matchId}:`;
        for (const [k, cnt] of voteMap) {
          if (!k.startsWith(prefix)) continue;
          total += cnt;
          const sp = parseScore(k.slice(prefix.length));
          if (sp && sign(sp[0], sp[1]) === sign(ap[0], ap[1])) sameDir += cnt;
        }
        if (total >= 3 && sameDir / total < 0.2) badges.add("underdog");
      }
    }
  }

  // pierwsza_krew: registered when ≤10 players had signed up
  if (regSeq !== null && regSeq <= 10) badges.add("pierwsza_krew");

  const earned = [...badges];
  await redis.set(`badge:${nick}`, JSON.stringify(earned));
  return earned;
}

export async function getBadges(redis: Redis, nick: string): Promise<BadgeId[]> {
  const raw = await redis.get<string>(`badge:${nick}`);
  if (!raw) return [];
  try { return JSON.parse(raw) as BadgeId[]; } catch { return []; }
}
