"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const B = "var(--font-bebas), 'Bebas Neue', sans-serif";

const REACTIONS_LIST = [
  { id: "co_typujesz", label: "😂 Co ty typujesz?" },
  { id: "var",         label: "⚖️ VAR ci nie pomoże" },
  { id: "farciarz",    label: "🍀 Farciarz" },
  { id: "szacun",      label: "👊 Szacun za typ" },
  { id: "dogonie",     label: "🏃 Dzisiaj cię dogonię" },
  { id: "strzal",      label: "💥 To był strzał życia" },
];

interface RankingEntry {
  nick: string;
  points: number;
}

interface MemberVote {
  nick: string;
  vote: string | null;
  pts: number | null;
}

interface TodayMatch {
  id: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  time: string;
  result: string | null;
  memberVotes: MemberVote[];
}

interface TodaySection {
  matches: TodayMatch[];
  todayPoints: { nick: string; pts: number }[];
  bestOfDay: string | null;
  goldenBallMiss: { nick: string } | null;
}

interface League {
  id: string;
  name: string;
  owner: string;
  members: number;
  ranking: RankingEntry[];
  todaySection: TodaySection;
}

interface ReactionFeedItem {
  nick: string;
  reactionId: string;
  label: string;
  matchId: string;
  createdAt: string;
}

type AuthState = "idle" | "checking" | "pin_register" | "pin_login" | "pin_claim";

async function shareOrCopy(text: string): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
}

export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.id as string;

  const [league, setLeague] = useState<League | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [nick, setNick] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");

  const [nickInput, setNickInput] = useState("");
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [pendingNick, setPendingNick] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [reactions, setReactions] = useState<ReactionFeedItem[]>([]);
  const [sendingReaction, setSendingReaction] = useState<string | null>(null);
  const [flashedReaction, setFlashedReaction] = useState<string | null>(null);
  const [hasSentToday, setHasSentToday] = useState(false);
  const reactionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const todayMatchId = new Date().toISOString().slice(0, 10);

  const fetchReactions = useCallback(async (currentNick?: string) => {
    try {
      const res = await fetch(`/api/mundial/leagues/${leagueId}/reactions`);
      if (!res.ok) return;
      const data = await res.json();
      const list: ReactionFeedItem[] = data.reactions ?? [];
      setReactions(list);
      if (currentNick) {
        const alreadySent = list.some((r) => r.nick === currentNick && r.matchId === todayMatchId);
        if (alreadySent) setHasSentToday(true);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const fetchLeague = async (): Promise<League | null> => {
    try {
      const res = await fetch(`/api/mundial/leagues/${leagueId}`);
      if (!res.ok) { setFetchError("Liga nie istnieje."); return null; }
      const data: League = await res.json();
      setLeague(data);
      return data;
    } catch {
      setFetchError("Błąd połączenia.");
      return null;
    }
  };

  useEffect(() => {
    const storedNick = localStorage.getItem("mundial:nick") ?? "";
    if (storedNick) setNick(storedNick);
    fetchLeague().then((data) => {
      if (data && storedNick) {
        setIsMember(data.ranking.some((e) => e.nick === storedNick));
      }
    });
    fetchReactions(storedNick || undefined);
    reactionIntervalRef.current = setInterval(() => fetchReactions(storedNick || undefined), 30_000);
    return () => { if (reactionIntervalRef.current) clearInterval(reactionIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const joinLeague = async (joinNick: string) => {
    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch(`/api/mundial/leagues/${leagueId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: joinNick }),
      });
      if (res.ok || res.status === 409) {
        setIsMember(true);
        await fetchLeague();
        void shareOrCopy(`Gram w lidze ${league?.name ?? ""} ⚽\nDołącz: mundial.liroy.pl/liga/${leagueId}`);
      } else {
        const data = await res.json();
        setJoinError(data.error ?? "Błąd dołączania.");
      }
    } catch {
      setJoinError("Błąd połączenia.");
    } finally {
      setJoining(false);
    }
  };

  const checkNick = async () => {
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
      if (data.exists) setAuthState("pin_login");
      else if (data.hasRanking) setAuthState("pin_claim");
      else setAuthState("pin_register");
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
        setAuthState("idle");
        setPinInput("");
        await joinLeague(pendingNick);
        setWelcomeMessage(`Dołączyłeś do ligi ${league?.name ?? ""}. Wpisz swój pierwszy typ.`);
      } else {
        const data = await res.json();
        setPinError(res.status === 401 ? "Błędny PIN. Spróbuj ponownie." : (data.error ?? "Błąd."));
      }
    } catch {
      setPinError("Błąd połączenia.");
    }
  };

  const sendReaction = async (reactionId: string) => {
    if (!nick || !isMember || hasSentToday || sendingReaction) return;
    setSendingReaction(reactionId);
    try {
      const res = await fetch(`/api/mundial/leagues/${leagueId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick, matchId: todayMatchId, reactionId }),
      });
      if (res.ok) {
        const label = REACTIONS_LIST.find((r) => r.id === reactionId)?.label ?? "";
        const newItem: ReactionFeedItem = { nick, reactionId, label, matchId: todayMatchId, createdAt: new Date().toISOString() };
        setReactions((prev) => [newItem, ...prev].slice(0, 10));
        setHasSentToday(true);
        setFlashedReaction(reactionId);
        setTimeout(() => setFlashedReaction(null), 1000);
      }
    } catch { /* ignore */ }
    finally { setSendingReaction(null); }
  };

  const shareInvite = async () => {
    await shareOrCopy(`Gram w lidze ${league?.name ?? ""} ⚽\nDołącz: mundial.liroy.pl/liga/${leagueId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Error / loading ──────────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <main style={{ background: "#000", minHeight: "100vh" }} className="flex items-center justify-center px-6">
        <p style={{ fontFamily: B, color: "#FF4444", letterSpacing: "0.2em" }}>{fetchError}</p>
      </main>
    );
  }

  if (!league) {
    return (
      <main style={{ background: "#000", minHeight: "100vh" }} className="flex items-center justify-center">
        <p style={{ fontFamily: B, color: "#333", letterSpacing: "0.3em" }}>ŁADOWANIE...</p>
      </main>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────────

  return (
    <main style={{ background: "#000", minHeight: "100vh" }}>

      {/* Header */}
      <section className="pt-16 pb-10 px-6 text-center">
        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="text-xs tracking-[0.5em] mb-2" style={{ fontFamily: B, color: "#FFD700" }}>
          LIGA PRYWATNA
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
          style={{ fontFamily: B, fontSize: "clamp(2.5rem,8vw,5rem)", lineHeight: 0.95, color: "#fff" }}>
          {league.name}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-2 text-xs tracking-widest" style={{ fontFamily: B, color: "#444" }}>
          {league.members} {league.members === 1 ? "UCZESTNIK" : "UCZESTNIKÓW"}
        </motion.p>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-6 h-px w-28" style={{ background: "rgba(255,215,0,0.15)", transformOrigin: "center" }} />
      </section>

      <section className="px-6 pb-20 max-w-lg mx-auto space-y-4">

        {/* Welcome banner */}
        <AnimatePresence>
          {welcomeMessage && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="border border-[#FFD700]/40 bg-[#0d0d00] px-6 py-4 text-center"
            >
              <p className="text-xs tracking-[0.2em] leading-relaxed" style={{ fontFamily: B, color: "#FFD700" }}>
                {welcomeMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invite link */}
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={shareInvite}
          className="w-full py-3 text-xs tracking-[0.25em] border transition-colors"
          style={{
            fontFamily: B,
            borderColor: copied ? "rgba(255,215,0,0.5)" : "rgba(255,215,0,0.2)",
            color: copied ? "#FFD700" : "#555",
          }}
        >
          {copied ? "✓ ZAPROSZONO!" : "ZAPROŚ ZNAJOMYCH"}
        </motion.button>

        {/* Join / auth panel */}
        <AnimatePresence mode="wait">
          {!isMember && (
            !nick ? (
              authState === "pin_register" || authState === "pin_login" || authState === "pin_claim" ? (
                <motion.div key="pin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="border border-[#FFD700]/30 bg-[#0a0a0a] p-6 rounded-sm">
                  <p className="text-xs tracking-[0.3em] mb-1 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
                    {authState === "pin_register" ? "USTAW PIN — ZAPAMIĘTAJ GO!" :
                     authState === "pin_claim"    ? "ZAREZERWUJ NICK" : "WPISZ PIN"}
                  </p>
                  <p className="text-[10px] tracking-widest mb-3 text-center" style={{ fontFamily: B, color: "#555" }}>
                    {pendingNick}
                  </p>
                  {authState === "pin_claim" && (
                    <p className="text-[10px] tracking-wide text-center leading-relaxed mb-3" style={{ fontFamily: B, color: "#555" }}>
                      Nick jest już w rankingu. Ustaw PIN żeby go zabezpieczyć.
                    </p>
                  )}
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
                    <button onClick={submitPin}
                      className="px-6 py-2 text-black text-sm tracking-widest"
                      style={{ fontFamily: B, background: "#FFD700" }}>
                      {authState === "pin_claim" ? "ZAREZERWUJ" : "OK"}
                    </button>
                  </div>
                  {pinError && <p className="text-red-500 text-xs text-center mt-2" style={{ fontFamily: B }}>{pinError}</p>}
                  <button onClick={() => { setAuthState("idle"); setPinInput(""); setPinError(""); }}
                    className="w-full mt-3 text-[10px] tracking-widest hover:text-[#FFD700] transition-colors"
                    style={{ fontFamily: B, color: "#444" }}>← ZMIEŃ NICK</button>
                </motion.div>
              ) : (
                <motion.div key="nick-input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="border border-[#FFD700]/30 bg-[#0a0a0a] p-6 rounded-sm">
                  <p className="text-lg tracking-wide mb-1 text-center leading-tight" style={{ fontFamily: B, color: "#fff" }}>
                    {league.name}
                  </p>
                  <p className="text-[10px] tracking-[0.4em] mb-4 text-center" style={{ fontFamily: B, color: "#555" }}>
                    {league.members} {league.members === 1 ? "UCZESTNIK" : "UCZESTNIKÓW"}
                  </p>
                  <p className="text-xs tracking-[0.3em] mb-4 text-center" style={{ fontFamily: B, color: "#FFD700" }}>
                    DOŁĄCZ DO LIGI
                  </p>
                  <div className="flex gap-2">
                    <input type="text" maxLength={24} value={nickInput}
                      onChange={(e) => setNickInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && checkNick()}
                      placeholder="Twój nick"
                      className="flex-1 bg-[#111] border border-[#333] px-4 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#FFD700]/50"
                      style={{ fontFamily: B }}
                    />
                    <button onClick={checkNick} disabled={authState === "checking"}
                      className="px-6 py-2 text-black text-sm tracking-widest disabled:opacity-50"
                      style={{ fontFamily: B, background: "#FFD700" }}>
                      {authState === "checking" ? "..." : "DALEJ"}
                    </button>
                  </div>
                </motion.div>
              )
            ) : (
              <motion.div key="join-btn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => joinLeague(nick)} disabled={joining}
                  className="w-full py-4 text-black tracking-[0.25em] disabled:opacity-50"
                  style={{ fontFamily: B, fontSize: "1rem", background: "#FFD700" }}>
                  {joining ? "DOŁĄCZAM..." : `DOŁĄCZ JAKO ${nick}`}
                </motion.button>
                {joinError && <p className="text-red-500 text-xs text-center mt-2" style={{ fontFamily: B }}>{joinError}</p>}
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* DZIŚ W LIDZE */}
        {league.todaySection.matches.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="border border-[#FFD700]/20 bg-[#0a0a0a] rounded-sm overflow-hidden">

            <div className="px-6 py-4 border-b border-[#111]">
              <p className="text-xs tracking-[0.4em]" style={{ fontFamily: B, color: "#FFD700" }}>DZIŚ W LIDZE</p>
            </div>

            {/* Matches + member votes */}
            {league.todaySection.matches.map((m) => (
              <div key={m.id} className="border-b border-[#0f0f0f] last:border-b-0">
                {/* Match header */}
                <div className="px-6 pt-4 pb-2 flex items-center gap-2">
                  <span className="text-lg">{m.t1.flag}</span>
                  <span className="text-xs tracking-wide flex-1 truncate" style={{ fontFamily: B, color: "#aaa" }}>
                    {m.t1.name} — {m.t2.name}
                  </span>
                  <span className="text-lg">{m.t2.flag}</span>
                  <span className="text-[10px] tracking-widest ml-2 shrink-0" style={{ fontFamily: B, color: "#444" }}>
                    {m.time}
                  </span>
                  {m.result && (
                    <span className="text-sm tracking-widest ml-1 shrink-0 whitespace-nowrap" style={{ fontFamily: B, color: "#FFD700" }}>
                      {m.result}
                    </span>
                  )}
                </div>

                {/* Member votes */}
                <ul className="px-6 pb-3 space-y-1">
                  {m.memberVotes.map((mv) => {
                    const ptsColor = mv.pts === 3 ? "#22c55e" : mv.pts === 1 ? "#FFD700" : mv.pts === 0 ? "#444" : "#333";
                    const ptsLabel = mv.pts === 3 ? "+3" : mv.pts === 1 ? "+1" : mv.pts === 0 ? "0" : null;
                    return (
                      <li key={mv.nick} className="flex items-center gap-2 text-[11px]">
                        <a href={`/gracz/${encodeURIComponent(mv.nick)}`}
                          className="w-24 truncate hover:underline shrink-0"
                          style={{ fontFamily: B, color: mv.nick === nick ? "#FFD700" : "#666" }}>
                          {mv.nick}
                        </a>
                        {mv.vote ? (
                          <>
                            <span style={{ fontFamily: B, color: "#555" }}>{mv.vote}</span>
                            {m.result && (
                              <>
                                <span style={{ color: "#2a2a2a" }}>→</span>
                                <span style={{ fontFamily: B, color: "#444" }}>{m.result}</span>
                                <span className="ml-auto tracking-widest" style={{ fontFamily: B, color: ptsColor }}>
                                  {ptsLabel !== null ? `${ptsLabel} PKT` : ""}
                                </span>
                              </>
                            )}
                          </>
                        ) : (
                          <span style={{ fontFamily: B, color: "#2a2a2a" }}>—</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {/* Today points summary */}
            {league.todaySection.todayPoints.length > 0 && (
              <div className="border-t border-[#111] px-6 py-3">
                <p className="text-[9px] tracking-[0.4em] mb-2" style={{ fontFamily: B, color: "#444" }}>PKT DZIŚ</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {league.todaySection.todayPoints.map((e) => (
                    <span key={e.nick} className="text-xs tracking-wide" style={{ fontFamily: B, color: e.nick === league.todaySection.bestOfDay ? "#FFD700" : "#555" }}>
                      {e.nick} +{e.pts}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Best of day */}
            {league.todaySection.bestOfDay && (
              <div className="border-t border-[#FFD700]/10 bg-[#0d0d00] px-6 py-4 text-center">
                <p className="text-[9px] tracking-[0.4em] mb-1" style={{ fontFamily: B, color: "#555" }}>
                  ⭐ NAJLEPSZY TYP DNIA
                </p>
                <a href={`/gracz/${encodeURIComponent(league.todaySection.bestOfDay)}`}
                  className="text-xl tracking-widest hover:underline"
                  style={{ fontFamily: B, color: "#FFD700" }}>
                  {league.todaySection.bestOfDay}
                </a>
              </div>
            )}

            {/* Biggest gain of day */}
            {league.todaySection.todayPoints.length > 0 && (
              <div className="border-t border-[#FFD700]/10 bg-[#0d0d00] px-6 py-4 text-center">
                <p className="text-[9px] tracking-[0.4em] mb-1" style={{ fontFamily: B, color: "#555" }}>
                  📈 NAJWIĘKSZY AWANS DNIA
                </p>
                <a href={`/gracz/${encodeURIComponent(league.todaySection.todayPoints[0].nick)}`}
                  className="text-xl tracking-widest hover:underline block"
                  style={{ fontFamily: B, color: "#FFD700" }}>
                  {league.todaySection.todayPoints[0].nick}
                </a>
                <p className="text-[10px] tracking-widest mt-1" style={{ fontFamily: B, color: "#888" }}>
                  +{league.todaySection.todayPoints[0].pts} PKT DZIŚ
                </p>
              </div>
            )}

            {/* Golden ball miss */}
            {league.todaySection.goldenBallMiss && (
              <div className="border-t border-[#333]/60 bg-[#0d0000] px-6 py-4 text-center">
                <p className="text-[9px] tracking-[0.4em] mb-1" style={{ fontFamily: B, color: "#555" }}>
                  📉 NAJWIĘKSZA WPADKA DNIA
                </p>
                <a href={`/gracz/${encodeURIComponent(league.todaySection.goldenBallMiss.nick)}`}
                  className="text-xl tracking-widest hover:underline block"
                  style={{ fontFamily: B, color: "#ef4444" }}>
                  {league.todaySection.goldenBallMiss.nick}
                </a>
                <p className="text-[10px] tracking-widest mt-1" style={{ fontFamily: B, color: "#666" }}>
                  Złota Piłka nie trafiła
                </p>
              </div>
            )}

          </motion.div>
        )}

        {/* 💬 SZATNIA */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}
          className="border border-[#FFD700]/15 bg-[#0a0a0a] rounded-sm overflow-hidden">

          <div className="px-6 py-4 border-b border-[#111]">
            <p className="text-xs tracking-[0.4em]" style={{ fontFamily: B, color: "#FFD700" }}>💬 SZATNIA</p>
          </div>

          {/* Feed */}
          <div className="px-6 py-3 min-h-[56px]">
            {reactions.length === 0 ? (
              <p className="text-[10px] tracking-widest text-center py-2" style={{ fontFamily: B, color: "#2a2a2a" }}>
                BRAK REAKCJI — BĄDŹ PIERWSZY
              </p>
            ) : (
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {reactions.map((r, i) => (
                    <motion.li
                      key={`${r.nick}-${r.createdAt}`}
                      initial={i === 0 ? { opacity: 0, y: -6 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-baseline gap-2 text-[11px]"
                    >
                      <span className="shrink-0" style={{ fontFamily: B, color: r.nick === nick ? "#FFD700" : "#555" }}>
                        {r.nick}:
                      </span>
                      <span style={{ fontFamily: B, color: "#888" }}>{r.label}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          {/* Reaction buttons — members only */}
          {isMember && (
            <div className="border-t border-[#111] px-4 py-4">
              {hasSentToday ? (
                <p className="text-[9px] tracking-[0.3em] text-center" style={{ fontFamily: B, color: "#333" }}>
                  JUTRO MOŻESZ ZAREAGOWAĆ PONOWNIE
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {REACTIONS_LIST.map(({ id, label }) => {
                    const isFlashed = flashedReaction === id;
                    const isSending = sendingReaction === id;
                    return (
                      <motion.button
                        key={id}
                        onClick={() => sendReaction(id)}
                        disabled={!!sendingReaction}
                        whileTap={{ scale: 0.95 }}
                        className="px-2 py-2.5 text-left text-[9px] leading-tight tracking-wide border transition-colors disabled:opacity-40"
                        style={{
                          fontFamily: B,
                          borderColor: isFlashed ? "#FFD700" : "rgba(255,215,0,0.12)",
                          color: isFlashed ? "#000" : "#555",
                          background: isFlashed ? "#FFD700" : isSending ? "rgba(255,215,0,0.05)" : "transparent",
                        }}
                      >
                        {label}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Ranking */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
          className="border border-[#FFD700]/15 bg-[#0a0a0a] rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#111]">
            <p className="text-xs tracking-[0.4em]" style={{ fontFamily: B, color: "#FFD700" }}>
              RANKING LIGI
            </p>
          </div>
          {league.ranking.length === 0 ? (
            <p className="text-center py-10 text-sm tracking-widest" style={{ fontFamily: B, color: "#2a2a2a" }}>
              BRAK TYPOWAŃ
            </p>
          ) : (
            <ul className="divide-y divide-[#0f0f0f]">
              {league.ranking.map((entry, i) => (
                <motion.li key={entry.nick}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-6 py-3">
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
                  <span className="text-sm" style={{ fontFamily: B, color: "#444" }}>
                    {entry.points} pkt
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>

      </section>
    </main>
  );
}
