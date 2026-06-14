import { NextRequest } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const W = 1080;
const H = 1920;
const GOLD = "#FFD700";
const BG = "#0a0a0a";
const FONT = "Arial, Helvetica, sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const HDR = `
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <defs>
    <pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#111" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="8" fill="${GOLD}"/>
  <text x="540" y="108" font-family="${FONT}" font-weight="900" font-size="42" fill="${GOLD}" text-anchor="middle" letter-spacing="10">H2H ARCHIVE</text>
  <text x="540" y="154" font-family="${FONT}" font-size="26" fill="#444" text-anchor="middle">mundial.liroy.pl</text>
  <line x1="80" y1="188" x2="1000" y2="188" stroke="#1a1a1a" stroke-width="1"/>
`;

const FTR = `
  <line x1="80" y1="1824" x2="1000" y2="1824" stroke="#1a1a1a" stroke-width="1"/>
  <text x="540" y="1864" font-family="${FONT}" font-size="30" fill="#444" text-anchor="middle">Typuj razem ze mna!</text>
  <text x="540" y="1908" font-family="${FONT}" font-weight="900" font-size="36" fill="${GOLD}" text-anchor="middle" letter-spacing="4">mundial.liroy.pl</text>
  <rect y="1912" width="${W}" height="8" fill="${GOLD}"/>
`;

function pickSvg(
  nick: string,
  score: string,
  t1: string,
  t2: string,
  f1: string,
  f2: string,
  gb: boolean,
): string {
  const scoreY = gb ? 740 : 820;
  const nickY = gb ? 940 : 970;
  const divY = gb ? 1010 : 1040;

  const gbBlock = gb
    ? `<rect x="290" y="${scoreY + 48}" width="500" height="68" rx="6" fill="#1a1400"/>
       <text x="540" y="${scoreY + 93}" font-family="${FONT}" font-weight="700" font-size="28" fill="${GOLD}" text-anchor="middle" letter-spacing="6">ZLOTA PILKA</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${HDR}
  <text x="240" y="400" font-size="110" text-anchor="middle">${esc(f1)}</text>
  <text x="240" y="462" font-family="${FONT}" font-weight="600" font-size="30" fill="#ccc" text-anchor="middle" textLength="400" lengthAdjust="spacingAndGlyphs">${esc(trunc(t1, 22))}</text>
  <text x="540" y="390" font-family="${FONT}" font-weight="900" font-size="36" fill="#333" text-anchor="middle">VS</text>
  <text x="840" y="400" font-size="110" text-anchor="middle">${esc(f2)}</text>
  <text x="840" y="462" font-family="${FONT}" font-weight="600" font-size="30" fill="#ccc" text-anchor="middle" textLength="400" lengthAdjust="spacingAndGlyphs">${esc(trunc(t2, 22))}</text>
  <text x="540" y="562" font-family="${FONT}" font-weight="700" font-size="28" fill="#444" text-anchor="middle" letter-spacing="14">MOJ TYP</text>
  <line x1="380" y1="584" x2="700" y2="584" stroke="#222" stroke-width="1"/>
  <text x="540" y="${scoreY}" font-family="${FONT}" font-weight="900" font-size="230" fill="${GOLD}" text-anchor="middle">${esc(score)}</text>
  ${gbBlock}
  <text x="540" y="${nickY}" font-family="${FONT}" font-weight="700" font-size="58" fill="#fff" text-anchor="middle">@${esc(trunc(nick, 20))}</text>
  <line x1="80" y1="${divY}" x2="1000" y2="${divY}" stroke="#1a1a1a" stroke-width="1"/>
  ${FTR}
</svg>`;
}

function hitSvg(nick: string, score: string, t1: string, t2: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${HDR}
  <text x="540" y="528" font-family="${FONT}" font-weight="900" font-size="200" fill="${GOLD}" text-anchor="middle">OK</text>
  <line x1="200" y1="570" x2="880" y2="570" stroke="#222" stroke-width="1"/>
  <text x="540" y="638" font-family="${FONT}" font-weight="900" font-size="68" fill="${GOLD}" text-anchor="middle" letter-spacing="4">TRAFIONY!</text>
  <text x="540" y="706" font-family="${FONT}" font-size="32" fill="#666" text-anchor="middle">${esc(trunc(t1, 18))} - ${esc(trunc(t2, 18))}</text>
  <text x="540" y="940" font-family="${FONT}" font-weight="900" font-size="220" fill="${GOLD}" text-anchor="middle">${esc(score)}</text>
  <line x1="300" y1="984" x2="780" y2="984" stroke="#222" stroke-width="1"/>
  <text x="540" y="1072" font-family="${FONT}" font-weight="700" font-size="60" fill="#fff" text-anchor="middle">@${esc(trunc(nick, 20))}</text>
  <rect x="390" y="1110" width="300" height="74" rx="6" fill="#1a1400"/>
  <text x="540" y="1158" font-family="${FONT}" font-weight="900" font-size="38" fill="${GOLD}" text-anchor="middle" letter-spacing="6">+3 PKT</text>
  ${FTR}
</svg>`;
}

function rankSvg(nick: string, rank: string, pts: string): string {
  const txt = `#${rank}`;
  const fs = txt.length <= 3 ? 320 : txt.length <= 4 ? 260 : 210;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${HDR}
  <text x="540" y="330" font-family="${FONT}" font-weight="700" font-size="30" fill="#444" text-anchor="middle" letter-spacing="14">RANKING</text>
  <text x="540" y="790" font-family="${FONT}" font-weight="900" font-size="${fs}" fill="${GOLD}" text-anchor="middle">${esc(txt)}</text>
  <line x1="200" y1="848" x2="880" y2="848" stroke="#222" stroke-width="1"/>
  <text x="540" y="966" font-family="${FONT}" font-weight="900" font-size="96" fill="#fff" text-anchor="middle">${esc(pts)} PKT</text>
  <text x="540" y="1058" font-family="${FONT}" font-weight="700" font-size="56" fill="#888" text-anchor="middle">@${esc(trunc(nick, 20))}</text>
  ${FTR}
</svg>`;
}

function badgeSvg(
  nick: string,
  badgeId: string,
  badgeName: string,
  pts: string,
  rank: string,
): string {
  const ICONS: Record<string, string> = {
    snajper: "S",
    hot_streak: "H",
    perfect_day: "P",
    underdog: "U",
    pierwsza_krew: "K",
    comeback_king: "C",
  };
  const letter = ICONS[badgeId] ?? "B";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${HDR}
  <circle cx="540" cy="500" r="180" fill="#1a1400" stroke="${GOLD}" stroke-width="3"/>
  <text x="540" y="568" font-family="${FONT}" font-weight="900" font-size="200" fill="${GOLD}" text-anchor="middle">${esc(letter)}</text>
  <text x="540" y="660" font-family="${FONT}" font-weight="700" font-size="34" fill="#666" text-anchor="middle" letter-spacing="10">ODZNAKA ZDOBYTA</text>
  <text x="540" y="758" font-family="${FONT}" font-weight="900" font-size="82" fill="${GOLD}" text-anchor="middle">${esc(badgeName.toUpperCase())}</text>
  <line x1="200" y1="800" x2="880" y2="800" stroke="#222" stroke-width="1"/>
  <text x="540" y="898" font-family="${FONT}" font-weight="700" font-size="62" fill="#fff" text-anchor="middle">@${esc(trunc(nick, 20))}</text>
  <text x="540" y="980" font-family="${FONT}" font-size="34" fill="#666" text-anchor="middle">#${esc(rank)} &#x2022; ${esc(pts)} pkt</text>
  ${FTR}
</svg>`;
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const type = p.get("type") ?? "pick";
  const nick = p.get("nick") ?? "anonim";

  let svg: string;

  if (type === "hit") {
    svg = hitSvg(nick, p.get("score") ?? "?:?", p.get("t1") ?? "", p.get("t2") ?? "");
  } else if (type === "rank") {
    svg = rankSvg(nick, p.get("rank") ?? "?", p.get("pts") ?? "0");
  } else if (type === "badge") {
    const badgeId = p.get("badgeId") ?? "";
    svg = badgeSvg(
      nick,
      badgeId,
      p.get("badgeName") ?? badgeId,
      p.get("pts") ?? "0",
      p.get("rank") ?? "?",
    );
  } else {
    svg = pickSvg(
      nick,
      p.get("score") ?? "?:?",
      p.get("t1") ?? "",
      p.get("t2") ?? "",
      p.get("f1") ?? "",
      p.get("f2") ?? "",
      p.get("gb") === "1",
    );
  }

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(Uint8Array.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
