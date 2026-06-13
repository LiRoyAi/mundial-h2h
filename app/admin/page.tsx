"use client";

import { useState, useEffect, useCallback } from "react";
import matchesData from "@/data/matches.json";

interface RawMatch {
  id: string;
  group: string;
  t1: { name: string; flag: string };
  t2: { name: string; flag: string };
  date: string;
  time: string;
  deadline: string;
}

const MATCHES = matchesData.matches as RawMatch[];

type Status = "upcoming" | "no-result" | "result-set";

interface MatchRow extends RawMatch {
  status: Status;
  result: string | null;
}

function getStatus(deadline: string, result: string | null): Status {
  if (result) return "result-set";
  if (new Date(deadline).getTime() > Date.now()) return "upcoming";
  return "no-result";
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<Record<string, { g1: string; g2: string }>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  const fetchResults = useCallback(async (adminKey: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mundial/result?adminKey=${encodeURIComponent(adminKey)}`);
      if (res.status === 401) { setAuthError("Wrong password."); setAuthed(false); return; }
      const data = await res.json();
      const results: Record<string, string> = data.results ?? {};
      setRows(
        MATCHES.map((m) => ({
          ...m,
          result: results[m.id] ?? null,
          status: getStatus(m.deadline, results[m.id] ?? null),
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async () => {
    setAuthError("");
    const res = await fetch(`/api/mundial/result?adminKey=${encodeURIComponent(keyInput)}`);
    if (res.status === 401) { setAuthError("Wrong password."); return; }
    setKey(keyInput);
    setAuthed(true);
    const data = await res.json();
    const results: Record<string, string> = data.results ?? {};
    setRows(
      MATCHES.map((m) => ({
        ...m,
        result: results[m.id] ?? null,
        status: getStatus(m.deadline, results[m.id] ?? null),
      }))
    );
  };

  const submitResult = async (matchId: string) => {
    const s = scores[matchId];
    if (!s) return;
    const g1 = parseInt(s.g1, 10);
    const g2 = parseInt(s.g2, 10);
    if (isNaN(g1) || isNaN(g2)) { setMessages((p) => ({ ...p, [matchId]: "Enter valid scores." })); return; }
    setSubmitting((p) => ({ ...p, [matchId]: true }));
    setMessages((p) => ({ ...p, [matchId]: "" }));
    try {
      const res = await fetch("/api/mundial/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, result: `${g1}:${g2}`, adminKey: key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((p) => ({ ...p, [matchId]: data.error ?? "Error." }));
      } else {
        setMessages((p) => ({ ...p, [matchId]: `✓ ${g1}:${g2} saved. ${data.playersScored} players scored.` }));
        await fetchResults(key);
      }
    } finally {
      setSubmitting((p) => ({ ...p, [matchId]: false }));
    }
  };

  const deleteResult = async (matchId: string) => {
    if (!confirm(`Delete result for ${matchId}? This reverses all points.`)) return;
    setSubmitting((p) => ({ ...p, [matchId]: true }));
    setMessages((p) => ({ ...p, [matchId]: "" }));
    try {
      const res = await fetch("/api/mundial/result", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, adminKey: key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((p) => ({ ...p, [matchId]: data.error ?? "Error." }));
      } else {
        setMessages((p) => ({ ...p, [matchId]: `↩ Reversed. ${data.playersAffected} players affected.` }));
        await fetchResults(key);
      }
    } finally {
      setSubmitting((p) => ({ ...p, [matchId]: false }));
    }
  };

  useEffect(() => {
    if (authed) fetchResults(key);
  }, [authed, key, fetchResults]);

  if (!authed) {
    return (
      <main style={{ padding: "40px", fontFamily: "monospace", maxWidth: 400 }}>
        <h1>Admin</h1>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            type="password"
            placeholder="ADMIN_KEY"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            style={{ flex: 1, padding: "6px 10px", fontSize: 14 }}
          />
          <button onClick={login} style={{ padding: "6px 14px" }}>Login</button>
        </div>
        {authError && <p style={{ color: "red", marginTop: 8 }}>{authError}</p>}
      </main>
    );
  }

  const byStatus: Record<Status, MatchRow[]> = { "no-result": [], "upcoming": [], "result-set": [] };
  for (const r of rows) byStatus[r.status].push(r);

  const sections: { label: string; status: Status }[] = [
    { label: "⚠ Needs result", status: "no-result" },
    { label: "Upcoming", status: "upcoming" },
    { label: "Done", status: "result-set" },
  ];

  return (
    <main style={{ padding: "24px 32px", fontFamily: "monospace", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Admin — Mundial 2026</h1>
        <button onClick={() => fetchResults(key)} disabled={loading} style={{ padding: "4px 10px" }}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {sections.map(({ label, status }) => {
        const list = byStatus[status];
        if (list.length === 0) return null;
        return (
          <section key={status} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 8 }}>
              {label} ({list.length})
            </h2>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#666" }}>
                  <th style={{ padding: "4px 8px", width: 90 }}>ID</th>
                  <th style={{ padding: "4px 8px" }}>Match</th>
                  <th style={{ padding: "4px 8px", width: 140 }}>Date</th>
                  <th style={{ padding: "4px 8px", width: 220 }}>Action</th>
                  <th style={{ padding: "4px 8px" }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const s = scores[m.id] ?? { g1: "", g2: "" };
                  const busy = submitting[m.id] ?? false;
                  return (
                    <tr key={m.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "6px 8px", color: "#888" }}>{m.id}</td>
                      <td style={{ padding: "6px 8px" }}>
                        {m.t1.flag} {m.t1.name} — {m.t2.name} {m.t2.flag}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#666" }}>
                        {m.date} {m.time}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {m.status === "result-set" ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong>{m.result}</strong>
                            <button
                              onClick={() => deleteResult(m.id)}
                              disabled={busy}
                              style={{ padding: "2px 8px", color: "#c00", cursor: "pointer" }}>
                              ✕ delete
                            </button>
                          </span>
                        ) : m.status === "no-result" ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number" min={0} max={99}
                              value={s.g1}
                              onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...s, g1: e.target.value } }))}
                              style={{ width: 44, padding: "2px 4px", textAlign: "center" }}
                              placeholder="0"
                            />
                            <span>:</span>
                            <input
                              type="number" min={0} max={99}
                              value={s.g2}
                              onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...s, g2: e.target.value } }))}
                              style={{ width: 44, padding: "2px 4px", textAlign: "center" }}
                              placeholder="0"
                            />
                            <button
                              onClick={() => submitResult(m.id)}
                              disabled={busy || s.g1 === "" || s.g2 === ""}
                              style={{ padding: "2px 10px", cursor: "pointer" }}>
                              {busy ? "…" : "Save"}
                            </button>
                          </span>
                        ) : (
                          <span style={{ color: "#aaa" }}>upcoming</span>
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", color: messages[m.id]?.startsWith("✓") ? "green" : messages[m.id]?.startsWith("↩") ? "#888" : "red" }}>
                        {messages[m.id] ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
