import { beforeEach, describe, expect, it, vi } from "vitest";
import { BenchmarkRun } from "@/types";

const listRuns = vi.fn();
const listSummaries = vi.fn();

vi.mock("@/lib/storage", () => ({
  listBenchmarkRuns: listRuns,
  listBenchmarkRunSummaries: listSummaries,
}));

describe("results loaders", () => {
  beforeEach(() => {
    listRuns.mockReset();
    listSummaries.mockReset();
  });

  it("computes totals from actual run data", async () => {
    const run: BenchmarkRun = {
      id: "run_1",
      categoryId: "venture",
      prompt: "test",
      selectedModels: [],
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "complete",
      currentStep: "done",
      exposureMode: "public_full",
      ideas: [
        { modelId: "a", content: { title: "A", summary: "", description: "", novelty: "" }, raw: "{}", timestamp: new Date().toISOString() },
        { modelId: "b", content: { title: "B", summary: "", description: "", novelty: "" }, raw: "{}", timestamp: new Date().toISOString() },
      ],
      critiqueVotes: [
        {
          fromModelId: "a",
          critiques: [
            { ideaLabel: "B", targetModelId: "b", strengths: "", weaknesses: "", suggestions: "", score: 8 },
          ],
          rankings: [
            { modelId: "a", rank: 2, score: 7, reasoning: "" },
            { modelId: "b", rank: 1, score: 8, reasoning: "" },
          ],
        },
      ],
      humanCritiques: [],
      revisedIdeas: [
        { modelId: "a", content: { title: "A2", summary: "", description: "", novelty: "" }, raw: "{}", timestamp: new Date().toISOString() },
        { modelId: "b", content: { title: "B2", summary: "", description: "", novelty: "" }, raw: "{}", timestamp: new Date().toISOString() },
      ],
      finalRankings: [
        {
          judgeModelId: "a",
          rankings: [
            { modelId: "a", rank: 2, score: 7, reasoning: "" },
            { modelId: "b", rank: 1, score: 9, reasoning: "" },
          ],
        },
      ],
      failedModels: [],
      modelStates: {},
      failures: [],
      checkpoint: { stage: "complete", completedModelIds: ["a", "b"], readyForRevisionModelIds: ["a", "b"], updatedAt: new Date().toISOString() },
      cancellation: { requested: false },
      circuitBreaker: { status: "closed", failureCount: 0 },
      web: {
        config: {
          maxSearchCallsPerStagePerModel: 2,
          maxResultsPerSearch: 3,
          maxCharsPerResult: 12000,
          perCallTimeoutMs: 10000,
          totalStageBudgetMs: 30000,
          maxLoopTurns: 5,
        },
        toolCalls: [],
        retrievedSources: [],
        usage: [],
      },
      reasoning: {
        details: [],
      },
      metadata: { participantCount: 2, minimumSuccessfulModels: 2 },
    };

    listRuns.mockResolvedValue([run]);
    listSummaries.mockResolvedValue([
      {
        id: run.id,
        categoryId: run.categoryId,
        prompt: run.prompt,
        timestamp: run.timestamp,
        updatedAt: run.updatedAt,
        status: run.status,
        modelCount: 2,
        completedModelCount: 2,
        failedModelCount: 0,
      },
    ]);

    const { getHomeStats, getLeaderboardData } = await import("@/lib/results");
    const leaderboard = await getLeaderboardData();
    const stats = await getHomeStats();

    expect(leaderboard.totals.ideas).toBe(4);
    expect(leaderboard.totals.critiques).toBe(1);
    expect(stats.totalRuns).toBe(1);
  });
});
