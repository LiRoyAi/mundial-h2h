export interface VoteSummary {
  myVote: string;   // normalized "X:Y"
  pts: number | null;
}

export function getDna(votes: VoteSummary[], badges: string[]): string {
  if (votes.length === 0) return "Typowy typujący";

  const parsed = votes.map((v) => {
    const parts = v.myVote.split(":").map(Number);
    return parts.length === 2 && !parts.some(isNaN) ? [parts[0], parts[1]] as [number, number] : null;
  }).filter((x): x is [number, number] => x !== null);

  const avgGoals = parsed.length > 0
    ? parsed.reduce((s, [g1, g2]) => s + g1 + g2, 0) / parsed.length
    : 0;

  const resolved = votes.filter((v) => v.pts !== null);
  const exactRate = resolved.length > 0
    ? resolved.filter((v) => v.pts === 3).length / resolved.length
    : 0;

  const freq: Record<string, number> = {};
  for (const v of votes) freq[v.myVote] = (freq[v.myVote] ?? 0) + 1;
  const topVote = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  if (avgGoals > 3.0) return "Ryzykant ofensywny";
  if (topVote === "1:0" || topVote === "0:1") return "Beton 1:0";
  if (exactRate > 0.5) return "Snajper dokładnych wyników";
  if (badges.includes("underdog")) return "Król underdogów";
  if (avgGoals < 1.5) return "Zimny analityk";
  if (votes.length > 15) return "Mundialowy wariat";
  return "Typowy typujący";
}

function parseScore(s: string): { g1: number; g2: number } | null {
  const parts = s.replace("-", ":").split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { g1: parts[0], g2: parts[1] };
}

function winner(g1: number, g2: number): "t1" | "t2" | "draw" {
  if (g1 > g2) return "t1";
  if (g2 > g1) return "t2";
  return "draw";
}

export function buildVoteSummaries(
  matches: { id: string; deadline: string }[],
  voteValues: (string | null)[],
  resultValues: (string | null)[]
): VoteSummary[] {
  const items: (VoteSummary & { deadline: string })[] = [];
  for (let i = 0; i < matches.length; i++) {
    const raw = voteValues[i];
    if (!raw) continue;
    const myVote = raw.replace("-", ":");
    const result = resultValues[i];
    let pts: number | null = null;
    if (result) {
      const vp = parseScore(myVote);
      const rp = parseScore(result);
      if (vp && rp) {
        if (vp.g1 === rp.g1 && vp.g2 === rp.g2) pts = 3;
        else if (winner(vp.g1, vp.g2) === winner(rp.g1, rp.g2)) pts = 1;
        else pts = 0;
      }
    }
    items.push({ myVote, pts, deadline: matches[i].deadline });
  }
  // Sort newest-first to match the gracz API's vote order, ensuring
  // tie-breaking in getDna's frequency map is identical to the frontend.
  items.sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
  return items.map(({ myVote, pts }) => ({ myVote, pts }));
}
