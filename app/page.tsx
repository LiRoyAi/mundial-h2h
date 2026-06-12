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

function categorize(matches: Match[], now: Date) {
  const active: Match[] = [];
  const todayUpcoming: Match[] = [];
  const upcoming: Match[] = [];
  const finished: Match[] = [];
  const nowMs = now.getTime();

  for (const m of matches) {
    const dlMs = new Date(m.deadline).getTime();
    if (dlMs <= nowMs - 24 * 3600_000) {
      // Deadline passed more than 24h ago
      finished.push(m);
    } else if (dlMs <= nowMs + 2 * 3600_000) {
      // Within the active window: up to 2h before deadline to 24h after
      active.push(m);
    } else if (isMatchToday(m.deadline, now)) {
      // Voting window not yet open, but match is today
      todayUpcoming.push(m);
    } else {
      // Future match, not today
      upcoming.push(m);
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

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ target, short = false }: { target: Date; short?: boolean }) {
  const [tl, setTl] = useState(() => getTimeLeft(target));
  useEffect(() => {
    const id = setInterval(() => setTl(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!tl) return <span style={{ fontFamily: B, color: "#FFD700" }}>OTWARTO!</span>;

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

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({ match, nick, upcoming = false }: { match: Match; nick: string; upcoming?: boolean }) {
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [voted, setVoted] = useState(false);
  const [results, setResults] = useState<Results>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchResult, setMatchResult] = useState<string | null>(match.result ?? null);
  const isPast = new Date() > new Date(match.deadline);
  const windowOpenTime = useMemo(
    () => new Date(new Date(match.deadline).getTime() - 2 * 3600_000),
    [match.deadline]
  );
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
    } catch { setError("Błąd połączenia. Spróbuj ponownie."); }
    finally { setLoading(false); }
  };

  const myVote = voted ? localStorage.getItem(`voted:${match.id}`) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="relative border border-[#FFD700]/20 bg-[#0a0a0a] rounded-sm overflow-hidden"
      style={upcoming ? { opacity: 0.6 } : {}}
    >
      <div className="absolute top-0 left-0 px-3 py-1 text-xs tracking-widest"
        style={{ fontFamily: B, background: upcoming ? "#1a1a1a" : "#FFD700", color: upcoming ? "#555" : "#000" }}>
        GRUPA {match.group}
      </div>
      <div className="pt-10 pb-6 px-6">
        <p className="text-center text-[11px] tracking-widest mb-6"
          style={{ fontFamily: B, color: upcoming ? "#333" : "#FFD700" }}>
          {date} · {time}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-5xl">{match.t1.flag}</span>
            <span className="text-sm tracking-widest text-center" style={{ fontFamily: B, color: "#f5f5f5" }}>
              {match.t1.name}
            </span>
          </div>

          {upcoming ? (
            <div className="flex flex-col items-center gap-1 px-2 text-center min-w-[100px]">
              <span className="text-[9px] tracking-widest mb-1" style={{ fontFamily: B, color: "#333" }}>OTWARCIE ZA</span>
              <Countdown target={windowOpenTime} short />
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
            <span className="text-5xl">{match.t2.flag}</span>
            <span className="text-sm tracking-widest text-center" style={{ fontFamily: B, color: "#f5f5f5" }}>
              {match.t2.name}
            </span>
          </div>
        </div>

        {error && <p className="text-center text-red-500 text-xs mt-4 tracking-wide">{error}</p>}
        {isPast && !voted && !upcoming && (
          <p className="text-center text-xs mt-6 tracking-widest" style={{ fontFamily: B, color: "#333" }}>
            ⏰ Typowanie zamknięte
          </p>
        )}
        {!isPast && !voted && !upcoming && (
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
              exit={{ opacity: 0, height: 0 }} className="mt-6 space-y-2">
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

        {matchResult && (
          <div className="mt-5 py-3 text-center border border-[#FFD700]/25 rounded-sm">
            <p className="text-[9px] tracking-widest mb-1" style={{ fontFamily: B, color: "#444" }}>WYNIK MECZU</p>
            <span style={{ fontFamily: B, fontSize: "1.6rem", color: "#FFD700" }}>{matchResult}</span>
          </div>
        )}

        {voted && (
          <div className="mt-5 pt-4 border-t border-[#111]">
            <p className="text-center text-[8px] tracking-widest mb-3" style={{ fontFamily: B, color: "#333" }}>
              POLEĆ ZNAJOMYM — NIECH TEŻ TYPUJĄ!
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <a href="https://wa.me/?text=Typuj%C4%99%20wyniki%20Mundialu%202026%20z%20Liroyem!%20mundial.liroy.pl"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 border border-[#FFD700]/20 hover:border-[#FFD700]/50 transition-colors text-[9px]"
                style={{ fontFamily: B, color: "#666" }}>
                📱 WhatsApp
              </a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=mundial.liroy.pl"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 border border-[#FFD700]/20 hover:border-[#FFD700]/50 transition-colors text-[9px]"
                style={{ fontFamily: B, color: "#666" }}>
                📘 Facebook
              </a>
              <a href="https://twitter.com/intent/tweet?text=Typuj%C4%99%20wyniki%20Mundialu%202026!%20mundial.liroy.pl%20%23mundial2026"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 border border-[#FFD700]/20 hover:border-[#FFD700]/50 transition-colors text-[9px]"
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MundialPage() {
  const [nick, setNick] = useState("");
  const [nickSaved, setNickSaved] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [modalMatch, setModalMatch] = useState<Match | null>(null);

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
    const stored = localStorage.getItem("mundial:nick");
    if (stored) { setNick(stored); setNickSaved(true); fetchRanking(stored); }
    else fetchRanking("");
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const saveNick = () => {
    const t = nickInput.trim();
    if (!t) return;
    localStorage.setItem("mundial:nick", t);
    setNick(t); setNickSaved(true); fetchRanking(t);
  };

  const { active, todayUpcoming, upcoming, finished } = useMemo(() => categorize(MATCHES, now), [now]);

  const nextMatch = useMemo(() => {
    return MATCHES.filter((m) => new Date(m.deadline) > now)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0] ?? null;
  }, [now]);

  const nextWindowOpen = nextMatch
    ? new Date(new Date(nextMatch.deadline).getTime() - 2 * 3600_000)
    : null;

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
        {nextMatch && nextWindowOpen && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }} className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[9px] tracking-[0.4em]" style={{ fontFamily: B, color: "#444" }}>
              TYPOWANIE OTWIERA SIĘ ZA
            </p>
            <Countdown target={nextWindowOpen} />
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
          {!nickSaved ? (
            <motion.div key="in" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
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
                <button onClick={saveNick} className="px-6 py-2 text-black text-sm tracking-widest"
                  style={{ fontFamily: B, background: "#FFD700" }}>OK</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="saved" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between border border-[#FFD700]/15 bg-[#0a0a0a] px-5 py-3 rounded-sm">
              <span className="text-xs tracking-widest" style={{ fontFamily: B, color: "#444" }}>NICK:</span>
              <span className="text-base tracking-wide" style={{ fontFamily: B, color: "#FFD700" }}>{nick}</span>
              <button onClick={() => { setNickSaved(false); setNickInput(nick); }}
                className="text-[10px] tracking-widest underline" style={{ fontFamily: B, color: "#444" }}>
                ZMIEŃ
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-4 text-center">
          <p style={{ fontFamily: B, fontSize: "0.65rem", color: "#333", letterSpacing: "0.05em" }}>
            ✅ Dokładny wynik = 3 pkt &nbsp;·&nbsp; ⚽ Trafiony zwycięzca = 1 pkt &nbsp;·&nbsp; ❌ Pudło = 0 pkt
          </p>
        </div>
      </section>

      {/* ── MECZE ────────────────────────────────────────────────────── */}
      <section className="px-6 pb-16 max-w-2xl mx-auto">
        {todayUpcoming.length > 0 && (
          <div className="mb-12 border border-[#FFD700]/60 rounded-sm p-4">
            <p className="text-xs tracking-[0.4em] mb-6 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
              ⚽ MECZE DZIŚ
            </p>
            <div className="space-y-6">
              {todayUpcoming.map((m) => <MatchCard key={m.id} match={m} nick={nick} />)}
            </div>
          </div>
        )}

        {active.length > 0 && (
          <div className="mb-12">
            <p className="text-xs tracking-[0.4em] mb-6 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
              TYPUJ TERAZ
            </p>
            <div className="space-y-6">
              {active.map((m) => <MatchCard key={m.id} match={m} nick={nick} />)}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mb-12">
            <p className="text-xs tracking-[0.4em] mb-6 text-center"
              style={{ fontFamily: B, color: active.length > 0 ? "#444" : "#FFD700" }}>
              NADCHODZĄCE ({upcoming.length})
            </p>
            <div className="space-y-6">
              {(showAllUpcoming ? upcoming : upcoming.slice(0, 8)).map((m) =>
                <MatchCard key={m.id} match={m} nick={nick} upcoming />
              )}
            </div>
            {upcoming.length > 8 && (
              <div className="mt-4 text-center">
                <button onClick={() => setShowAllUpcoming((v) => !v)}
                  className="px-6 py-2 text-[10px] tracking-widest border border-[#FFD700]/20 hover:border-[#FFD700]/50 transition-colors"
                  style={{ fontFamily: B, color: "#555" }}>
                  {showAllUpcoming ? "ZWIŃ ▲" : `POKAŻ WIĘCEJ (${upcoming.length - 8}) ▼`}
                </button>
              </div>
            )}
          </div>
        )}

        {finished.length > 0 && (
          <div className="mb-4">
            <button onClick={() => setFinishedOpen((v) => !v)}
              className="w-full flex items-center justify-between mb-4 hover:opacity-70 transition-opacity">
              <span className="text-xs tracking-[0.4em]" style={{ fontFamily: B, color: "#2a2a2a" }}>
                ZAKOŃCZONE ({finished.length})
              </span>
              <span style={{ fontFamily: B, color: "#2a2a2a", fontSize: "0.6rem" }}>
                {finishedOpen ? "▲ ZWIŃ" : "▼ ROZWIŃ"}
              </span>
            </button>
            <AnimatePresence>
              {finishedOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
                  {finished.map((m) => <MatchCard key={m.id} match={m} nick={nick} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
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
      <section className="px-6 pb-24 max-w-lg mx-auto">
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
                  <span className="flex-1 text-sm tracking-wide" style={{
                    fontFamily: B,
                    color: entry.nick === nick ? "#FFD700" : "#f5f5f5",
                  }}>{entry.nick}</span>
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

      {/* ── Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalMatch && (
          <EpisodeModal match={modalMatch} allMatches={MATCHES} onClose={() => setModalMatch(null)} />
        )}
      </AnimatePresence>
    </main>
  );
}
