/**
 * Calls /api/mundial/backfill-challenge to award challenge bonuses retroactively.
 * Credentials stay on the server — this script only needs ADMIN_KEY and the base URL.
 *
 * Run:
 *   npx tsx scripts/backfill-challenge-bonus.ts
 *
 * Env vars (auto-loaded from .env.local):
 *   ADMIN_KEY          — admin secret
 *   BACKFILL_BASE_URL  — optional, defaults to http://localhost:3000
 */

import { readFileSync } from "fs";
import { join } from "path";
import * as readline from "readline";

// Load .env.local
try {
  const envFile = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found */ }

const BASE_URL = (process.env.BACKFILL_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ENDPOINT = `${BASE_URL}/api/mundial/backfill-challenge`;
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error("Error: ADMIN_KEY not set. Add it to .env.local or export it.");
  process.exit(1);
}

async function call(dryRun: boolean) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminKey: ADMIN_KEY, dryRun }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<{
    dryRun: boolean;
    pending?: number;
    applied?: number;
    skipped: number;
    log: string[];
    bonuses?: { nick: string; matchId: string }[];
  }>;
}

async function main() {
  console.log(`Endpoint: ${ENDPOINT}\n`);

  // Dry run
  console.log("=== DRY RUN ===");
  const preview = await call(true);

  if (preview.log.length === 0) {
    console.log("Nothing to do — no pending bonuses found.");
    return;
  }

  for (const line of preview.log) console.log(" ", line);
  console.log(`\nPending: ${preview.pending}  |  Already applied (skip): ${preview.skipped}`);

  // Confirm
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) =>
    rl.question("\nApply these changes? (yes/no): ", resolve)
  );
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted.");
    return;
  }

  // Apply
  console.log("\n=== APPLYING ===");
  const result = await call(false);
  for (const line of result.log) console.log(" ", line);
  console.log(`\nDone. ${result.applied} bonus${result.applied === 1 ? "" : "es"} awarded.`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
