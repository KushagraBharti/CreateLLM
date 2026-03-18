"use client";

import { BenchmarkRun, BenchmarkStatus } from "@/types";
import { getModelIdentity, getModelOrder } from "@/utils/model-identity";

function getModelStageStatus(
  modelId: string,
  run: BenchmarkRun | null,
  status: BenchmarkStatus
): "waiting" | "thinking" | "done" | "failed" {
  if (!run) return "waiting";
  const modelState = run.modelStates[modelId];
  if (run.failedModels.includes(modelId) || modelState?.status === "failed") return "failed";

  switch (status) {
    case "queued":
      return "waiting";
    case "generating":
      return run.ideas.find((idea) => idea.modelId === modelId) ? "done" : "thinking";
    case "critiquing":
    case "awaiting_human_critique":
      return run.critiqueVotes.find((vote) => vote.fromModelId === modelId)
        ? "done"
        : run.ideas.some((idea) => idea.modelId === modelId)
          ? "thinking"
          : "waiting";
    case "revising":
      return run.revisedIdeas.find((idea) => idea.modelId === modelId)
        ? "done"
        : run.ideas.some((idea) => idea.modelId === modelId)
          ? "thinking"
          : "waiting";
    case "voting":
    case "complete":
    case "partial":
      return run.finalRankings.find((ranking) => ranking.judgeModelId === modelId)
        ? "done"
        : run.revisedIdeas.some((idea) => idea.modelId === modelId)
          ? "thinking"
          : "waiting";
    case "canceled":
    case "dead_lettered":
    case "error":
      return modelState?.status === "complete" ? "done" : "failed";
    default:
      return "waiting";
  }
}

export default function ModelStatusGrid({
  run,
  status,
}: {
  run: BenchmarkRun | null;
  status: BenchmarkStatus;
}) {
  const modelIds = run?.selectedModels.map((model) => model.id) ?? getModelOrder();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
      {modelIds.map((modelId) => {
        const model = getModelIdentity(modelId);
        const stageStatus = getModelStageStatus(modelId, run, status);

        return (
          <div key={modelId} className="bg-bg-deep p-3 flex items-center gap-3">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-300"
              style={{
                backgroundColor:
                  stageStatus === "done"
                    ? "#6bbf7b"
                    : stageStatus === "failed"
                      ? "#c75050"
                      : stageStatus === "thinking"
                        ? model.color
                        : "var(--color-border)",
                ...(stageStatus === "thinking"
                  ? { animation: "pulse-dot 1.5s ease-in-out infinite" }
                  : {}),
              }}
            />

            <div className="min-w-0">
              <span className="text-base text-text-primary block truncate">{model.name}</span>
              <span className="text-base text-text-muted">
                {stageStatus === "done"
                  ? "Done"
                  : stageStatus === "failed"
                    ? "Failed"
                    : stageStatus === "thinking"
                      ? "Working..."
                      : "Waiting"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
