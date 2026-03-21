import { fetchArchiveSummaries, fetchLeaderboardData } from "./convex-server";

export async function getArchiveSummaries() {
  return fetchArchiveSummaries();
}

export async function getLeaderboardData() {
  return fetchLeaderboardData();
}

export async function getHomeStats() {
  const [summaries, leaderboard] = await Promise.all([
    fetchArchiveSummaries(),
    fetchLeaderboardData(),
  ]);

  return {
    totalRuns: summaries.length,
    totalIdeas: leaderboard.totals.ideas,
    totalCritiques: leaderboard.totals.critiques,
    totalModels: leaderboard.global.length,
  };
}
