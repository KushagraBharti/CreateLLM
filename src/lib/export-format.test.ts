import { describe, expect, it } from "vitest";
import { buildRunSummaryCsv } from "./export-format";
import type { BenchmarkRun } from "@/types";

const sampleRun: BenchmarkRun = {
  id: "run_1",
  categoryId: "venture",
  prompt: "Test prompt",
  selectedModels: [
    {
      id: "model-a",
      openRouterId: "provider/model-a",
      name: "Model A",
      provider: "OpenRouter",
      lab: "Test Lab",
      tier: "fast",
      tags: [],
      description: "",
      personality: "",
      color: "#fff",
      initial: "A",
      defaultEnabled: true,
      active: true,
    },
  ],
  timestamp: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  status: "complete",
  currentStep: "done",
  exposureMode: "private",
  ideas: [
    {
      modelId: "model-a",
      content: {
        title: "Idea A",
        summary: "Summary",
        description: "Desc",
        novelty: "High",
      },
      raw: "{}",
      timestamp: new Date(0).toISOString(),
    },
  ],
  critiqueVotes: [],
  humanCritiques: [],
  revisedIdeas: [],
  finalRankings: [],
  failedModels: [],
  modelStates: {
    "model-a": {
      modelId: "model-a",
      stage: "complete",
      status: "complete",
    },
  },
  failures: [],
  checkpoint: {
    stage: "complete",
    completedModelIds: ["model-a"],
    readyForRevisionModelIds: [],
    updatedAt: new Date(0).toISOString(),
  },
  cancellation: {
    requested: false,
  },
  controls: {
    history: [],
    modelControls: {
      "model-a": {
        modelId: "model-a",
        isPaused: false,
        isCanceled: false,
      },
    },
  },
  circuitBreaker: {
    status: "closed",
    failureCount: 0,
  },
  web: {
    config: {
      maxSearchCallsPerStagePerModel: 1,
      maxResultsPerSearch: 5,
      maxCharsPerResult: 500,
      maxLoopTurns: 2,
    },
    toolCalls: [],
    retrievedSources: [],
    usage: [],
  },
  reasoning: {
    details: [],
  },
  metadata: {
    participantCount: 1,
    minimumSuccessfulModels: 1,
  },
};

describe("run export formatting", () => {
  it("renders a stable csv header and row", () => {
    const csv = buildRunSummaryCsv(sampleRun);
    expect(csv).toContain("modelId,modelName,status,stage,ideaTitle");
    expect(csv).toContain("model-a,Model A,complete,complete,Idea A");
  });
});
