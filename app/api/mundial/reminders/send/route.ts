import { Redis } from "@upstash/redis";
import { BrevoClient } from "@getbrevo/brevo";
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

  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    return Response.json({ error: "BREVO_API_KEY not set" }, { status: 500 });
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
  const textContent =
    `Hej!\n\nDziś grają:\n\n${matchLines}\n\nTypuj na: mundial.liroy.pl\n\n---\nAby wypisać się, odpisz na tego maila.`;

  const brevo = new BrevoClient({ apiKey: brevoKey });
  let sent = 0;

  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);
    await Promise.all(
      batch.map((to) =>
        brevo.transactionalEmails.sendTransacEmail({
          sender: { name: "Mundial 2026", email: "liroy@liroy.pl" },
          to: [{ email: to }],
          subject,
          textContent,
        })
      )
    );
    sent += batch.length;
  }

  return Response.json({ ok: true, sent });
}
