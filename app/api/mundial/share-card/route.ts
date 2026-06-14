import { NextRequest } from "next/server";
import { createCanvas, GlobalFonts, CanvasRenderingContext2D } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fontsDir = path.join(process.cwd(), "public", "fonts");

// Lazy one-time font registration per Lambda instance.
// Using register(Buffer) instead of registerFromPath so Node.js fs reads the
// file — bypasses native binary path-resolution quirks on Vercel Linux.
let _fontsReady = false;
function ensureFonts() {
  if (_fontsReady) return;
  _fontsReady = true;
  const names = ["Roboto-Regular.ttf", "Roboto-Bold.ttf", "Roboto-Black.ttf"];
  for (const name of names) {
    try {
      const buf = fs.readFileSync(path.join(fontsDir, name));
      GlobalFonts.register(buf, "Roboto");
    } catch (e) {
      console.error(`SHARE_CARD failed to register ${name}:`, e);
    }
  }
  console.log("SHARE_CARD families after registration:", GlobalFonts.families.length);
}

const W = 1080;
const H = 1920;
const GOLD = "#FFD700";
const BG = "#0a0a0a";
const F = "Roboto";

type Ctx = CanvasRenderingContext2D;

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function drawBg(ctx: Ctx) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawHeader(ctx: Ctx) {
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, W, 8);

  ctx.fillStyle = GOLD;
  ctx.font = `900 42px ${F}`;
  ctx.textAlign = "center";
  ctx.letterSpacing = "10px";
  ctx.fillText("H2H ARCHIVE", W / 2, 108);

  ctx.fillStyle = "#444";
  ctx.font = `400 26px ${F}`;
  ctx.letterSpacing = "0px";
  ctx.fillText("mundial.liroy.pl", W / 2, 154);

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 188); ctx.lineTo(1000, 188); ctx.stroke();
}

function drawFooter(ctx: Ctx) {
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 1824); ctx.lineTo(1000, 1824); ctx.stroke();

  ctx.fillStyle = "#444";
  ctx.font = `400 30px ${F}`;
  ctx.textAlign = "center";
  ctx.letterSpacing = "0px";
  ctx.fillText("Typuj razem ze mna!", W / 2, 1864);

  ctx.fillStyle = GOLD;
  ctx.font = `900 36px ${F}`;
  ctx.letterSpacing = "4px";
  ctx.fillText("mundial.liroy.pl", W / 2, 1908);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 1912, W, 8);
}

function hline(ctx: Ctx, x1: number, y: number, x2: number) {
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}

function txt(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "center",
  spacing = "0px",
  maxW?: number,
) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.letterSpacing = spacing;
  if (maxW !== undefined) ctx.fillText(s, x, y, maxW);
  else ctx.fillText(s, x, y);
  ctx.letterSpacing = "0px";
}

function pickCard(
  nick: string,
  score: string,
  t1: string,
  t2: string,
  f1: string,
  f2: string,
  gb: boolean,
): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as Ctx;

  drawBg(ctx);
  drawHeader(ctx);

  // Country codes / team names — upper third
  txt(ctx, f1, 240, 440, `700 36px ${F}`, "#888");
  txt(ctx, f2, 840, 440, `700 36px ${F}`, "#888");
  txt(ctx, "VS", W / 2, 480, `900 40px ${F}`, "#333");
  ctx.fillStyle = "#ccc";
  ctx.font = `600 32px ${F}`;
  ctx.textAlign = "center";
  ctx.letterSpacing = "0px";
  ctx.fillText(trunc(t1, 20), 240, 534, 420);
  ctx.fillText(trunc(t2, 20), 840, 534, 420);

  // MOJ TYP label — mid
  txt(ctx, "MOJ TYP", W / 2, 690, `700 30px ${F}`, "#444", "center", "14px");
  hline(ctx, 380, 716, 700);

  // Score — vertical center of card (~960)
  const scoreY = gb ? 920 : 980;
  txt(ctx, score, W / 2, scoreY, `900 240px ${F}`, GOLD);

  // Golden ball badge
  if (gb) {
    ctx.fillStyle = "#1a1400";
    ctx.fillRect(290, scoreY + 46, 500, 70);
    txt(ctx, "ZLOTA PILKA", W / 2, scoreY + 93, `700 30px ${F}`, GOLD, "center", "6px");
  }

  // Nick — lower third
  const nickY = gb ? 1160 : 1200;
  txt(ctx, `@${trunc(nick, 20)}`, W / 2, nickY, `700 60px ${F}`, "#fff");

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  const divY = gb ? 1240 : 1280;
  ctx.beginPath(); ctx.moveTo(80, divY); ctx.lineTo(1000, divY); ctx.stroke();

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

function hitCard(nick: string, score: string, t1: string, t2: string): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as Ctx;

  drawBg(ctx);
  drawHeader(ctx);

  txt(ctx, "TRAFIONY!", W / 2, 500, `900 88px ${F}`, GOLD, "center", "4px");
  txt(ctx, `${trunc(t1, 18)} - ${trunc(t2, 18)}`, W / 2, 590, `400 32px ${F}`, "#666");
  hline(ctx, 200, 630, 880);

  txt(ctx, score, W / 2, 1010, `900 260px ${F}`, GOLD);
  hline(ctx, 300, 1060, 780);

  txt(ctx, `@${trunc(nick, 20)}`, W / 2, 1180, `700 60px ${F}`, "#fff");

  ctx.fillStyle = "#1a1400";
  ctx.fillRect(390, 1220, 300, 76);
  txt(ctx, "+3 PKT", W / 2, 1270, `900 40px ${F}`, GOLD, "center", "6px");

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

function rankCard(nick: string, rank: string, pts: string): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as Ctx;

  drawBg(ctx);
  drawHeader(ctx);

  const rankText = `#${rank}`;
  const fs = rankText.length <= 3 ? 320 : rankText.length <= 4 ? 260 : 210;

  txt(ctx, "RANKING", W / 2, 430, `700 30px ${F}`, "#444", "center", "14px");
  txt(ctx, rankText, W / 2, 960, `900 ${fs}px ${F}`, GOLD);
  hline(ctx, 200, 1020, 880);
  txt(ctx, `${pts} PKT`, W / 2, 1150, `900 96px ${F}`, "#fff");
  txt(ctx, `@${trunc(nick, 20)}`, W / 2, 1260, `700 56px ${F}`, "#888");

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

function badgeCard(
  nick: string,
  badgeId: string,
  badgeName: string,
  pts: string,
  rank: string,
): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as Ctx;

  drawBg(ctx);
  drawHeader(ctx);

  const LETTERS: Record<string, string> = {
    snajper: "S",
    hot_streak: "H",
    perfect_day: "P",
    underdog: "U",
    pierwsza_krew: "K",
    comeback_king: "C",
  };
  const letter = LETTERS[badgeId] ?? "B";

  ctx.beginPath();
  ctx.arc(W / 2, 560, 180, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1400";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();

  txt(ctx, letter, W / 2, 620, `900 220px ${F}`, GOLD);
  txt(ctx, "ODZNAKA ZDOBYTA", W / 2, 740, `700 34px ${F}`, "#666", "center", "10px");
  txt(ctx, badgeName.toUpperCase(), W / 2, 868, `900 88px ${F}`, GOLD);
  hline(ctx, 200, 920, 880);
  txt(ctx, `@${trunc(nick, 20)}`, W / 2, 1060, `700 62px ${F}`, "#fff");
  txt(ctx, `#${rank} • ${pts} pkt`, W / 2, 1170, `400 36px ${F}`, "#666");

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

export async function GET(request: NextRequest) {
  ensureFonts();

  const p = request.nextUrl.searchParams;

  // Diagnostic mode: ?diag=1 returns JSON with font-registration state
  if (p.get("diag") === "1") {
    const dirExists = fs.existsSync(fontsDir);
    return Response.json({
      cwd: process.cwd(),
      fontsDir,
      dirExists,
      files: dirExists ? fs.readdirSync(fontsDir) : [],
      families: GlobalFonts.families.map((f) => f.family),
    });
  }

  const type = p.get("type") ?? "pick";
  const nick = p.get("nick") ?? "anonim";

  let pngBuf: Buffer;

  if (type === "hit") {
    pngBuf = hitCard(nick, p.get("score") ?? "?:?", p.get("t1") ?? "", p.get("t2") ?? "");
  } else if (type === "rank") {
    pngBuf = rankCard(nick, p.get("rank") ?? "?", p.get("pts") ?? "0");
  } else if (type === "badge") {
    const badgeId = p.get("badgeId") ?? "";
    pngBuf = badgeCard(nick, badgeId, p.get("badgeName") ?? badgeId, p.get("pts") ?? "0", p.get("rank") ?? "?");
  } else {
    pngBuf = pickCard(
      nick,
      p.get("score") ?? "?:?",
      p.get("t1") ?? "",
      p.get("t2") ?? "",
      p.get("f1") ?? "",
      p.get("f2") ?? "",
      p.get("gb") === "1",
    );
  }

  return new Response(Uint8Array.from(pngBuf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
