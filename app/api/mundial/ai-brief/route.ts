import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import matchesData from "@/data/matches.json";

const redis = Redis.fromEnv();
const anthropic = new Anthropic();
export const dynamic = "force-dynamic";

interface H2HGame {
  year: number;
  score: string;
  competition: string;
  winner: string;
}

interface RawMatch {
  id: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  h2h?: {
    total_matches: number;
    team1_wins: number;
    team2_wins: number;
    draws: number;
    goals_team1: number;
    goals_team2: number;
    first_ever: boolean;
    matches: H2HGame[];
  };
}

const MATCHES = matchesData.matches as RawMatch[];

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "matchId required" }, { status: 400 });

  const cached = await redis.get<string>(`ai_brief:${matchId}`);
  if (cached) return Response.json({ brief: cached });

  const match = MATCHES.find((m) => m.id === matchId);
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });

  const h2h = match.h2h;
  let h2hSummary: string;

  if (!h2h || h2h.first_ever || h2h.total_matches === 0) {
    h2hSummary = "Pierwsze spotkanie tych drużyn w historii.";
  } else {
    const recentGames = [...h2h.matches].reverse().slice(0, 3)
      .map((g) => `${g.year}: ${g.score} (${g.competition})`)
      .join(", ");
    h2hSummary = `Bilans: ${h2h.team1_wins}W-${h2h.draws}R-${h2h.team2_wins}W na korzyść ${match.t1.name}. Bramki łącznie: ${h2h.goals_team1}:${h2h.goals_team2}. Ostatnie mecze: ${recentGames}.`;
  }

  const prompt = `Na podstawie tych danych wygeneruj krótki, dynamiczny komentarz przedmeczowy (max 3 zdania, po polsku, styl sportowy, lekko złośliwy ale nie obraźliwy):
Mecz: ${match.t1.name} vs ${match.t2.name}
Bilans historyczny: ${h2hSummary}
Format: Historia starcia w jednym zdaniu. Kontekst obecnego meczu. Stylowy komentarz na co zwrócić uwagę.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const brief = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  if (!brief) return Response.json({ error: "AI generation failed" }, { status: 500 });

  await redis.set(`ai_brief:${matchId}`, brief, { ex: 86400 });

  return Response.json({ brief });
}
