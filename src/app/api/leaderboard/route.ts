import { NextResponse } from "next/server";
import { listBenchmarkRuns } from "@/lib/storage";
import { getModelName } from "@/lib/models";
import { BenchmarkRun, LeaderboardEntry, LeaderboardData } from "@/types";

function buildLeaderboard(runs: BenchmarkRun[]): LeaderboardEntry[] {
  const stats = new Map<
    string,
    { totalRank: number; totalScore: number; wins: number; runCount: number }
  >();

  for (const run of runs) {
    if (run.finalRankings.length === 0) continue;

    // Aggregate final rankings across all judges for this run
    const modelScores = new Map<string, { totalRank: number; totalScore: number; judgeCount: number }>();

    for (const ranking of run.finalRankings) {
      for (const entry of ranking.rankings) {
        const existing = modelScores.get(entry.modelId) || { totalRank: 0, totalScore: 0, judgeCount: 0 };
        existing.totalRank += entry.rank;
        existing.totalScore += entry.score;
        existing.judgeCount += 1;
        modelScores.set(entry.modelId, existing);
      }
    }

    // Find the winner of this run (lowest average rank)
    let winnerId = "";
    let bestAvgRank = Infinity;
    for (const [modelId, data] of modelScores) {
      const avgRank = data.judgeCount > 0 ? data.totalRank / data.judgeCount : Infinity;
      if (avgRank < bestAvgRank) {
        bestAvgRank = avgRank;
        winnerId = modelId;
      }
    }

    // Accumulate into global stats
    for (const [modelId, data] of modelScores) {
      const avgRank = data.judgeCount > 0 ? data.totalRank / data.judgeCount : 0;
      const avgScore = data.judgeCount > 0 ? data.totalScore / data.judgeCount : 0;

      const existing = stats.get(modelId) || { totalRank: 0, totalScore: 0, wins: 0, runCount: 0 };
      existing.totalRank += avgRank;
      existing.totalScore += avgScore;
      existing.runCount += 1;
      if (modelId === winnerId) existing.wins += 1;
      stats.set(modelId, existing);
    }
  }

  const entries: LeaderboardEntry[] = [];
  for (const [modelId, data] of stats) {
    entries.push({
      modelId,
      modelName: getModelName(modelId),
      wins: data.wins,
      totalRuns: data.runCount,
      averageScore: data.runCount > 0 ? data.totalScore / data.runCount : 0,
      averageRank: data.runCount > 0 ? data.totalRank / data.runCount : 0,
    });
  }

  // Sort by average rank ascending (best first), then by avg score descending as tiebreaker
  entries.sort((a, b) => a.averageRank - b.averageRank || b.averageScore - a.averageScore);

  return entries;
}

export async function GET() {
  try {
    const allRuns = await listBenchmarkRuns();
    const completedRuns = allRuns.filter((r) => r.status === "complete");

    // Global leaderboard
    const global = buildLeaderboard(completedRuns);

    // Per-category leaderboards
    const byCategory: Record<string, LeaderboardEntry[]> = {};
    const categories = [...new Set(completedRuns.map((r) => r.categoryId))];

    for (const catId of categories) {
      const catRuns = completedRuns.filter((r) => r.categoryId === catId);
      byCategory[catId] = buildLeaderboard(catRuns);
    }

    const data: LeaderboardData = { global, byCategory };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ global: [], byCategory: {} });
  }
}
