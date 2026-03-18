import { getModelIdentity } from "@/utils/model-identity";
import { BenchmarkRun, BenchmarkRunSummary, LeaderboardData, LeaderboardEntry } from "@/types";
import { listBenchmarkRunSummaries, listBenchmarkRuns } from "./storage";

function buildLeaderboard(runs: BenchmarkRun[]): LeaderboardEntry[] {
  const stats = new Map<
    string,
    {
      totalRank: number;
      totalScore: number;
      totalCritiqueScore: number;
      critiqueCount: number;
      wins: number;
      runCount: number;
    }
  >();

  for (const run of runs) {
    if (run.finalRankings.length === 0) continue;

    const candidateIds = run.revisedIdeas.map((idea) => idea.modelId);
    const modelScores = new Map<string, { totalRank: number; totalScore: number; judgeCount: number }>();

    for (const ranking of run.finalRankings) {
      for (const entry of ranking.rankings) {
        if (!candidateIds.includes(entry.modelId)) continue;
        const existing = modelScores.get(entry.modelId) ?? { totalRank: 0, totalScore: 0, judgeCount: 0 };
        existing.totalRank += entry.rank;
        existing.totalScore += entry.score;
        existing.judgeCount += 1;
        modelScores.set(entry.modelId, existing);
      }
    }

    let winnerId = "";
    let bestAverageRank = Number.POSITIVE_INFINITY;
    for (const [modelId, score] of modelScores) {
      const averageRank = score.judgeCount > 0 ? score.totalRank / score.judgeCount : Number.POSITIVE_INFINITY;
      if (averageRank < bestAverageRank) {
        bestAverageRank = averageRank;
        winnerId = modelId;
      }
    }

    for (const modelId of candidateIds) {
      const ranking = modelScores.get(modelId);
      if (!ranking || ranking.judgeCount === 0) continue;

      const critiqueScores = run.critiqueVotes.flatMap((vote) =>
        vote.critiques.filter((critique) => critique.targetModelId === modelId).map((critique) => critique.score)
      );

      const entry = stats.get(modelId) ?? {
        totalRank: 0,
        totalScore: 0,
        totalCritiqueScore: 0,
        critiqueCount: 0,
        wins: 0,
        runCount: 0,
      };

      entry.totalRank += ranking.totalRank / ranking.judgeCount;
      entry.totalScore += ranking.totalScore / ranking.judgeCount;
      entry.totalCritiqueScore += critiqueScores.reduce((sum, score) => sum + score, 0);
      entry.critiqueCount += critiqueScores.length;
      entry.runCount += 1;
      if (modelId === winnerId) entry.wins += 1;
      stats.set(modelId, entry);
    }
  }

  return [...stats.entries()]
    .map(([modelId, stat]) => {
      const identity = getModelIdentity(modelId);
      return {
        modelId,
        modelName: identity.name,
        provider: identity.provider,
        wins: stat.wins,
        totalRuns: stat.runCount,
        averageScore: stat.runCount > 0 ? stat.totalScore / stat.runCount : 0,
        averageRank: stat.runCount > 0 ? stat.totalRank / stat.runCount : 0,
        averageCritiqueScore: stat.critiqueCount > 0 ? stat.totalCritiqueScore / stat.critiqueCount : 0,
      };
    })
    .sort((a, b) => a.averageRank - b.averageRank || b.averageScore - a.averageScore);
}

export async function getArchiveSummaries(): Promise<BenchmarkRunSummary[]> {
  return listBenchmarkRunSummaries();
}

export async function getLeaderboardData(): Promise<LeaderboardData> {
  const runs = await listBenchmarkRuns();
  const completedOrPartial = runs.filter((run) =>
    run.status === "complete" || run.status === "partial"
  );
  const global = buildLeaderboard(completedOrPartial);
  const byCategory: Record<string, LeaderboardEntry[]> = {};

  for (const categoryId of new Set(completedOrPartial.map((run) => run.categoryId))) {
    byCategory[categoryId] = buildLeaderboard(
      completedOrPartial.filter((run) => run.categoryId === categoryId)
    );
  }

  return {
    global,
    byCategory,
    totals: {
      runs: runs.length,
      ideas: runs.reduce((sum, run) => sum + run.ideas.length + run.revisedIdeas.length, 0),
      critiques: runs.reduce(
        (sum, run) =>
          sum +
          run.critiqueVotes.reduce((voteSum, vote) => voteSum + vote.critiques.length, 0) +
          run.humanCritiques.length,
        0
      ),
      completedModels: runs.reduce(
        (sum, run) =>
          sum +
          Object.values(run.modelStates).filter((state) => state.status === "complete").length,
        0
      ),
    },
  };
}

export async function getHomeStats() {
  const [summaries, leaderboard] = await Promise.all([
    listBenchmarkRunSummaries(),
    getLeaderboardData(),
  ]);

  return {
    totalRuns: summaries.length,
    totalIdeas: leaderboard.totals.ideas,
    totalCritiques: leaderboard.totals.critiques,
    totalModels: leaderboard.global.length,
  };
}
