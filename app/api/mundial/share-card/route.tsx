import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fontsDir = path.join(process.cwd(), "public", "fonts");

function loadFont(name: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(fontsDir, name));
  return new Uint8Array(buf).buffer;
}

const GOLD = "#FFD700";
const BG = "#0a0a0a";

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ── Shared layout pieces ─────────────────────────────────────────────────────

function Header() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ height: 8, background: GOLD }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 0 28px" }}>
        <span style={{ fontSize: 44, fontWeight: 900, color: GOLD, letterSpacing: 10 }}>H2H ARCHIVE</span>
        <span style={{ fontSize: 26, color: "#444", marginTop: 10 }}>mundial.liroy.pl</span>
      </div>
      <div style={{ height: 1, background: "#1a1a1a", marginLeft: 80, marginRight: 80 }} />
    </div>
  );
}

function Footer() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ height: 1, background: "#1a1a1a", marginLeft: 80, marginRight: 80 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 0 40px" }}>
        <span style={{ fontSize: 30, color: "#444" }}>Typuj razem ze mna!</span>
        <span style={{ fontSize: 38, fontWeight: 900, color: GOLD, letterSpacing: 4, marginTop: 14 }}>mundial.liroy.pl</span>
      </div>
      <div style={{ height: 8, background: GOLD }} />
    </div>
  );
}

// ── Card variants ─────────────────────────────────────────────────────────────

function PickCard({ nick, score, t1, t2, f1, f2, gb }: {
  nick: string; score: string; t1: string; t2: string; f1: string; f2: string; gb: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1920, background: BG, fontFamily: "Roboto" }}>
      <Header />

      {/* Teams row */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: "80px 60px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 380 }}>
          <span style={{ fontSize: 38, fontWeight: 700, color: "#777" }}>{f1}</span>
          <span style={{ fontSize: 34, fontWeight: 600, color: "#ccc", marginTop: 18, textAlign: "center" }}>{trunc(t1, 20)}</span>
        </div>
        <span style={{ fontSize: 40, fontWeight: 900, color: "#333" }}>VS</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 380 }}>
          <span style={{ fontSize: 38, fontWeight: 700, color: "#777" }}>{f2}</span>
          <span style={{ fontSize: 34, fontWeight: 600, color: "#ccc", marginTop: 18, textAlign: "center" }}>{trunc(t2, 20)}</span>
        </div>
      </div>

      {/* MOJ TYP label */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 60 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: "#444", letterSpacing: 14 }}>MOJ TYP</span>
        <div style={{ height: 1, background: "#222", width: 320, marginTop: 18 }} />
      </div>

      {/* Score — vertically centered in remaining space */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
        <span style={{ fontSize: 260, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{score}</span>
        {gb && (
          <div style={{ display: "flex", background: "#1a1400", padding: "16px 60px", marginTop: 28 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: GOLD, letterSpacing: 6 }}>ZLOTA PILKA</span>
          </div>
        )}
      </div>

      {/* Nick */}
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 60 }}>
        <span style={{ fontSize: 60, fontWeight: 700, color: "#fff" }}>@{trunc(nick, 20)}</span>
      </div>

      <Footer />
    </div>
  );
}

function HitCard({ nick, score, t1, t2 }: { nick: string; score: string; t1: string; t2: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1920, background: BG, fontFamily: "Roboto" }}>
      <Header />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
        <span style={{ fontSize: 90, fontWeight: 900, color: GOLD, letterSpacing: 4 }}>TRAFIONY!</span>
        <span style={{ fontSize: 32, color: "#666", marginTop: 20 }}>{trunc(t1, 18)} – {trunc(t2, 18)}</span>
        <div style={{ height: 1, background: "#222", width: 680, marginTop: 40 }} />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 280, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{score}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 60 }}>
        <div style={{ height: 1, background: "#222", width: 480, marginBottom: 50 }} />
        <span style={{ fontSize: 62, fontWeight: 700, color: "#fff" }}>@{trunc(nick, 20)}</span>
        <div style={{ display: "flex", background: "#1a1400", padding: "18px 70px", marginTop: 30 }}>
          <span style={{ fontSize: 40, fontWeight: 900, color: GOLD, letterSpacing: 6 }}>+3 PKT</span>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function RankCard({ nick, rank, pts }: { nick: string; rank: string; pts: string }) {
  const rankText = `#${rank}`;
  const fs = rankText.length <= 3 ? 340 : rankText.length <= 4 ? 280 : 220;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1920, background: BG, fontFamily: "Roboto" }}>
      <Header />

      <div style={{ display: "flex", justifyContent: "center", marginTop: 100 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: "#444", letterSpacing: 14 }}>RANKING</span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: fs, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{rankText}</span>
        <div style={{ height: 1, background: "#222", width: 680, marginTop: 50, marginBottom: 50 }} />
        <span style={{ fontSize: 100, fontWeight: 900, color: "#fff" }}>{pts} PKT</span>
        <span style={{ fontSize: 58, fontWeight: 700, color: "#888", marginTop: 30 }}>@{trunc(nick, 20)}</span>
      </div>

      <Footer />
    </div>
  );
}

function BadgeCard({ nick, badgeId, badgeName, pts, rank }: {
  nick: string; badgeId: string; badgeName: string; pts: string; rank: string;
}) {
  const LETTERS: Record<string, string> = {
    snajper: "S", hot_streak: "H", perfect_day: "P",
    underdog: "U", pierwsza_krew: "K", comeback_king: "C",
  };
  const letter = LETTERS[badgeId] ?? "B";

  return (
    <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1920, background: BG, fontFamily: "Roboto" }}>
      <Header />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Circle badge */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 380, height: 380, borderRadius: "50%",
          background: "#1a1400", border: `3px solid ${GOLD}`,
        }}>
          <span style={{ fontSize: 220, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{letter}</span>
        </div>

        <span style={{ fontSize: 34, fontWeight: 700, color: "#666", letterSpacing: 10, marginTop: 50 }}>ODZNAKA ZDOBYTA</span>
        <span style={{ fontSize: 88, fontWeight: 900, color: GOLD, marginTop: 24 }}>{badgeName.toUpperCase()}</span>
        <div style={{ height: 1, background: "#222", width: 680, marginTop: 40, marginBottom: 50 }} />
        <span style={{ fontSize: 64, fontWeight: 700, color: "#fff" }}>@{trunc(nick, 20)}</span>
        <span style={{ fontSize: 36, color: "#666", marginTop: 24 }}>#{rank} • {pts} pkt</span>
      </div>

      <Footer />
    </div>
  );
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  // Diagnostic mode
  if (p.get("diag") === "1") {
    const dirExists = fs.existsSync(fontsDir);
    return Response.json({
      cwd: process.cwd(),
      fontsDir,
      dirExists,
      files: dirExists ? fs.readdirSync(fontsDir) : [],
      renderer: "next/og ImageResponse",
    });
  }

  const type = p.get("type") ?? "pick";
  const nick = p.get("nick") ?? "anonim";

  const fontRegular = loadFont("Roboto-Regular.woff");
  const fontBold = loadFont("Roboto-Bold.woff");
  const fontBlack = loadFont("Roboto-Black.woff");

  let element: React.ReactElement;

  if (type === "hit") {
    element = <HitCard nick={nick} score={p.get("score") ?? "?:?"} t1={p.get("t1") ?? ""} t2={p.get("t2") ?? ""} />;
  } else if (type === "rank") {
    element = <RankCard nick={nick} rank={p.get("rank") ?? "?"} pts={p.get("pts") ?? "0"} />;
  } else if (type === "badge") {
    const badgeId = p.get("badgeId") ?? "";
    element = <BadgeCard nick={nick} badgeId={badgeId} badgeName={p.get("badgeName") ?? badgeId} pts={p.get("pts") ?? "0"} rank={p.get("rank") ?? "?"} />;
  } else {
    element = <PickCard nick={nick} score={p.get("score") ?? "?:?"} t1={p.get("t1") ?? ""} t2={p.get("t2") ?? ""} f1={p.get("f1") ?? ""} f2={p.get("f2") ?? ""} gb={p.get("gb") === "1"} />;
  }

  return new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts: [
      { name: "Roboto", data: fontRegular, weight: 400, style: "normal" },
      { name: "Roboto", data: fontBold, weight: 700, style: "normal" },
      { name: "Roboto", data: fontBlack, weight: 900, style: "normal" },
    ],
  });
}
