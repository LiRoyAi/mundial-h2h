import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export async function POST(request: NextRequest) {
  let body: { nick?: string; pin?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { nick, pin, action } = body;
  if (!nick || !action) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const cleanNick = nick.trim().slice(0, 24);
  if (!cleanNick) {
    return Response.json({ error: "Invalid nick" }, { status: 400 });
  }

  const pinKey = `pin:${cleanNick}`;

  if (action === "check") {
    const [storedHash, hasRanking] = await Promise.all([
      redis.get<string>(pinKey),
      redis.exists(`ranking:${cleanNick}`),
    ]);
    return Response.json({ exists: !!storedHash, hasRanking: hasRanking > 0 });
  }

  if (action === "register") {
    if (!pin || !/^\d{4}$/.test(pin)) {
      return Response.json({ error: "PIN musi mieć 4 cyfry" }, { status: 400 });
    }
    const existing = await redis.get<string>(pinKey);
    if (existing) {
      return Response.json({ error: "Nick już zajęty" }, { status: 409 });
    }
    await redis.set(pinKey, hashPin(pin));
    return Response.json({ ok: true });
  }

  if (action === "login") {
    if (!pin || !/^\d{4}$/.test(pin)) {
      return Response.json({ error: "PIN musi mieć 4 cyfry" }, { status: 400 });
    }
    const storedHash = await redis.get<string>(pinKey);
    if (!storedHash) {
      return Response.json({ error: "Nick nie znaleziony" }, { status: 404 });
    }
    if (hashPin(pin) !== storedHash) {
      return Response.json({ error: "Błędny PIN" }, { status: 401 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
