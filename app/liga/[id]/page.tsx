"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const B = "var(--font-bebas), 'Bebas Neue', sans-serif";

interface RankingEntry {
  nick: string;
  points: number;
}

interface League {
  id: string;
  name: string;
  owner: string;
  members: number;
  ranking: RankingEntry[];
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

  const [nickInput, setNickInput] = useState("");
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [pendingNick, setPendingNick] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

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
      } else {
        const data = await res.json();
        setPinError(res.status === 401 ? "Błędny PIN. Spróbuj ponownie." : (data.error ?? "Błąd."));
      }
    } catch {
      setPinError("Błąd połączenia.");
    }
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
        </motion.div>

      </section>
    </main>
  );
}
