import { tournamentClosed } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export function GET() {
  return tournamentClosed();
}

export function POST() {
  return tournamentClosed();
}

export function DELETE() {
  return tournamentClosed();
}
