import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { NextRequest } from "next/server";
import matchesData from "@/data/matches.json";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

interface Match {
  deadline: string;
  t1: { name: string };
  t2: { name: string };
  time: string;
}

const MATCHES = matchesData.matches as Match[];

function isTodayCEST(deadline: string): boolean {
  const matchCest = new Date(new Date(deadline).getTime() + 2 * 3600_000);
  const nowCest = new Date(Date.now() + 2 * 3600_000);
  return (
    matchCest.getUTCFullYear() === nowCest.getUTCFullYear() &&
    matchCest.getUTCMonth() === nowCest.getUTCMonth() &&
    matchCest.getUTCDate() === nowCest.getUTCDate()
  );
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return Response.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const todayMatches = MATCHES
    .filter((m) => isTodayCEST(m.deadline))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  if (todayMatches.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no matches today" });
  }

  const emails = await redis.smembers<string[]>("reminders");
  if (emails.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no subscribers" });
  }

  const matchLines = todayMatches
    .map((m) => `  ${m.t1.name} — ${m.t2.name}, godz. ${m.time}`)
    .join("\n");

  const nowCest = new Date(Date.now() + 2 * 3600_000);
  const day = nowCest.getUTCDate();
  const months = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
  ];
  const dateStr = `${day} ${months[nowCest.getUTCMonth()]}`;

  const subject = `Mundial 2026 — mecze na dziś (${dateStr})`;
  const text =
    `Hej!\n\nDziś grają:\n\n${matchLines}\n\nTypuj na: mundial.liroy.pl\n\n---\nAby wypisać się, odpisz na tego maila.`;

  const resend = new Resend(resendKey);
  let sent = 0;

  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);
    await resend.batch.send(
      batch.map((to) => ({
        from: "Mundial 2026 <phantom@liroy.pl>",
        to,
        subject,
        text,
      }))
    );
    sent += batch.length;
  }

  return Response.json({ ok: true, sent });
}
