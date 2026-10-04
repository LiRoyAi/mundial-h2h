// Mundial 2026 is over — the site is a read-only archive of the final ranking.
export const TOURNAMENT_CLOSED = true;

export function tournamentClosed() {
  return Response.json(
    { error: "Turniej zakończony — zapis jest wyłączony." },
    { status: 410 },
  );
}
