import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Redis } from "@upstash/redis";
import matchesData from "@/data/matches.json";
import { buildVoteSummaries, getDna } from "@/lib/dna";

const MATCHES = matchesData.matches as { id: string; deadline: string }[];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nick: string }>;
}): Promise<Metadata> {
  const { nick: rawNick } = await params;
  const nick = decodeURIComponent(rawNick);

  try {
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
    const rankStr = rank > 0 ? `#${rank}` : "?";

    const ogImage = `https://mundial.liroy.pl/api/mundial/og/gracz/${encodeURIComponent(nick)}`;
    const title = `${nick} — H2H Archive Mundial 2026`;
    const description = `Jestem ${rankStr} z ${points} pkt · DNA: ${dna} · mundial.liroy.pl`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://mundial.liroy.pl/gracz/${encodeURIComponent(nick)}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: `${nick} — Mundial 2026` }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: `${nick} — H2H Archive Mundial 2026`,
      description: "mundial.liroy.pl",
    };
  }
}

export default function GraczLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
