"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";

const B = "var(--font-bebas), 'Bebas Neue', sans-serif";

interface VoteEntry {
  matchId: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  deadline: string;
  group: string;
  myVote: string;
  result: string | null;
  pts: number | null;
  goldenBall: boolean;
}

interface PlayerData {
  nick: string;
  totalPoints: number;
  globalRank: number;
  globalTotal: number;
  accuracy: number | null;
  streak: number;
  bestDay: number;
  favoriteScore: string | null;
  missedCount: number;
  votedCount: number;
  votes: VoteEntry[];
  badges: string[];
}

const BADGE_DEFS: { id: string; emoji: string; label: string }[] = [
  { id: "snajper",      emoji: "🎯", label: "SNAJPER"       },
  { id: "hot_streak",   emoji: "🔥", label: "HOT STREAK"    },
  { id: "perfect_day",  emoji: "⭐", label: "PERFECT DAY"   },
  { id: "underdog",     emoji: "😈", label: "UNDERDOG"      },
  { id: "pierwsza_krew",emoji: "🩸", label: "PIERWSZA KREW" },
];

function getDna(votes: VoteEntry[], badges: string[], votedCount: number): string {
  if (votes.length === 0) return "Typowy typujący";

  const parsed = votes.map((v) => {
    const parts = v.myVote.split(":").map(Number);
    return parts.length === 2 && !parts.some(isNaN) ? { g1: parts[0], g2: parts[1] } : null;
  }).filter((x): x is { g1: number; g2: number } => x !== null);

  const avgGoals = parsed.length > 0
    ? parsed.reduce((s, p) => s + p.g1 + p.g2, 0) / parsed.length
    : 0;

  const resolved = votes.filter((v) => v.pts !== null);
  const exactCount = resolved.filter((v) => v.pts === 3).length;
  const exactRate = resolved.length > 0 ? exactCount / resolved.length : 0;

  const freq: Record<string, number> = {};
  for (const v of votes) freq[v.myVote] = (freq[v.myVote] ?? 0) + 1;
  const topVote = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  if (avgGoals > 3.0) return "Ryzykant ofensywny";
  if (topVote === "1:0" || topVote === "0:1") return "Beton 1:0";
  if (exactRate > 0.5) return "Snajper dokładnych wyników";
  if (badges.includes("underdog")) return "Król underdogów";
  if (avgGoals < 1.5) return "Zimny analityk";
  if (votedCount > 15) return "Mundialowy wariat";
  return "Typowy typujący";
}

function toLocalDate(deadline: string) {
  const d = new Date(new Date(deadline).getTime() + 2 * 3600_000);
  const day = d.getUTCDate();
  const months = [
    "sty", "lut", "mar", "kwi", "maj", "cze",
    "lip", "sie", "wrz", "paź", "lis", "gru",
  ];
  return `${day} ${months[d.getUTCMonth()]}`;
}

function PtsBadge({ pts }: { pts: number | null }) {
  if (pts === null) {
    return (
      <span className="text-[10px] tracking-widest" style={{ fontFamily: B, color: "#333" }}>—</span>
    );
  }
  const color = pts === 3 ? "#FFD700" : pts === 1 ? "#888" : "#333";
  const label = pts === 3 ? "3 PKT" : pts === 1 ? "1 PKT" : "0 PKT";
  return (
    <span className="text-[10px] tracking-widest" style={{ fontFamily: B, color }}>{label}</span>
  );
}

export default function PlayerPage() {
  const params = useParams();
  const nick = decodeURIComponent(params.nick as string);

  const [data, setData] = useState<PlayerData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/mundial/gracz/${encodeURIComponent(nick)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("Nie udało się załadować profilu."));
  }, [nick]);

  if (error) {
    return (
      <main style={{ background: "#000", minHeight: "100vh" }} className="flex items-center justify-center px-6">
        <p style={{ fontFamily: B, color: "#FF4444", letterSpacing: "0.2em" }}>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ background: "#000", minHeight: "100vh" }} className="flex items-center justify-center">
        <p style={{ fontFamily: B, color: "#333", letterSpacing: "0.3em" }}>ŁADOWANIE...</p>
      </main>
    );
  }

  return (
    <main style={{ background: "#000", minHeight: "100vh" }}>

      {/* Header */}
      <section className="pt-16 pb-10 px-6 text-center">
        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="text-xs tracking-[0.5em] mb-2" style={{ fontFamily: B, color: "#FFD700" }}>
          GRACZ
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
          style={{ fontFamily: B, fontSize: "clamp(2.5rem,8vw,5rem)", lineHeight: 0.95, color: "#fff" }}>
          {data.nick}
        </motion.h1>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-6 h-px w-28" style={{ background: "rgba(255,215,0,0.15)", transformOrigin: "center" }} />
      </section>

      <section className="px-6 pb-6 max-w-lg mx-auto">

        {/* Stats grid */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-4 gap-2 mb-2">
          {[
            { label: "PUNKTY", value: String(data.totalPoints) },
            { label: "RANKING", value: data.globalTotal > 0 ? `#${data.globalRank}` : "—" },
            { label: "CELNOŚĆ", value: data.accuracy !== null ? `${data.accuracy}%` : "—" },
            { label: "SERIA", value: data.streak > 0 ? `${data.streak}d` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="border border-[#FFD700]/15 bg-[#0a0a0a] px-2 py-4 text-center rounded-sm">
              <p className="text-[7px] tracking-widest mb-1" style={{ fontFamily: B, color: "#444" }}>{label}</p>
              <p className="leading-none" style={{ fontFamily: B, fontSize: "1.5rem", color: "#FFD700" }}>{value}</p>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "NAJLEPSZY WYNIK", value: data.bestDay > 0 ? `${data.bestDay} PKT` : "—" },
            { label: "ULUBIONY WYNIK", value: data.favoriteScore ?? "—" },
            { label: "MECZE BEZ TYPU", value: String(data.missedCount) },
          ].map(({ label, value }) => (
            <div key={label} className="border border-[#FFD700]/10 bg-[#0a0a0a] px-2 py-4 text-center rounded-sm">
              <p className="text-[7px] tracking-widest mb-1" style={{ fontFamily: B, color: "#333" }}>{label}</p>
              <p className="leading-none" style={{ fontFamily: B, fontSize: "1.4rem", color: "#888" }}>{value}</p>
            </div>
          ))}
        </motion.div>

        {/* DNA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}
          className="mb-3 px-4 py-3 rounded-sm flex items-center gap-2"
          style={{ background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.12)" }}>
          <span className="text-base">🧬</span>
          <span className="text-[10px] tracking-widest" style={{ fontFamily: B, color: "#555" }}>DNA GRACZA:</span>
          <span className="text-[11px] tracking-widest" style={{ fontFamily: B, color: "#FFD700" }}>
            {getDna(data.votes, data.badges, data.votedCount)}
          </span>
        </motion.div>

        {/* Badges */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-wrap gap-2 mb-6">
          {BADGE_DEFS.map(({ id, emoji, label }) => {
            const earned = data.badges.includes(id);
            return (
              <span key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] tracking-widest"
                style={{
                  fontFamily: B,
                  background: earned ? "rgba(255,215,0,0.08)" : "#0a0a0a",
                  border: `1px solid ${earned ? "rgba(255,215,0,0.35)" : "#1a1a1a"}`,
                  color: earned ? "#FFD700" : "#333",
                }}>
                <span style={{ opacity: earned ? 1 : 0.25 }}>{emoji}</span>
                {label}
              </span>
            );
          })}
        </motion.div>

        {/* Vote history */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="border border-[#FFD700]/15 bg-[#0a0a0a] rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#111] flex items-center justify-between">
            <p className="text-xs tracking-[0.4em]" style={{ fontFamily: B, color: "#FFD700" }}>
              HISTORIA TYPOWAŃ
            </p>
            <p className="text-[10px] tracking-widest" style={{ fontFamily: B, color: "#333" }}>
              {data.votedCount}
            </p>
          </div>

          {data.votes.length === 0 ? (
            <p className="text-center py-10 text-sm tracking-widest" style={{ fontFamily: B, color: "#2a2a2a" }}>
              BRAK TYPOWAŃ
            </p>
          ) : (
            <ul className="divide-y divide-[#0f0f0f]">
              {data.votes.map((v, i) => (
                <motion.li key={v.matchId}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="px-4 py-3 flex items-center gap-3">

                  {/* Group badge */}
                  <span className="shrink-0 text-[8px] tracking-widest px-1.5 py-0.5"
                    style={{ fontFamily: B, background: "#111", color: "#444" }}>
                    GR.{v.group}
                  </span>

                  {/* Teams */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs tracking-wide truncate" style={{ fontFamily: B, color: "#aaa" }}>
                      {v.t1.flag} {v.t1.name} — {v.t2.name} {v.t2.flag}
                    </p>
                    <p className="text-[9px] tracking-widest mt-0.5" style={{ fontFamily: B, color: "#444" }}>
                      {toLocalDate(v.deadline)}
                      {" · "}
                      <span style={{ color: "#666" }}>{v.myVote}</span>
                      {v.result && (
                        <span> → <span style={{ color: v.pts === 3 ? "#FFD700" : v.pts === 1 ? "#888" : "#555" }}>{v.result}</span></span>
                      )}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <PtsBadge pts={v.pts} />
                    {v.goldenBall && (
                      <span className="text-[8px] tracking-widest whitespace-nowrap"
                        style={{ fontFamily: B, color: "#FFD700" }}>
                        ⭐ ZŁOTA PIŁKA
                      </span>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Back */}
        <div className="mt-6 flex justify-center gap-6">
          <a href="/#ranking" className="text-[10px] tracking-widest hover:text-[#FFD700] transition-colors"
            style={{ fontFamily: B, color: "#555" }}>
            ← WRÓĆ DO RANKINGU
          </a>
          <a href="/" className="text-[10px] tracking-widest hover:text-[#FFD700] transition-colors"
            style={{ fontFamily: B, color: "#333" }}>
            TYPOWANIE
          </a>
        </div>

      </section>
    </main>
  );
}
