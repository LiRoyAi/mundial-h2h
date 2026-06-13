"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import matchesData from "@/data/matches.json";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
  id: string;
  group: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  deadline: string;
  youtube_pl: string | null;
  youtube_en: string | null;
  tiktok_url: string | null;
  published: boolean;
  result?: string | null;
  h2h?: {
    balance: string;
    t1_wins: number;
    draws: number;
    t2_wins: number;
    key_fact: string;
  };
}

interface RankingEntry {
  nick: string;
  points: number;
  accuracy: number | null;
}

interface UserRank {
  position: number;
  points: number;
}

type Results = Record<string, number>;

const MATCHES = matchesData.matches as Match[];
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const B = "var(--font-bebas), 'Bebas Neue', sans-serif";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocal(deadline: string) {
  const d = new Date(deadline);
  const local = new Date(d.getTime() + 2 * 3600_000);
  const day = local.getUTCDate();
  const months = [
    "", "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
  ];
  const month = months[local.getUTCMonth() + 1];
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return { date: `${day} ${month} 2026`, time: `${hh}:${mm}` };
}

function extractYtId(url: string | null) {
  if (!url) return null;
  const m = url.match(/shorts\/([A-Za-z0-9_-]+)/) || url.match(/v=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function isMatchToday(deadline: string, now: Date = new Date()): boolean {
  const d = new Date(new Date(deadline).getTime() + 2 * 3600_000);
  const n = new Date(now.getTime() + 2 * 3600_000);
  return d.getUTCFullYear() === n.getUTCFullYear() &&
    d.getUTCMonth() === n.getUTCMonth() &&
    d.getUTCDate() === n.getUTCDate();
}

function cestDay(deadline: string): string {
  const d = new Date(new Date(deadline).getTime() + 2 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatGroupDate(key: string): string {
  const parts = key.split("-").map(Number);
  const months = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];
  return `${parts[2]} ${months[parts[1] - 1]}`;
}

function categorize(matches: Match[], now: Date) {
  const active: Match[] = [];
  const todayUpcoming: Match[] = [];
  const upcoming: Match[] = [];
  const finished: Match[] = [];
  const nowMs = now.getTime();

  for (const m of matches) {
    const dlMs = new Date(m.deadline).getTime();
    if (dlMs <= nowMs - 24 * 3600_000) {
      finished.push(m);
    } else if (isMatchToday(m.deadline, now)) {
      todayUpcoming.push(m);
    } else if (dlMs > nowMs && dlMs <= nowMs + 24 * 3600_000) {
      active.push(m);
    } else if (dlMs > nowMs) {
      upcoming.push(m);
    } else {
      finished.push(m);
    }
  }
  return { active, todayUpcoming, upcoming, finished };
}

function getTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3600_000),
    m: Math.floor((diff % 3600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
  };
}

// ─── Share helper ─────────────────────────────────────────────────────────────

async function shareOrCopy(text: string): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ target, short = false }: { target: Date; short?: boolean }) {
  const [tl, setTl] = useState(() => getTimeLeft(target));
  useEffect(() => {
    const id = setInterval(() => setTl(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!tl) return null;

  if (short)
    return (
      <span style={{ fontFamily: B, color: "#FFD700", letterSpacing: "0.05em", fontSize: "1rem" }}>
        {tl.d > 0 ? `${tl.d}d ` : ""}
        {String(tl.h).padStart(2, "0")}:{String(tl.m).padStart(2, "0")}:
        {String(tl.s).padStart(2, "0")}
      </span>
    );

  return (
    <div className="flex gap-4">
      {tl.d > 0 && (
        <div className="text-center">
          <div style={{ fontFamily: B, fontSize: "2.5rem", color: "#FFD700", lineHeight: 1 }}>{tl.d}</div>
          <div style={{ fontFamily: B, fontSize: "0.6rem", color: "#555", letterSpacing: "0.2em" }}>DNI</div>
        </div>
      )}
      {([{ v: tl.h, l: "GODZ" }, { v: tl.m, l: "MIN" }, { v: tl.s, l: "SEK" }] as const).map(({ v, l }) => (
        <div key={l} className="text-center">
          <div style={{ fontFamily: B, fontSize: "2.5rem", color: "#FFD700", lineHeight: 1 }}>
            {String(v).padStart(2, "0")}
          </div>
          <div style={{ fontFamily: B, fontSize: "0.6rem", color: "#555", letterSpacing: "0.2em" }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── ScorePicker ──────────────────────────────────────────────────────────────

function ScorePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => onChange(Math.min(9, value + 1))}
        className="w-9 h-9 flex items-center justify-center border border-[#FFD700]/40 text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
        style={{ fontFamily: B, fontSize: "1.2rem" }}
      >+</button>
      <span className="text-3xl w-10 text-center" style={{ fontFamily: B, color: "#fff" }}>{value}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-9 h-9 flex items-center justify-center border border-[#FFD700]/40 text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
        style={{ fontFamily: B, fontSize: "1.2rem" }}
      >−</button>
    </div>
  );
}

// ─── Points helpers ───────────────────────────────────────────────────────────

function calcPts(myVote: string, result: string): number {
  const norm = myVote.replace("-", ":");
  const [v1, v2] = norm.split(":").map(Number);
  const [r1, r2] = result.split(":").map(Number);
  if ([v1, v2, r1, r2].some(isNaN)) return 0;
  if (v1 === r1 && v2 === r2) return 3;
  const sign = (a: number, b: number) => (a > b ? 1 : a < b ? -1 : 0);
  if (sign(v1, v2) === sign(r1, r2)) return 1;
  return 0;
}

function PtsBadge({ pts }: { pts: number }) {
  if (pts === 3)
    return <span className="text-xs tracking-widest" style={{ fontFamily: B, color: "#22c55e" }}>+3 PKT ✓</span>;
  if (pts === 1)
    return <span className="text-xs tracking-widest" style={{ fontFamily: B, color: "#FFD700" }}>+1 PKT</span>;
  return <span className="text-xs tracking-widest" style={{ fontFamily: B, color: "#555" }}>0 PKT</span>;
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({ match, nick, onFirstVote }: { match: Match; nick: string; onFirstVote?: () => void }) {
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [voted, setVoted] = useState(false);
  const [results, setResults] = useState<Results>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchResult, setMatchResult] = useState<string | null>(match.result ?? null);
  const isPast = new Date() > new Date(match.deadline);
  const { date, time } = toLocal(match.deadline);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/vote?matchId=${match.id}`);
      if (res.ok) {
        const d = await res.json();
        setResults(d.results ?? {});
        if (d.result) setMatchResult(d.result);
      }
    } catch { /* ignore */ }
  }, [match.id]);

  useEffect(() => {
    const stored = localStorage.getItem(`voted:${match.id}`);
    if (stored) setVoted(true);
    fetchResults();
  }, [match.id, fetchResults]);

  const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);
  const getBarWidth = (key: string) =>
    totalVotes === 0 ? 0 : Math.round(((results[key] ?? 0) / totalVotes) * 100);
  const topScores = Object.entries(results).sort(([, a], [, b]) => b - a).slice(0, 5);

  const handleVote = async () => {
    if (!nick.trim()) { setError("Wpisz nick przed typowaniem!"); return; }
    setError(""); setLoading(true);
    try {
      const scoreStr = `${score1}-${score2}`;
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, score: scoreStr, nick }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results ?? {});
      setVoted(true);
      localStorage.setItem(`voted:${match.id}`, scoreStr);
      onFirstVote?.();
    } catch { setError("Błąd połączenia. Spróbuj ponownie."); }
    finally { setLoading(false); }
  };

  const handleBrag = () => {
    const vote = localStorage.getItem(`voted:${match.id}`);
    void shareOrCopy(`Trafiłem wynik meczu ${match.t1.name} – ${match.t2.name}: ${vote} ⚽\nmundial.liroy.pl`);
  };

  const myVote = voted ? localStorage.getItem(`voted:${match.id}`) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="relative border border-[#FFD700]/20 bg-[#0a0a0a] rounded-sm overflow-hidden"
    >
      <div className="absolute top-0 left-0 px-3 py-1 text-xs tracking-widest"
        style={{ fontFamily: B, background: "#FFD700", color: "#000" }}>
        GRUPA {match.group}
      </div>
      <div className="pt-10 pb-6 px-4">
        <p className="text-center text-[11px] tracking-widest mb-6"
          style={{ fontFamily: B, color: "#FFD700" }}>
          {date} · {time}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-4xl">{match.t1.flag}</span>
            <span className="text-sm tracking-widest text-center" style={{ fontFamily: B, color: "#f5f5f5" }}>
              {match.t1.name}
            </span>
          </div>

          {matchResult ? (
            <div className="text-center px-2 flex flex-col items-center gap-1">
              {voted && myVote ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap" style={{ fontFamily: B, fontSize: "1.3rem", color: "#555" }}>
                      {myVote.replace("-", ":")}
                    </span>
                    <span style={{ fontFamily: B, fontSize: "1rem", color: "#333" }}>→</span>
                    <span className="whitespace-nowrap" style={{ fontFamily: B, fontSize: "2.2rem", color: "#FFD700" }}>
                      {matchResult}
                    </span>
                  </div>
                  <PtsBadge pts={calcPts(myVote, matchResult)} />
                </>
              ) : (
                <span className="whitespace-nowrap" style={{ fontFamily: B, fontSize: "2.5rem", color: "#FFD700" }}>
                  {matchResult}
                </span>
              )}
            </div>
          ) : voted ? (
            <div className="text-center px-4"
              style={{ fontFamily: B, fontSize: "2.5rem", color: "#FFD700", letterSpacing: "0.05em" }}>
              {myVote ?? "?"}
            </div>
          ) : !isPast ? (
            <div className="flex items-center gap-3">
              <ScorePicker value={score1} onChange={setScore1} />
              <span style={{ fontFamily: B, fontSize: "2rem", color: "#FFD700" }}>:</span>
              <ScorePicker value={score2} onChange={setScore2} />
            </div>
          ) : (
            <div className="text-center px-4" style={{ fontFamily: B, fontSize: "1.4rem", color: "#333" }}>⏰</div>
          )}

          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-4xl">{match.t2.flag}</span>
            <span className="text-sm tracking-widest text-center" style={{ fontFamily: B, color: "#f5f5f5" }}>
              {match.t2.name}
            </span>
          </div>
        </div>

        {error && <p className="text-center text-red-500 text-xs mt-4 tracking-wide">{error}</p>}
        {isPast && !voted && !matchResult && (
          <p className="text-center text-xs mt-6 tracking-widest" style={{ fontFamily: B, color: "#333" }}>
            ⏰ Typowanie zamknięte
          </p>
        )}
        {!isPast && !voted && (
          <div className="flex justify-center mt-6">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={handleVote} disabled={loading}
              className="px-10 py-3 text-black text-sm tracking-[0.2em] disabled:opacity-50"
              style={{ fontFamily: B, background: "#FFD700", letterSpacing: "0.2em" }}>
              {loading ? "WYSYŁAM..." : "TYPUJ"}
            </motion.button>
          </div>
        )}

        <AnimatePresence>
          {voted && topScores.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-2">
              <p className="text-xs tracking-widest mb-3 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
                ROZKŁAD TYPOWAŃ ({totalVotes} {totalVotes === 1 ? "głos" : "głosy/głosów"})
              </p>
              {topScores.map(([key]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-12 text-right text-sm"
                    style={{ fontFamily: B, color: key === myVote ? "#FFD700" : "#f5f5f5" }}>{key}</span>
                  <div className="flex-1 h-5 bg-[#111] rounded-sm overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${getBarWidth(key)}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }} className="h-full"
                      style={{ background: key === myVote ? "#FFD700" : "rgba(255,215,0,0.25)" }} />
                  </div>
                  <span className="w-8 text-xs" style={{ fontFamily: B, color: "#555" }}>{getBarWidth(key)}%</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {matchResult && voted && myVote?.replace("-", ":") === matchResult && (
          <div className="mt-3 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={handleBrag}
              className="px-8 py-2 text-black text-xs tracking-[0.2em]"
              style={{ fontFamily: B, background: "#FFD700" }}>
              POCHWAL SIĘ 🎯
            </motion.button>
          </div>
        )}

        {voted && (
          <div className="mt-3 pt-3 border-t border-[#111]">
            <p className="text-center text-[8px] tracking-widest mb-2" style={{ fontFamily: B, color: "#333" }}>
              POLEĆ ZNAJOMYM — NIECH TEŻ TYPUJĄ!
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <a href="https://wa.me/?text=Typuj%C4%99%20wyniki%20Mundialu%202026%20z%20Liroyem!%20mundial.liroy.pl"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2.5 border border-[#FFD700]/20 hover:border-[#FFD700]/50 transition-colors text-[9px]"
                style={{ fontFamily: B, color: "#666" }}>
                📱 WhatsApp
              </a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=mundial.liroy.pl"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2.5 border border-[#FFD700]/20 hover:border-[#FFD700]/50 transition-colors text-[9px]"
                style={{ fontFamily: B, color: "#666" }}>
                📘 Facebook
              </a>
              <a href="https://twitter.com/intent/tweet?text=Typuj%C4%99%20wyniki%20Mundialu%202026!%20mundial.liroy.pl%20%23mundial2026"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2.5 border border-[#FFD700]/20 hover:border-[#FFD700]/50 transition-colors text-[9px]"
                style={{ fontFamily: B, color: "#666" }}>
                🐦 X/Twitter
              </a>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── EpisodeCard ──────────────────────────────────────────────────────────────

function EpisodeCard({ match, onClick }: { match: Match; onClick: (m: Match) => void }) {
  const hasVideo = match.published && !!match.youtube_pl;
  const { date } = toLocal(match.deadline);

  return (
    <button
      onClick={() => hasVideo && onClick(match)}
      className="w-full text-left border rounded-sm p-3 transition-all duration-200 flex flex-col justify-center"
      style={{
        borderColor: hasVideo ? "rgba(255,215,0,0.35)" : "rgba(255,255,255,0.05)",
        background: hasVideo ? "#0d0d0d" : "#060606",
        cursor: hasVideo ? "pointer" : "default",
        minHeight: "140px",
      }}
    >
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <span style={{ fontSize: "3rem" }}>{match.t1.flag}</span>
        <span style={{ fontFamily: B, color: "#222", fontSize: "0.65rem" }}>VS</span>
        <span style={{ fontSize: "3rem" }}>{match.t2.flag}</span>
      </div>
      <p className="text-center leading-tight mb-2" style={{
        fontFamily: B, fontSize: "0.875rem", letterSpacing: "0.05em",
        color: hasVideo ? "#aaa" : "#333",
      }}>
        {match.t1.name} — {match.t2.name}
      </p>
      {hasVideo ? (
        <div className="flex justify-center">
          <span className="text-[8px] tracking-widest px-1.5 py-0.5 pulse-gold"
            style={{ fontFamily: B, background: "#FFD700", color: "#000" }}>
            ▶ NOWY
          </span>
        </div>
      ) : (
        <p className="text-center text-xs tracking-widest" style={{ fontFamily: B, color: "#222" }}>
          {date}
        </p>
      )}
    </button>
  );
}

// ─── EpisodeModal ─────────────────────────────────────────────────────────────

function EpisodeModal({ match: initialMatch, allMatches, onClose }: {
  match: Match; allMatches: Match[]; onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialMatch);
  const ytId = extractYtId(current.youtube_pl) ?? extractYtId(current.youtube_en);
  const { date: curDate, time: curTime } = toLocal(current.deadline);

  const published = allMatches.filter((m) => m.published && m.youtube_pl);
  const currentIdx = published.findIndex((m) => m.id === current.id);
  const nextMatch = published[currentIdx + 1] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: "rgba(0,0,0,0.93)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="w-full md:max-w-2xl bg-[#0a0a0a] border border-[#FFD700]/20 rounded-t-xl md:rounded-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#111]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-widest px-2 py-0.5"
              style={{ fontFamily: B, background: "#FFD700", color: "#000" }}>
              GRUPA {current.group}
            </span>
            <span style={{ fontFamily: B, fontSize: "0.75rem", color: "#444" }}>
              {curDate} · {curTime}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#444] hover:text-[#FFD700] transition-colors"
            style={{ fontFamily: B, fontSize: "1.1rem" }}>✕</button>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-center gap-8 py-4 px-5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl">{current.t1.flag}</span>
            <span style={{ fontFamily: B, color: "#f5f5f5", fontSize: "1rem" }}>{current.t1.name}</span>
          </div>
          <span style={{ fontFamily: B, fontSize: "1.4rem", color: "#FFD700" }}>VS</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl">{current.t2.flag}</span>
            <span style={{ fontFamily: B, color: "#f5f5f5", fontSize: "1rem" }}>{current.t2.name}</span>
          </div>
        </div>

        {/* Video */}
        {ytId ? (
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media" allowFullScreen
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-40" style={{ background: "#050505" }}>
            <p style={{ fontFamily: B, color: "#222", letterSpacing: "0.2em" }}>BRAK WIDEO</p>
          </div>
        )}

        {/* H2H */}
        {current.h2h && (
          <div className="px-5 py-4 border-t border-[#111]">
            <p className="text-[8px] tracking-widest mb-2" style={{ fontFamily: B, color: "#444" }}>
              HISTORIA STARĆ H2H
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: B, color: "#FFD700", fontSize: "1.05rem" }}>
                {current.h2h.balance}
              </span>
              <span className="text-[10px] tracking-wide" style={{ fontFamily: B, color: "#444" }}>
                {current.h2h.key_fact}
              </span>
            </div>
            {(current.h2h.t1_wins + current.h2h.draws + current.h2h.t2_wins) > 0 && (
              <>
                <div className="flex h-1.5 mt-3 rounded-sm overflow-hidden gap-px">
                  {current.h2h.t1_wins > 0 && (
                    <div className="h-full" style={{ flex: current.h2h.t1_wins, background: "#FFD700" }} />
                  )}
                  {current.h2h.draws > 0 && (
                    <div className="h-full" style={{ flex: current.h2h.draws, background: "#333" }} />
                  )}
                  {current.h2h.t2_wins > 0 && (
                    <div className="h-full" style={{ flex: current.h2h.t2_wins, background: "#777" }} />
                  )}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[8px]" style={{ fontFamily: B, color: "#444" }}>{current.t1.name}</span>
                  <span className="text-[8px]" style={{ fontFamily: B, color: "#444" }}>{current.t2.name}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Next episode */}
        {nextMatch && (
          <div className="px-5 pb-5">
            <button
              onClick={() => setCurrent(nextMatch)}
              className="w-full flex items-center justify-between border border-[#FFD700]/15 px-4 py-3 hover:border-[#FFD700]/40 transition-colors"
            >
              <span className="text-xs tracking-widest" style={{ fontFamily: B, color: "#444" }}>
                NASTĘPNY ODCINEK
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{nextMatch.t1.flag}</span>
                <span style={{ fontFamily: B, color: "#FFD700", fontSize: "0.7rem" }}>VS</span>
                <span className="text-lg">{nextMatch.t2.flag}</span>
                <span style={{ fontFamily: B, color: "#FFD700" }}>→</span>
              </div>
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function Dashboard({ nick, nickSaved, userRank, todayCount }: {
  nick: string;
  nickSaved: boolean;
  userRank: UserRank | null;
  todayCount: number;
}) {
  const [myLeague, setMyLeague] = useState<{ id: string; name: string; rank: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!nick) { setMyLeague(null); return; }
    fetch(`/api/mundial/leagues?nick=${encodeURIComponent(nick)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMyLeague(data))
      .catch(() => {});
  }, [nick]);

  const createLeague = async () => {
    const name = leagueName.trim();
    if (!name || !nick) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/mundial/leagues/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick, name }),
      });
      if (res.ok) {
        const data = await res.json();
        await shareOrCopy(`Gram w lidze ${name} ⚽\nDołącz: mundial.liroy.pl/liga/${data.id}`);
        window.location.href = `/liga/${data.id}`;
      } else {
        const data = await res.json();
        setCreateError(data.error ?? "Błąd tworzenia ligi.");
      }
    } catch {
      setCreateError("Błąd połączenia.");
    } finally {
      setCreating(false);
    }
  };

  if (!nickSaved && todayCount === 0) return null;

  return (
    <section className="px-6 pb-6 max-w-lg mx-auto">
      {/* Stats tiles */}
      {nickSaved && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="border border-[#FFD700]/15 bg-[#0a0a0a] px-3 py-4 text-center rounded-sm">
            <p className="text-[8px] tracking-widest mb-1" style={{ fontFamily: B, color: "#444" }}>PUNKTY</p>
            <p style={{ fontFamily: B, fontSize: "1.8rem", color: "#FFD700", lineHeight: 1 }}>
              {userRank?.points ?? "—"}
            </p>
          </div>
          <div className="border border-[#FFD700]/15 bg-[#0a0a0a] px-3 py-4 text-center rounded-sm">
            <p className="text-[8px] tracking-widest mb-1" style={{ fontFamily: B, color: "#444" }}>RANKING</p>
            <p style={{ fontFamily: B, fontSize: "1.8rem", color: userRank ? "#fff" : "#2a2a2a", lineHeight: 1 }}>
              {userRank ? `#${userRank.position}` : "—"}
            </p>
          </div>
          <div
            className="border border-[#FFD700]/15 bg-[#0a0a0a] px-3 py-4 text-center rounded-sm overflow-hidden"
            style={{ cursor: myLeague ? "pointer" : "default" }}
            onClick={() => myLeague && (window.location.href = `/liga/${myLeague.id}`)}
          >
            <p className="text-[8px] tracking-widest mb-1" style={{ fontFamily: B, color: "#444" }}>LIGA</p>
            {myLeague ? (
              <>
                <p className="truncate" style={{ fontFamily: B, fontSize: "0.65rem", color: "#FFD700", lineHeight: 1.3 }}>
                  {myLeague.name}
                </p>
                <p style={{ fontFamily: B, fontSize: "1.1rem", color: "#fff", lineHeight: 1 }}>
                  #{myLeague.rank}
                </p>
              </>
            ) : (
              <p style={{ fontFamily: B, fontSize: "1.8rem", color: "#2a2a2a", lineHeight: 1 }}>—</p>
            )}
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex gap-2">
        {todayCount > 0 && (
          <button
            onClick={() => document.getElementById("mecze")?.scrollIntoView({ behavior: "smooth" })}
            className="flex-1 py-3 px-4 min-h-[44px] border border-[#FFD700]/25 hover:border-[#FFD700]/55 transition-colors text-left"
          >
            <span className="block text-[8px] tracking-widest mb-0.5" style={{ fontFamily: B, color: "#444" }}>DZIŚ</span>
            <span style={{ fontFamily: B, fontSize: "0.85rem", color: "#FFD700" }}>
              {todayCount} {todayCount === 1 ? "MECZ" : "MECZÓW"} — TYPUJ TERAZ →
            </span>
          </button>
        )}
        {nickSaved && (
          <button
            onClick={() => { setShowCreate((v) => !v); setCreateError(""); }}
            className="py-3 px-5 min-h-[44px] flex items-center border border-[#FFD700]/15 hover:border-[#FFD700]/45 transition-colors text-[10px] tracking-widest whitespace-nowrap"
            style={{ fontFamily: B, color: showCreate ? "#FFD700" : "#555" }}
          >
            ZAŁÓŻ LIGĘ
          </button>
        )}
      </div>

      {/* Create league form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
          >
            <div className="flex gap-2 mt-2 border border-[#FFD700]/15 bg-[#0a0a0a] p-4 rounded-sm">
              <input
                type="text" maxLength={40} value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createLeague()}
                placeholder="Nazwa ligi"
                autoFocus
                className="flex-1 bg-[#111] border border-[#333] px-4 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#FFD700]/50"
                style={{ fontFamily: B }}
              />
              <button
                onClick={createLeague} disabled={creating}
                className="px-5 py-2 text-black text-xs tracking-widest disabled:opacity-50"
                style={{ fontFamily: B, background: "#FFD700" }}
              >
                {creating ? "..." : "UTWÓRZ"}
              </button>
            </div>
            {createError && (
              <p className="text-red-500 text-[10px] mt-1" style={{ fontFamily: B }}>{createError}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MundialPage() {
  const [nick, setNick] = useState("");
  const [nickSaved, setNickSaved] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"DZIŚ" | "NADCHODZĄCE" | "ZAKOŃCZONE">("DZIŚ");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [authState, setAuthState] = useState<"idle" | "checking" | "pin_register" | "pin_login" | "pin_claim">("idle");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingNick, setPendingNick] = useState("");

  const [notification, setNotification] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [reminderChecked, setReminderChecked] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderDone, setReminderDone] = useState(false);
  const [reminderError, setReminderError] = useState("");

  const fetchRanking = async (overrideNick?: string) => {
    try {
      const n = overrideNick !== undefined ? overrideNick : nick;
      const q = n ? `&nick=${encodeURIComponent(n)}` : "";
      const res = await fetch(`/api/vote?${q}`);
      if (res.ok) {
        const data = await res.json();
        setRanking(data.ranking ?? []);
        setRankingTotal(data.total ?? 0);
        setUserRank(data.userRank ?? null);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    // Resolve time-dependent state after hydration to avoid SSR mismatch.
    // The page is statically pre-rendered at deploy time; new Date() in initializers
    // would differ between build time and visit time → hydration error → state reset.
    setMounted(true);
    const currentNow = new Date();
    setNow(currentNow);
    const { todayUpcoming: td, active: ac, upcoming: up } = categorize(MATCHES, currentNow);
    if (!(td.length > 0 || ac.length > 0)) {
      setActiveTab(up.length > 0 ? "NADCHODZĄCE" : "ZAKOŃCZONE");
    }
    if (up.length > 0) setExpandedDates(new Set([cestDay(up[0].deadline)]));

    const stored = localStorage.getItem("mundial:nick");
    if (stored) {
      setNick(stored);
      setNickSaved(true);
      fetchRanking(stored);
      fetch(`/api/mundial/notification?nick=${encodeURIComponent(stored)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.message) {
            setNotification(data.message);
            setTimeout(() => setNotification(""), 6000);
          }
          if (data?.showOnboarding) setShowOnboarding(true);
        })
        .catch(() => {});
    } else {
      fetchRanking("");
    }
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const saveNick = async () => {
    const t = nickInput.trim();
    if (!t) return;
    setAuthState("checking");
    try {
      const res = await fetch("/api/mundial/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: t, action: "check" }),
      });
      const data = await res.json();
      setPendingNick(t);
      if (data.exists) {
        setAuthState("pin_login");
      } else if (data.hasRanking) {
        setAuthState("pin_claim");
      } else {
        setAuthState("pin_register");
      }
    } catch {
      setAuthState("idle");
    }
  };

  const submitPin = async () => {
    if (!/^\d{4}$/.test(pinInput)) { setPinError("PIN musi mieć dokładnie 4 cyfry"); return; }
    setPinError("");
    const action = (authState === "pin_register" || authState === "pin_claim") ? "register" : "login";
    try {
      const res = await fetch("/api/mundial/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: pendingNick, pin: pinInput, action }),
      });
      if (res.ok) {
        localStorage.setItem("mundial:nick", pendingNick);
        localStorage.setItem("mundial:pin", pinInput);
        setNick(pendingNick);
        setNickSaved(true);
        setAuthState("idle");
        setPinInput("");
        fetchRanking(pendingNick);
        fetch(`/api/mundial/notification?nick=${encodeURIComponent(pendingNick)}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            console.log("[onboarding] notification response:", data);
            console.log("[onboarding] showOnboarding value:", data?.showOnboarding);
            if (data?.showOnboarding) {
              console.log("[onboarding] setting showOnboarding to true");
              setShowOnboarding(true);
            }
          })
          .catch((err) => { console.log("[onboarding] notification fetch error:", err); });
      } else {
        const data = await res.json();
        setPinError(res.status === 401 ? "Błędny PIN. Spróbuj ponownie." : (data.error ?? "Błąd. Spróbuj ponownie."));
      }
    } catch {
      setPinError("Błąd połączenia. Spróbuj ponownie.");
    }
  };

  const subscribeReminder = async () => {
    const email = reminderEmail.trim();
    if (!email) return;
    setReminderSubmitting(true);
    setReminderError("");
    try {
      const res = await fetch("/api/mundial/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setReminderDone(true);
      } else {
        const data = await res.json();
        setReminderError(data.error ?? "Błąd zapisu.");
      }
    } catch {
      setReminderError("Błąd połączenia.");
    } finally {
      setReminderSubmitting(false);
    }
  };

  const { active, todayUpcoming, upcoming, finished } = useMemo(() => categorize(MATCHES, now), [now]);

  const upcomingByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of upcoming) {
      const key = cestDay(m.deadline);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()]
      .map(([key, matches]) => ({ key, label: formatGroupDate(key), matches }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [upcoming]);

  const nextMatch = useMemo(() => {
    return MATCHES.filter((m) => new Date(m.deadline) > now)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0] ?? null;
  }, [now]);


  const publishedCount = MATCHES.filter((m) => m.published).length;

  return (
    <main style={{ background: "#000", minHeight: "100vh" }}>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,#FFD700 2px,#FFD700 3px)",
        }} />

        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-xs tracking-[0.5em] mb-2" style={{ fontFamily: B, color: "#FFD700" }}>
          SEZON 2026
        </motion.p>

        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{ fontFamily: B, fontSize: "clamp(3.5rem,12vw,7.5rem)", lineHeight: 0.9, color: "#fff" }}>
          H2H ARCHIVE
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-3 text-sm tracking-[0.2em] uppercase" style={{ fontFamily: B, color: "#666" }}>
          Mundial 2026 — Historia każdego starcia
        </motion.p>

        {/* Badges */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="inline-flex gap-5 mt-5 px-6 py-2 border border-[#FFD700]/15">
          {[["72", "PARY"], ["12", "GRUP"], ["48", "DRUŻYN"]].map(([n, l]) => (
            <div key={l} className="text-center">
              <span style={{ fontFamily: B, fontSize: "1.4rem", color: "#FFD700" }}>{n}</span>
              <span className="ml-1 text-[9px] tracking-widest" style={{ fontFamily: B, color: "#444" }}>{l}</span>
            </div>
          ))}
        </motion.div>

        {/* Countdown */}
        {nextMatch && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }} className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[9px] tracking-[0.4em]" style={{ fontFamily: B, color: "#444" }}>
              TYPOWANIE ZAMYKA SIĘ ZA
            </p>
            <Countdown target={new Date(nextMatch.deadline)} />
            <p className="text-[10px] tracking-widest" style={{ fontFamily: B, color: "#333" }}>
              {nextMatch.t1.flag} {nextMatch.t1.name} — {nextMatch.t2.name} {nextMatch.t2.flag}
            </p>
          </motion.div>
        )}

        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.5 }}
          className="mx-auto mt-10 h-px w-40" style={{ background: "#FFD700", transformOrigin: "center" }} />
      </section>

      {/* ── NICK ─────────────────────────────────────────────────────── */}
      <section className="px-6 pb-10 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {nickSaved ? (
            <motion.div key="saved" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between border border-[#FFD700]/15 bg-[#0a0a0a] px-5 py-3 rounded-sm">
              <span className="text-xs tracking-widest" style={{ fontFamily: B, color: "#444" }}>NICK:</span>
              <a href={`/gracz/${encodeURIComponent(nick)}`}
                className="text-base tracking-wide hover:underline"
                style={{ fontFamily: B, color: "#FFD700" }}>{nick}</a>
              <button onClick={() => { setNickSaved(false); setNickInput(nick); setAuthState("idle"); setPinInput(""); setPinError(""); }}
                className="text-[10px] tracking-widest underline" style={{ fontFamily: B, color: "#444" }}>
                ZMIEŃ
              </button>
            </motion.div>
          ) : authState === "pin_register" ? (
            <motion.div key="pin-reg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="border border-[#FFD700]/30 bg-[#0a0a0a] p-6 rounded-sm">
              <p className="text-xs tracking-[0.3em] mb-1 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
                USTAW PIN — ZAPAMIĘTAJ GO!
              </p>
              <p className="text-[10px] tracking-widest mb-4 text-center" style={{ fontFamily: B, color: "#555" }}>
                {pendingNick}
              </p>
              <div className="flex gap-2">
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onKeyDown={(e) => e.key === "Enter" && submitPin()}
                  placeholder="4 cyfry"
                  autoFocus
                  className="flex-1 bg-[#111] border border-[#333] px-4 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#FFD700]/50 tracking-[0.8em] text-center"
                  style={{ fontFamily: B }}
                />
                <button onClick={submitPin} className="px-6 py-2 text-black text-sm tracking-widest"
                  style={{ fontFamily: B, background: "#FFD700" }}>OK</button>
              </div>
              {pinError && <p className="text-red-500 text-xs text-center mt-2" style={{ fontFamily: B }}>{pinError}</p>}
              <button onClick={() => { setAuthState("idle"); setPinInput(""); setPinError(""); }}
                className="w-full mt-3 text-[10px] tracking-widest hover:text-[#FFD700] transition-colors"
                style={{ fontFamily: B, color: "#444" }}>← ZMIEŃ NICK</button>
            </motion.div>
          ) : authState === "pin_login" ? (
            <motion.div key="pin-log" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="border border-[#FFD700]/30 bg-[#0a0a0a] p-6 rounded-sm">
              <p className="text-xs tracking-[0.3em] mb-1 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
                WPISZ PIN
              </p>
              <p className="text-[10px] tracking-widest mb-4 text-center" style={{ fontFamily: B, color: "#555" }}>
                {pendingNick}
              </p>
              <div className="flex gap-2">
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onKeyDown={(e) => e.key === "Enter" && submitPin()}
                  placeholder="4 cyfry"
                  autoFocus
                  className="flex-1 bg-[#111] border border-[#333] px-4 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#FFD700]/50 tracking-[0.8em] text-center"
                  style={{ fontFamily: B }}
                />
                <button onClick={submitPin} className="px-6 py-2 text-black text-sm tracking-widest"
                  style={{ fontFamily: B, background: "#FFD700" }}>OK</button>
              </div>
              {pinError && <p className="text-red-500 text-xs text-center mt-2" style={{ fontFamily: B }}>{pinError}</p>}
              <button onClick={() => { setAuthState("idle"); setPinInput(""); setPinError(""); }}
                className="w-full mt-3 text-[10px] tracking-widest hover:text-[#FFD700] transition-colors"
                style={{ fontFamily: B, color: "#444" }}>← ZMIEŃ NICK</button>
            </motion.div>
          ) : authState === "pin_claim" ? (
            <motion.div key="pin-claim" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="border border-[#FFD700]/30 bg-[#0a0a0a] p-6 rounded-sm">
              <p className="text-xs tracking-[0.3em] mb-1 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
                ZAREZERWUJ NICK
              </p>
              <p className="text-[10px] tracking-wide text-center leading-relaxed mb-4" style={{ fontFamily: B, color: "#555" }}>
                Nick &apos;{pendingNick}&apos; jest już w rankingu.{" "}
                Jeśli to Twój nick — ustaw PIN żeby go zabezpieczyć na przyszłość.
              </p>
              <div className="flex gap-2">
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onKeyDown={(e) => e.key === "Enter" && submitPin()}
                  placeholder="4 cyfry"
                  autoFocus
                  className="flex-1 bg-[#111] border border-[#333] px-4 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#FFD700]/50 tracking-[0.8em] text-center"
                  style={{ fontFamily: B }}
                />
                <button onClick={submitPin} className="px-6 py-2 text-black text-sm tracking-widest"
                  style={{ fontFamily: B, background: "#FFD700" }}>ZAREZERWUJ</button>
              </div>
              {pinError && <p className="text-red-500 text-xs text-center mt-2" style={{ fontFamily: B }}>{pinError}</p>}
              <button onClick={() => { setAuthState("idle"); setPinInput(""); setPinError(""); }}
                className="w-full mt-3 text-[10px] tracking-widest hover:text-[#FFD700] transition-colors"
                style={{ fontFamily: B, color: "#444" }}>← ZMIEŃ NICK</button>
            </motion.div>
          ) : (
            <motion.div key="nick-input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="border border-[#FFD700]/30 bg-[#0a0a0a] p-6 rounded-sm">
              <p className="text-xs tracking-[0.3em] mb-4 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
                TWÓJ NICK
              </p>
              <div className="flex gap-2">
                <input type="text" maxLength={24} value={nickInput}
                  onChange={(e) => setNickInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveNick()}
                  placeholder="np. LiroyFan99"
                  className="flex-1 bg-[#111] border border-[#333] px-4 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#FFD700]/50"
                  style={{ fontFamily: B }} />
                <button onClick={saveNick} disabled={authState === "checking"}
                  className="px-6 py-2 text-black text-sm tracking-widest disabled:opacity-50"
                  style={{ fontFamily: B, background: "#FFD700" }}>
                  {authState === "checking" ? "..." : "OK"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-4 text-center">
          <p style={{ fontFamily: B, fontSize: "0.65rem", color: "#333", letterSpacing: "0.05em" }}>
            ✅ Dokładny wynik = 3 pkt &nbsp;·&nbsp; ⚽ Trafiony zwycięzca = 1 pkt &nbsp;·&nbsp; ❌ Pudło = 0 pkt
          </p>
        </div>
      </section>

      <Dashboard nick={nick} nickSaved={nickSaved} userRank={userRank} todayCount={todayUpcoming.length} />

      {/* ── MECZE ────────────────────────────────────────────────────── */}
      <section id="mecze" className="px-6 pb-16 max-w-2xl mx-auto">

        {mounted ? (<>
        {/* Onboarding banner */}
        <AnimatePresence>
          {showOnboarding && (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="mb-6 border border-[#FFD700]/50 bg-[#0d0d00] px-6 py-5 rounded-sm text-center">
              <p className="text-xs tracking-[0.4em] mb-1" style={{ fontFamily: B, color: "#FFD700" }}>
                WITAJ W GRZE!
              </p>
              <p className="text-[11px] tracking-wide leading-relaxed mb-3" style={{ fontFamily: B, color: "#888" }}>
                Wytypuj swój pierwszy mecz poniżej.
              </p>
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                style={{ display: "inline-block", fontFamily: B, color: "#FFD700", fontSize: "1.2rem" }}>
                ↓
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab bar */}
        <div className="flex mb-6 border border-[#FFD700]/15 overflow-hidden rounded-sm">
          {(["DZIŚ", "NADCHODZĄCE", "ZAKOŃCZONE"] as const).map((tab, ti) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 text-[10px] tracking-widest transition-colors"
              style={{
                fontFamily: B,
                minHeight: "44px",
                background: activeTab === tab ? "#FFD700" : "#0a0a0a",
                color: activeTab === tab ? "#000" : "#444",
                borderRight: ti < 2 ? "1px solid rgba(255,215,0,0.1)" : undefined,
              }}>
              {tab}
            </button>
          ))}
        </div>

        {/* DZIŚ */}
        {activeTab === "DZIŚ" && (
          <div className="space-y-6">
            {todayUpcoming.length === 0 && active.length === 0 ? (
              <p className="text-center py-12 text-xs tracking-widest" style={{ fontFamily: B, color: "#2a2a2a" }}>
                BRAK MECZY DZIŚ
              </p>
            ) : (
              [...todayUpcoming, ...active].map((m) => (
                <MatchCard key={m.id} match={m} nick={nick} onFirstVote={() => setShowOnboarding(false)} />
              ))
            )}
          </div>
        )}

        {/* NADCHODZĄCE */}
        {activeTab === "NADCHODZĄCE" && (
          <div className="space-y-2">
            {upcomingByDate.length === 0 ? (
              <p className="text-center py-12 text-xs tracking-widest" style={{ fontFamily: B, color: "#2a2a2a" }}>
                BRAK NADCHODZĄCYCH MECZY
              </p>
            ) : upcomingByDate.map(({ key, label, matches }) => {
              const isOpen = expandedDates.has(key);
              return (
                <div key={key} className="border border-[#FFD700]/10 rounded-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedDates((prev) => {
                      const next = new Set(prev);
                      next.has(key) ? next.delete(key) : next.add(key);
                      return next;
                    })}
                    className="w-full flex items-center justify-between px-6 hover:bg-[#111] transition-colors"
                    style={{ minHeight: "44px" }}>
                    <span className="text-xs tracking-[0.3em]" style={{ fontFamily: B, color: isOpen ? "#FFD700" : "#555" }}>
                      {label}
                    </span>
                    <span className="text-[9px] tracking-widest" style={{ fontFamily: B, color: "#333" }}>
                      {matches.length} {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <div className="space-y-4 px-4 pt-2 pb-4">
                          {matches.map((m) => <MatchCard key={m.id} match={m} nick={nick} onFirstVote={() => setShowOnboarding(false)} />)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* ZAKOŃCZONE */}
        {activeTab === "ZAKOŃCZONE" && (
          <div className="space-y-6">
            {finished.length === 0 ? (
              <p className="text-center py-12 text-xs tracking-widest" style={{ fontFamily: B, color: "#2a2a2a" }}>
                BRAK ZAKOŃCZONYCH MECZY
              </p>
            ) : (
              [...finished].reverse().map((m) => (
                <MatchCard key={m.id} match={m} nick={nick} onFirstVote={() => setShowOnboarding(false)} />
              ))
            )}
          </div>
        )}
        </>) : null}
      </section>

      {/* ── TRACKER ──────────────────────────────────────────────────── */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="mb-10 text-center">
          <p className="text-xs tracking-[0.5em] mb-2" style={{ fontFamily: B, color: "#FFD700" }}>ARCHIWUM</p>
          <h2 style={{ fontFamily: B, fontSize: "clamp(2rem,5vw,3.5rem)", color: "#fff", lineHeight: 1 }}>
            72 ODCINKI H2H ARCHIVE
          </h2>
          <p className="mt-2 text-xs tracking-widest" style={{ fontFamily: B, color: "#333" }}>
            {publishedCount} / 72 opublikowanych
          </p>
          <div className="mx-auto mt-4 h-px w-28" style={{ background: "rgba(255,215,0,0.12)" }} />
        </div>

        <div className="space-y-8">
          {GROUPS.map((group) => {
            const gm = MATCHES.filter((m) => m.group === group);
            return (
              <div key={group}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 text-xs tracking-widest"
                    style={{ fontFamily: B, background: "#FFD700", color: "#000" }}>
                    GRUPA {group}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,215,0,0.08)" }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {gm.map((m) => (
                    <EpisodeCard key={m.id} match={m} onClick={setModalMatch} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── RANKING ──────────────────────────────────────────────────── */}
      <section id="ranking" className="px-6 pb-24 max-w-lg mx-auto">
        <div className="border border-[#FFD700]/15 bg-[#0a0a0a] rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#111] flex items-center justify-between">
            <p className="text-xs tracking-[0.4em]" style={{ fontFamily: B, color: "#FFD700" }}>
              RANKING — TOP 50
            </p>
            <button onClick={() => fetchRanking()}
              className="text-[10px] tracking-widest text-[#333] hover:text-[#FFD700] transition-colors"
              style={{ fontFamily: B }}>
              ODŚWIEŻ
            </button>
          </div>

          {ranking.length === 0 ? (
            <p className="text-center py-10 text-[#2a2a2a] text-sm tracking-widest" style={{ fontFamily: B }}>
              BRAK TYPOWAŃ
            </p>
          ) : (
            <ul className="divide-y divide-[#0f0f0f]">
              {ranking.map((entry, i) => (
                <motion.li key={entry.nick} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }} className="flex items-center gap-4 px-6 py-3">
                  <span className="w-6 text-center text-sm" style={{
                    fontFamily: B,
                    color: i === 0 ? "#FFD700" : i < 3 ? "#888" : "#2a2a2a",
                  }}>{i + 1}</span>
                  <a href={`/gracz/${encodeURIComponent(entry.nick)}`}
                    className="flex-1 text-sm tracking-wide hover:underline"
                    style={{
                      fontFamily: B,
                      color: entry.nick === nick ? "#FFD700" : "#f5f5f5",
                    }}>{entry.nick}</a>
                  {entry.accuracy !== null && (
                    <span className="text-[10px] tracking-widest" style={{ fontFamily: B, color: "#333" }}>
                      {entry.accuracy}%
                    </span>
                  )}
                  <span className="text-sm" style={{ fontFamily: B, color: "#444" }}>
                    {entry.points} pkt
                  </span>
                </motion.li>
              ))}
            </ul>
          )}

          {nickSaved && userRank && userRank.position > 50 && (
            <div className="px-6 py-3 border-t border-[#FFD700]/15 bg-[#0d0d0d]">
              <p className="text-xs tracking-widest" style={{ fontFamily: B, color: "#FFD700" }}>
                Twoja pozycja: #{userRank.position} — {userRank.points} pkt
              </p>
            </div>
          )}

          <div className="px-6 py-2 border-t border-[#0f0f0f]">
            <p className="text-[9px] tracking-widest" style={{ fontFamily: B, color: "#1a1a1a" }}>
              Łącznie graczy: {rankingTotal}
            </p>
          </div>
        </div>
      </section>

      {/* ── REMINDER ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-16 max-w-lg mx-auto">
        <div className="border border-[#FFD700]/10 bg-[#0a0a0a] px-6 py-5 rounded-sm">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={reminderChecked}
              onChange={(e) => { setReminderChecked(e.target.checked); setReminderError(""); }}
              className="mt-0.5 accent-[#FFD700]"
            />
            <span className="text-[11px] tracking-[0.15em] leading-relaxed"
              style={{ fontFamily: B, color: "#555" }}>
              PRZYPOMNIJ MI O TYPOWANIU — WPISZ EMAIL
            </span>
          </label>
          <AnimatePresence>
            {reminderChecked && !reminderDone && (
              <motion.div
                key="reminder-input"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 mt-4">
                  <input
                    type="email"
                    value={reminderEmail}
                    onChange={(e) => setReminderEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && subscribeReminder()}
                    placeholder="twoj@email.pl"
                    autoFocus
                    className="flex-1 bg-[#111] border border-[#333] px-4 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#FFD700]/50"
                    style={{ fontFamily: B }}
                  />
                  <button
                    onClick={subscribeReminder}
                    disabled={reminderSubmitting}
                    className="px-5 py-2 text-black text-xs tracking-widest disabled:opacity-50"
                    style={{ fontFamily: B, background: "#FFD700" }}
                  >
                    {reminderSubmitting ? "..." : "OK"}
                  </button>
                </div>
                {reminderError && (
                  <p className="text-red-500 text-[10px] mt-1" style={{ fontFamily: B }}>{reminderError}</p>
                )}
              </motion.div>
            )}
            {reminderDone && (
              <motion.p
                key="reminder-done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] tracking-widest mt-3"
                style={{ fontFamily: B, color: "#FFD700" }}
              >
                ✓ ZAPISANO — dostaniesz przypomnienie o 9:00 w dniu meczu.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="pb-12 text-center space-y-2">
        <p className="text-[8px] tracking-[0.4em]" style={{ fontFamily: B, color: "#1a1a1a" }}>
          H2H ARCHIVE © 2026 · LIROY.PL
        </p>
        <p style={{ fontFamily: B, fontSize: "0.65rem", color: "#333" }}>
          Część projektu H2H ARCHIVE |{" "}
          <a href="https://liroy.pl" target="_blank" rel="noopener noreferrer"
            className="hover:text-[#FFD700] transition-colors underline" style={{ color: "#444" }}>
            liroy.pl
          </a>
        </p>
      </footer>

      {/* ── Notification toast ───────────────────────────────────────── */}
      <AnimatePresence>
        {notification && (
          <motion.div
            key="notif"
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none"
          >
            <div
              className="border border-[#FFD700]/50 bg-[#0d0d00] px-6 py-3 text-center pointer-events-auto max-w-sm w-full"
              onClick={() => setNotification("")}
            >
              <p className="text-sm tracking-[0.15em]" style={{ fontFamily: B, color: "#FFD700" }}>
                {notification}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalMatch && (
          <EpisodeModal match={modalMatch} allMatches={MATCHES} onClose={() => setModalMatch(null)} />
        )}
      </AnimatePresence>
    </main>
  );
}
