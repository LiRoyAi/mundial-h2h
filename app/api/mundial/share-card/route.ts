import { NextRequest } from "next/server";
import { createCanvas, CanvasRenderingContext2D } from "@napi-rs/canvas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1920;
const GOLD = "#FFD700";
const BG = "#0a0a0a";
const F = "Arial";

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
  ctx.font = `26px ${F}`;
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
  ctx.font = `30px ${F}`;
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

  // Flags (emoji — render if system font supports it, otherwise invisible)
  txt(ctx, f1, 240, 400, `110px ${F}`, "#fff");
  txt(ctx, f2, 840, 400, `110px ${F}`, "#fff");

  // Team names with maxWidth to compress long names
  ctx.fillStyle = "#ccc";
  ctx.font = `600 30px ${F}`;
  ctx.textAlign = "center";
  ctx.letterSpacing = "0px";
  ctx.fillText(trunc(t1, 22), 240, 462, 400);
  ctx.fillText(trunc(t2, 22), 840, 462, 400);

  txt(ctx, "VS", W / 2, 390, `900 36px ${F}`, "#333");
  txt(ctx, "MOJ TYP", W / 2, 562, `700 28px ${F}`, "#444", "center", "14px");
  hline(ctx, 380, 584, 700);

  const scoreY = gb ? 740 : 820;
  txt(ctx, score, W / 2, scoreY, `900 230px ${F}`, GOLD);

  if (gb) {
    ctx.fillStyle = "#1a1400";
    ctx.fillRect(290, scoreY + 48, 500, 68);
    txt(ctx, "ZLOTA PILKA", W / 2, scoreY + 93, `700 28px ${F}`, GOLD, "center", "6px");
  }

  const nickY = gb ? 940 : 970;
  txt(ctx, `@${trunc(nick, 20)}`, W / 2, nickY, `700 58px ${F}`, "#fff");

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, gb ? 1010 : 1040);
  ctx.lineTo(1000, gb ? 1010 : 1040);
  ctx.stroke();

  drawFooter(ctx);

  return canvas.toBuffer("image/png");
}

function hitCard(nick: string, score: string, t1: string, t2: string): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as Ctx;

  drawBg(ctx);
  drawHeader(ctx);

  txt(ctx, "OK", W / 2, 528, `900 200px ${F}`, GOLD);
  hline(ctx, 200, 570, 880);
  txt(ctx, "TRAFIONY!", W / 2, 638, `900 68px ${F}`, GOLD, "center", "4px");
  txt(ctx, `${trunc(t1, 18)} - ${trunc(t2, 18)}`, W / 2, 706, `32px ${F}`, "#666");
  txt(ctx, score, W / 2, 940, `900 220px ${F}`, GOLD);
  hline(ctx, 300, 984, 780);
  txt(ctx, `@${trunc(nick, 20)}`, W / 2, 1072, `700 60px ${F}`, "#fff");

  ctx.fillStyle = "#1a1400";
  ctx.fillRect(390, 1110, 300, 74);
  txt(ctx, "+3 PKT", W / 2, 1158, `900 38px ${F}`, GOLD, "center", "6px");

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

  txt(ctx, "RANKING", W / 2, 330, `700 30px ${F}`, "#444", "center", "14px");
  txt(ctx, rankText, W / 2, 790, `900 ${fs}px ${F}`, GOLD);
  hline(ctx, 200, 848, 880);
  txt(ctx, `${pts} PKT`, W / 2, 966, `900 96px ${F}`, "#fff");
  txt(ctx, `@${trunc(nick, 20)}`, W / 2, 1058, `700 56px ${F}`, "#888");

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

  // Circle badge
  ctx.beginPath();
  ctx.arc(W / 2, 500, 180, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1400";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();

  txt(ctx, letter, W / 2, 568, `900 200px ${F}`, GOLD);
  txt(ctx, "ODZNAKA ZDOBYTA", W / 2, 660, `700 34px ${F}`, "#666", "center", "10px");
  txt(ctx, badgeName.toUpperCase(), W / 2, 758, `900 82px ${F}`, GOLD);
  hline(ctx, 200, 800, 880);
  txt(ctx, `@${trunc(nick, 20)}`, W / 2, 898, `700 62px ${F}`, "#fff");
  txt(ctx, `#${rank} • ${pts} pkt`, W / 2, 980, `34px ${F}`, "#666");

  drawFooter(ctx);

  return canvas.toBuffer("image/png");
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
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
