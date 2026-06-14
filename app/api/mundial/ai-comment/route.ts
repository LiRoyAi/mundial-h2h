import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const redis = Redis.fromEnv();
const anthropic = new Anthropic();
export const dynamic = "force-dynamic";

function normalize(score: string) {
  return score.replace("-", ":");
}

function winner(score: string): "team1" | "team2" | "draw" {
  const [a, b] = normalize(score).split(":").map(Number);
  if (isNaN(a) || isNaN(b)) return "draw";
  if (a > b) return "team1";
  if (b > a) return "team2";
  return "draw";
}

function buildPrompt(score: string, result: string | null, goldenBall: boolean): string {
  if (!result) {
    return `Gracz właśnie wpisał typ ${score} na nadchodzący mecz. Napisz krótki komentarz — przekorny, jakbyś nie był pewien tego wyboru.`;
  }

  const normScore = normalize(score);
  const normResult = normalize(result);
  const isExact = normScore === normResult;
  const isWinner = !isExact && winner(normScore) === winner(normResult);

  if (goldenBall) {
    if (isExact) {
      return `Gracz użył Złotej Piłki i trafił dokładny wynik ${score}. Napisz krótki komentarz o odwadze i nagrodzie. Wzmiankuj +6 pkt.`;
    }
    if (!isWinner) {
      return `Gracz użył Złotej Piłki i chybił — wpisał ${score}, wynik meczu to ${result}. Napisz komentarz o ryzyku które nie wyszło. Wzmiankuj -1 pkt.`;
    }
    return `Gracz użył Złotej Piłki, wpisał ${score} — wynik meczu to ${result} — trafił zwycięzcę ale nie dokładny wynik. Napisz krótki złośliwy komentarz. Wzmiankuj +2 pkt.`;
  }

  if (isExact) {
    return `Gracz wpisał dokładny wynik ${score}, który okazał się prawidłowy. Mecz zakończył się ${result}. Napisz krótki złośliwy komentarz gratulacyjny.`;
  }
  if (isWinner) {
    return `Gracz wpisał ${score}, wynik meczu to ${result} — trafił zwycięzcę ale nie dokładny wynik. Napisz krótki złośliwy komentarz.`;
  }
  return `Gracz wpisał ${score}, wynik meczu to ${result} — chybił całkowicie. Napisz krótki złośliwy komentarz o pudłach.`;
}

export async function POST(request: NextRequest) {
  let body: { matchId?: string; nick?: string; score?: string; goldenBall?: boolean; result?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { matchId, nick, score, goldenBall = false, result = null } = body;
  if (!matchId || !nick || !score) {
    return Response.json({ error: "matchId, nick and score required" }, { status: 400 });
  }

  const cacheKey = `ai_comment:${matchId}:${nick}:${normalize(score)}`;
  const cached = await redis.get<string>(cacheKey);
  if (cached) return Response.json({ comment: cached });

  const userPrompt = buildPrompt(score, result ?? null, goldenBall);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 128,
    system:
      "Jesteś komentarzem mundialowej gry typów. Twój styl: krótki, lekko złośliwy, sportowy, po polsku. Maks 1-2 zdania. Bez emoji na początku. Nie używaj imion ani nicków graczy.",
    messages: [{ role: "user", content: userPrompt }],
  });

  const comment =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  if (!comment) return Response.json({ error: "AI generation failed" }, { status: 500 });

  await redis.set(cacheKey, comment, { ex: 7 * 24 * 3600 });

  return Response.json({ comment });
}
