"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface H2HEntry {
  year: number;
  score: string;
  competition: string;
  winner: string;
}

interface H2HData {
  total_matches: number;
  team1_wins: number;
  team2_wins: number;
  draws: number;
  goals_team1: number;
  goals_team2: number;
  first_ever: boolean;
  matches: H2HEntry[];
}

interface MatchData {
  group: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  h2h?: H2HData;
}

const B = "var(--font-bebas), 'Bebas Neue', sans-serif";

export default function TimeMachineModal({
  match,
  isOpen,
  onClose,
}: {
  match: MatchData;
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const h2h = match.h2h;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Positioning shell — bottom sheet on mobile, centered on desktop */}
          <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center pointer-events-none">
            <motion.div
              className="pointer-events-auto w-full md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl"
              style={{ background: "#0d0d0d", border: "1px solid #222" }}
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              {/* ── HEADER ─────────────────────────────────── */}
              <div className="relative px-5 pt-6 pb-4">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-xl leading-none transition-colors"
                  style={{ color: "#666" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#666")}
                  aria-label="Zamknij"
                >
                  ✕
                </button>
                <div className="flex gap-4 justify-center" style={{ fontSize: "3rem" }}>
                  {match.t1.flag} {match.t2.flag}
                </div>
                <p
                  className="text-xs text-center mt-3 uppercase"
                  style={{ fontFamily: B, color: "#FFD700", letterSpacing: "0.3em" }}
                >
                  H2H TIME MACHINE
                </p>
                <p className="text-lg font-bold text-white text-center mt-1">
                  {match.t1.name} vs {match.t2.name}
                </p>
              </div>

              {/* ── TREŚĆ ──────────────────────────────────── */}
              {!h2h ? (
                <div className="border-t border-[#222] px-5 py-6 text-center">
                  <p className="text-sm" style={{ color: "#666" }}>Brak danych H2H.</p>
                </div>
              ) : h2h.first_ever || h2h.total_matches === 0 ? (
                /* B) PIERWSZE SPOTKANIE */
                <div className="border-t border-[#222] px-5 py-10 text-center space-y-2">
                  <p
                    className="text-2xl font-black uppercase"
                    style={{ fontFamily: B, color: "#FFD700" }}
                  >
                    PIERWSZY ROZDZIAŁ HISTORII
                  </p>
                  <p className="text-sm" style={{ color: "#999" }}>
                    Zero przeszłości. Wszystko zaczyna się dziś.
                  </p>
                  <p className="text-xs" style={{ fontFamily: B, color: "#666" }}>
                    Grupa {match.group} | Mistrzostwa Świata 2026
                  </p>
                </div>
              ) : (
                <>
                  {/* C.1) BILANS */}
                  <div className="border-t border-[#222] px-5 py-5">
                    <div className="flex justify-around items-start">
                      <div className="text-center">
                        <div className="text-4xl font-black" style={{ fontFamily: B, color: "#FFD700" }}>
                          {h2h.team1_wins}
                        </div>
                        <div className="text-xs uppercase mt-1" style={{ color: "#999" }}>
                          {match.t1.flag} {match.t1.name}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-black" style={{ fontFamily: B, color: "#555" }}>
                          {h2h.draws}
                        </div>
                        <div className="text-xs uppercase mt-1" style={{ color: "#999" }}>Remisy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-black" style={{ fontFamily: B, color: "#FFD700" }}>
                          {h2h.team2_wins}
                        </div>
                        <div className="text-xs uppercase mt-1" style={{ color: "#999" }}>
                          {match.t2.flag} {match.t2.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* C.2) ŁĄCZNE GOLE */}
                  <div className="border-t border-[#222] px-5 py-3">
                    <p className="text-sm text-center" style={{ color: "#666" }}>
                      {h2h.goals_team1}:{h2h.goals_team2} — łączny dorobek bramkowy
                    </p>
                  </div>

                  {/* C.3) HISTORIA MECZÓW */}
                  {h2h.matches.length > 0 && (
                    <div className="border-t border-[#222] px-5 pt-3 pb-2">
                      <p
                        className="text-[9px] uppercase mb-2"
                        style={{ fontFamily: B, color: "#555", letterSpacing: "0.3em" }}
                      >
                        Historia spotkań
                      </p>
                      <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
                        {h2h.matches.map((m, i) => (
                          <div key={i} className="flex justify-between items-baseline py-2">
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span className="font-bold text-white text-sm shrink-0">{m.year}</span>
                              <span className="text-xs truncate" style={{ color: "#999" }}>
                                {m.competition}
                              </span>
                            </div>
                            <span className="font-bold text-sm ml-3 shrink-0" style={{ fontFamily: B, color: "#FFD700" }}>
                              {m.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── CTA ────────────────────────────────────── */}
              <div className="border-t border-[#222] px-5 py-4">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-bold text-black text-sm tracking-wider"
                  style={{ background: "#FFD700", fontFamily: B }}
                >
                  ✏️ WRÓĆ I TYPUJ
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
