import { Redis } from "@upstash/redis";
import matchesData from "@/data/matches.json";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

interface RawMatch {
  id: string;
  group: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
}

interface TeamStanding {
  name: string;
  flag: string;
  pts: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  mp: number;
}

const MATCHES = matchesData.matches as RawMatch[];

export async function GET() {
  const resultValues = await redis.mget<(string | null)[]>(
    ...MATCHES.map((m) => `result:${m.id}`)
  );
  const resultMap: Record<string, string> = {};
  MATCHES.forEach((m, i) => {
    if (resultValues[i]) resultMap[m.id] = resultValues[i]!;
  });

  const groupMap: Record<string, Record<string, TeamStanding>> = {};

  for (const match of MATCHES) {
    const g = match.group;
    if (!groupMap[g]) groupMap[g] = {};
    const teams = groupMap[g];

    if (!teams[match.t1.name]) {
      teams[match.t1.name] = { name: match.t1.name, flag: match.t1.flag, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, mp: 0 };
    }
    if (!teams[match.t2.name]) {
      teams[match.t2.name] = { name: match.t2.name, flag: match.t2.flag, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, mp: 0 };
    }

    const result = resultMap[match.id];
    if (!result) continue;

    const [g1, g2] = result.split(":").map(Number);
    if (isNaN(g1) || isNaN(g2)) continue;

    teams[match.t1.name].mp++;
    teams[match.t2.name].mp++;
    teams[match.t1.name].gf += g1;
    teams[match.t1.name].ga += g2;
    teams[match.t2.name].gf += g2;
    teams[match.t2.name].ga += g1;

    if (g1 > g2) {
      teams[match.t1.name].w++;
      teams[match.t1.name].pts += 3;
      teams[match.t2.name].l++;
    } else if (g1 < g2) {
      teams[match.t2.name].w++;
      teams[match.t2.name].pts += 3;
      teams[match.t1.name].l++;
    } else {
      teams[match.t1.name].d++;
      teams[match.t1.name].pts++;
      teams[match.t2.name].d++;
      teams[match.t2.name].pts++;
    }
  }

  const groups = Object.entries(groupMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, teams]) => ({
      id,
      teams: Object.values(teams).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        const gdDiff = (b.gf - b.ga) - (a.gf - a.ga);
        if (gdDiff !== 0) return gdDiff;
        return b.gf - a.gf;
      }),
    }));

  return Response.json({ groups });
}
