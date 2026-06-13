import { ImageResponse } from "next/og";
import { Redis } from "@upstash/redis";
import { buildVoteSummaries, getDna } from "@/lib/dna";
import matchesData from "@/data/matches.json";

export const dynamic = "force-dynamic";

const MATCHES = matchesData.matches as { id: string }[];

const BADGE_EMOJIS: Record<string, string> = {
  snajper: "🎯",
  hot_streak: "🔥",
  perfect_day: "⭐",
  underdog: "😈",
  pierwsza_krew: "🩸",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nick: string }> }
) {
  const { nick: rawNick } = await params;
  const nick = decodeURIComponent(rawNick);

  const redis = Redis.fromEnv();

  const [rankingKeys, badgeRaw, voteValues, resultValues, pts] = await Promise.all([
    redis.keys("ranking:*"),
    redis.get<string>(`badge:${nick}`),
    redis.mget<(string | null)[]>(...MATCHES.map((m) => `vote:${m.id}:${nick}`)),
    redis.mget<(string | null)[]>(...MATCHES.map((m) => `result:${m.id}`)),
    redis.get<number>(`ranking:${nick}`),
  ]);

  const rankVals = rankingKeys.length > 0
    ? await redis.mget<(number | null)[]>(...rankingKeys)
    : [];
  const sorted = rankingKeys
    .map((k, i) => ({ nick: k.replace("ranking:", ""), pts: rankVals[i] ?? 0 }))
    .sort((a, b) => b.pts - a.pts);
  const rank = sorted.findIndex((e) => e.nick === nick) + 1;

  let badges: string[] = [];
  try { if (badgeRaw) badges = JSON.parse(badgeRaw); } catch { /* */ }

  const dna = getDna(buildVoteSummaries(MATCHES, voteValues, resultValues), badges);
  const points = pts ?? 0;
  const badgeEmojis = badges.map((b) => BADGE_EMOJIS[b]).filter(Boolean).join("  ");
  const nickFontSize = nick.length < 10 ? 100 : nick.length < 16 ? 76 : 56;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          fontFamily: "'Arial Black', Arial, sans-serif",
        }}
      >
        {/* top gold bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "5px", background: "#FFD700", display: "flex" }} />
        {/* bottom gold bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "5px", background: "#FFD700", display: "flex" }} />

        {/* left gold accent */}
        <div style={{ position: "absolute", top: 40, bottom: 40, left: 48, width: "2px", background: "rgba(255,215,0,0.15)", display: "flex" }} />

        {/* branding */}
        <div style={{
          position: "absolute", top: 30, right: 48,
          fontSize: 15, fontWeight: "bold", letterSpacing: "0.35em", color: "#2a2a2a",
          display: "flex",
        }}>
          MUNDIAL.LIROY.PL
        </div>

        {/* world cup badge */}
        <div style={{
          position: "absolute", top: 24, left: 72,
          fontSize: 13, fontWeight: "bold", letterSpacing: "0.5em", color: "#FFD700",
          display: "flex",
        }}>
          H2H ARCHIVE
        </div>

        {/* GRACZ label */}
        <div style={{
          fontSize: 16, fontWeight: "bold", letterSpacing: "0.6em", color: "#FFD700",
          marginBottom: 12, display: "flex",
        }}>
          GRACZ
        </div>

        {/* nick */}
        <div style={{
          fontSize: nickFontSize,
          fontWeight: "900",
          color: "#FFFFFF",
          letterSpacing: "-0.01em",
          lineHeight: 0.9,
          marginBottom: 28,
          maxWidth: "1080px",
          textAlign: "center",
          display: "flex",
        }}>
          {nick}
        </div>

        {/* stats row */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 56, marginBottom: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 60, fontWeight: "900", color: "#FFD700", lineHeight: 1, display: "flex" }}>
              {points}
            </div>
            <div style={{ fontSize: 13, letterSpacing: "0.35em", color: "#444", marginTop: 4, display: "flex" }}>
              PKT
            </div>
          </div>
          {rank > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 60, fontWeight: "900", color: "#888", lineHeight: 1, display: "flex" }}>
                #{rank}
              </div>
              <div style={{ fontSize: 13, letterSpacing: "0.35em", color: "#444", marginTop: 4, display: "flex" }}>
                RANKING
              </div>
            </div>
          )}
        </div>

        {/* DNA */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: badgeEmojis ? 18 : 0,
        }}>
          <span style={{ fontSize: 22, display: "flex" }}>🧬</span>
          <span style={{ fontSize: 15, letterSpacing: "0.35em", color: "#444", fontWeight: "bold", display: "flex" }}>
            DNA GRACZA:
          </span>
          <span style={{ fontSize: 18, letterSpacing: "0.1em", color: "#FFD700", fontWeight: "bold", display: "flex" }}>
            {dna.toUpperCase()}
          </span>
        </div>

        {/* badges */}
        {badgeEmojis && (
          <div style={{ fontSize: 30, letterSpacing: "0.2em", display: "flex" }}>
            {badgeEmojis}
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    }
  );
}
