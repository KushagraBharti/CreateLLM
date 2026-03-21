"use client";

import { BenchmarkRun, BenchmarkStatus } from "@/types";
import { getModelIdentity, getModelOrder } from "@/utils/model-identity";

function getModelStageStatus(
  modelId: string,
  run: BenchmarkRun | null,
  status: BenchmarkStatus
): "waiting" | "thinking" | "done" | "failed" | "paused" | "retrying" | "canceled" {
  if (!run) return "waiting";
  const modelState = run.modelStates[modelId];
  const effectiveStatus =
    ["partial", "error", "dead_lettered", "paused"].includes(status)
      ? ({
          generate: "generating",
          critique: "critiquing",
          human_critique: "awaiting_human_critique",
          revise: "revising",
          vote: "voting",
          complete: "complete",
        }[run.checkpoint.stage] as BenchmarkStatus)
      : status;
  if (modelState?.status === "paused") return "paused";
  if (modelState?.status === "retrying") return "retrying";
  if (modelState?.status === "canceled") return "canceled";
  if (run.failedModels.includes(modelId) || modelState?.status === "failed") return "failed";

  switch (effectiveStatus) {
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
    <div className="border-t border-border/70">
      {modelIds.map((modelId) => {
        const model = getModelIdentity(modelId);
        const stageStatus = getModelStageStatus(modelId, run, status);
        const modelState = run?.modelStates[modelId];
        const controlState = run?.controls.modelControls[modelId];
        const statusNote =
          stageStatus === "failed"
            ? modelState?.error
            : controlState?.note;

        return (
          <div key={modelId} className="flex items-start gap-3 border-b border-border/60 py-4">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-300"
              style={{
                backgroundColor:
                  stageStatus === "done"
                    ? "#6bbf7b"
                    : stageStatus === "paused"
                      ? "#C9A84C"
                      : stageStatus === "retrying"
                        ? "#7AA2F7"
                    : stageStatus === "failed"
                      ? "#c75050"
                      : stageStatus === "canceled"
                        ? "#8A8A8A"
                      : stageStatus === "thinking"
                        ? model.color
                        : "var(--color-border)",
                ...(stageStatus === "thinking"
                  ? { animation: "pulse-dot 1.5s ease-in-out infinite" }
                  : {}),
              }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-base text-text-primary block truncate">{model.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
                  {stageStatus === "done"
                    ? "Done"
                    : stageStatus === "paused"
                      ? "Paused"
                      : stageStatus === "retrying"
                        ? "Retry queued"
                        : stageStatus === "failed"
                          ? "Failed"
                          : stageStatus === "canceled"
                            ? "Canceled"
                            : stageStatus === "thinking"
                              ? "Working"
                              : "Waiting"}
                </span>
              </div>
              <p className="text-sm text-text-muted">
                {stageStatus === "done"
                  ? "Stage completed."
                  : stageStatus === "paused"
                    ? "Execution is paused."
                    : stageStatus === "retrying"
                      ? "Retry attempt queued."
                      : stageStatus === "failed"
                        ? "Execution failed."
                        : stageStatus === "canceled"
                          ? "Execution canceled."
                          : stageStatus === "thinking"
                            ? "Currently processing."
                            : "Waiting for this stage."}
              </p>
              {statusNote && (
                <p className="mt-1 text-xs leading-relaxed text-text-muted max-w-[26ch]">
                  {statusNote}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
