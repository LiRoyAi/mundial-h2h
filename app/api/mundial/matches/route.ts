import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

type RawMatch = {
  id: string;
  group: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  date?: string;
  time?: string;
  deadline?: string;
  youtube_pl?: string | null;
  youtube_en?: string | null;
  result?: string | null;
};

export async function GET(_request: NextRequest) {
  const dataPath = join(process.cwd(), "data", "matches.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const raw: RawMatch[] = data.matches ?? data;

  const matches = raw.map((m) => ({
    id: m.id,
    group: m.group,
    t1: m.t1,
    t2: m.t2,
    date: m.date ?? null,
    time: m.time ?? null,
    deadline: m.deadline ?? null,
    youtube_pl: m.youtube_pl ?? null,
    youtube_en: m.youtube_en ?? null,
    result: m.result ?? null,
  }));

  return Response.json(matches, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
