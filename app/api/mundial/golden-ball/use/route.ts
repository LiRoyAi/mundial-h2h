import { tournamentClosed } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export function POST() {
  return tournamentClosed();
}
