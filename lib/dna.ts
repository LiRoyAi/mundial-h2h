export function calcDna(
  voteValues: (string | null)[],
  resultValues: (string | null)[],
  badges: string[]
): string {
  function parseScore(s: string): [number, number] | null {
    const parts = s.replace("-", ":").split(":").map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return [parts[0], parts[1]];
  }

  const parsedVotes: [number, number][] = [];
  for (const v of voteValues) {
    if (!v) continue;
    const p = parseScore(v);
    if (p) parsedVotes.push(p);
  }

  const votedCount = parsedVotes.length;
  if (votedCount === 0) return "Typowy typujący";

  const avgGoals = parsedVotes.reduce((s, [g1, g2]) => s + g1 + g2, 0) / votedCount;

  const freq: Record<string, number> = {};
  for (const v of voteValues) {
    if (v) {
      const norm = v.replace("-", ":");
      freq[norm] = (freq[norm] ?? 0) + 1;
    }
  }
  const topVote = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  let resolvedCount = 0;
  let exactCount = 0;
  for (let i = 0; i < voteValues.length; i++) {
    const vRaw = voteValues[i];
    const rRaw = resultValues[i];
    if (!vRaw || !rRaw) continue;
    const vp = parseScore(vRaw);
    const rp = parseScore(rRaw);
    if (!vp || !rp) continue;
    resolvedCount++;
    if (vp[0] === rp[0] && vp[1] === rp[1]) exactCount++;
  }
  const exactRate = resolvedCount > 0 ? exactCount / resolvedCount : 0;

  if (avgGoals > 3.0) return "Ryzykant ofensywny";
  if (topVote === "1:0" || topVote === "0:1") return "Beton 1:0";
  if (exactRate > 0.5) return "Snajper dokładnych wyników";
  if (badges.includes("underdog")) return "Król underdogów";
  if (avgGoals < 1.5) return "Zimny analityk";
  if (votedCount > 15) return "Mundialowy wariat";
  return "Typowy typujący";
}
