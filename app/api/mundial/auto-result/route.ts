import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

// football-data.org TLA → our match ID code, for known divergences
const TLA_REMAP: Record<string, string> = {
  HTI: "hai",  // Haiti
  ANT: "cuw",  // Curaçao (sometimes listed as Netherlands Antilles)
  NCA: "nic",  // Nicaragua (just in case)
  ALG: "alg",  // Algeria (already lowercase match)
};

function normalizeTla(tla: string | null | undefined): string {
  if (!tla) return "";
  const upper = tla.toUpperCase();
  return (TLA_REMAP[upper] ?? upper.toLowerCase());
}

function parseScore(score: string): { g1: number; g2: number } | null {
  const parts = score.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { g1: parts[0], g2: parts[1] };
}

async function applyResult(
  matchId: string,
  result: string,
  adminKey: string,
  baseUrl: string
): Promise<{ status: "applied" | "already_applied" | "error"; detail?: string }> {
  const alreadyApplied = await redis.get(`result_applied:${matchId}`);
  if (alreadyApplied) return { status: "already_applied" };

  const res = await fetch(`${baseUrl}/api/mundial/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchId, result, adminKey }),
  });

  if (res.ok) return { status: "applied" };
  const body = await res.json().catch(() => ({}));
  return { status: "error", detail: JSON.stringify(body) };
}

export async function POST(request: NextRequest) {
  let body: { adminKey?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* no body is fine for Make trigger */
  }

  if (body.adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "FOOTBALL_DATA_API_KEY not configured" }, { status: 500 });
  }

  // Fetch ALL finished WC matches — no date or timezone filtering.
  // Matches can end late-night in US/Mexico/Canada time zones, so any date
  // comparison would risk skipping legitimate results. The only guard is
  // Redis idempotency (result_applied:{matchId}) which prevents double-scoring.
  const fdRes = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED",
    {
      headers: { "X-Auth-Token": apiKey },
      cache: "no-store",
    }
  );
  if (!fdRes.ok) {
    const text = await fdRes.text().catch(() => "");
    return Response.json(
      { error: `football-data.org API error ${fdRes.status}`, detail: text },
      { status: 502 }
    );
  }
  const fdData = await fdRes.json();
  const fdMatches: any[] = fdData.matches ?? [];

  // Load local matches to build the known-ID set (file is bundled at build time,
  // readable at Vercel runtime just like any static asset).
  let localIds: Set<string> = new Set();
  try {
    const raw = readFileSync(join(process.cwd(), "data", "matches.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const arr: any[] = parsed.matches ?? parsed;
    localIds = new Set(arr.map((m: any) => m.id));
  } catch {
    // Non-fatal: if file can't be read, localIds stays empty and we'll try all
    // WC matches (applyResult will gracefully skip unknown matchIds via the
    // result endpoint's own validation).
  }

  const baseUrl = "https://mundial.liroy.pl";
  const adminKey = process.env.ADMIN_KEY ?? "";

  const results: {
    matchId: string;
    result: string;
    fdHome: string;
    fdAway: string;
    status: string;
    detail?: string;
  }[] = [];

  for (const m of fdMatches) {
    const homeTla = normalizeTla(m.homeTeam?.tla);
    const awayTla = normalizeTla(m.awayTeam?.tla);
    if (!homeTla || !awayTla) continue;

    const matchId = `${homeTla}-${awayTla}`;

    // Filter only our tournament matches; skip WC matches not in matches.json
    // (e.g. editions from other years if API returns them).
    // This is NOT a date filter — matches are identified by team TLAs, not dates.
    if (localIds.size > 0 && !localIds.has(matchId)) continue;

    const homeGoals = m.score?.fullTime?.home;
    const awayGoals = m.score?.fullTime?.away;
    if (homeGoals === null || homeGoals === undefined || awayGoals === null || awayGoals === undefined) {
      continue;
    }

    const result = `${homeGoals}:${awayGoals}`;
    if (!parseScore(result)) continue;

    const outcome = await applyResult(matchId, result, adminKey, baseUrl);
    results.push({
      matchId,
      result,
      fdHome: m.homeTeam?.name ?? homeTla,
      fdAway: m.awayTeam?.name ?? awayTla,
      status: outcome.status,
      detail: outcome.detail,
    });
  }

  const applied = results.filter((r) => r.status === "applied");
  const skipped = results.filter((r) => r.status === "already_applied");
  const errors = results.filter((r) => r.status === "error");

  return Response.json({
    ok: true,
    summary: { applied: applied.length, skipped: skipped.length, errors: errors.length },
    results,
  });
}

// GET for quick manual check (adminKey as query param)
export async function GET(request: NextRequest) {
  const adminKey = new URL(request.url).searchParams.get("adminKey");
  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Re-use POST logic
  return POST(
    new NextRequest(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminKey }),
    })
  );
}
