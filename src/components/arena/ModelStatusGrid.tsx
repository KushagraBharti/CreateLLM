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

  function getStageLabel(
    stageStatus: "waiting" | "thinking" | "done" | "failed" | "paused" | "retrying" | "canceled"
  ) {
    switch (stageStatus) {
      case "done":
        return "Done";
      case "paused":
        return "Paused";
      case "retrying":
        return "Retry queued";
      case "failed":
        return "Failed";
      case "canceled":
        return "Canceled";
      case "thinking":
        return "Working";
      default:
        return "Waiting";
    }
  }

  function getStageCopy(
    stageStatus: "waiting" | "thinking" | "done" | "failed" | "paused" | "retrying" | "canceled"
  ) {
    switch (stageStatus) {
      case "done":
        return "Stage completed.";
      case "paused":
        return "Execution is paused.";
      case "retrying":
        return "Retry attempt queued.";
      case "failed":
        return "Execution failed.";
      case "canceled":
        return "Execution canceled.";
      case "thinking":
        return "Currently processing.";
      default:
        return "Waiting for this stage.";
    }
  }

  return (
    <div className="border-y border-border/70">
      <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
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
          <article
            key={modelId}
            className="relative min-w-0 bg-background px-4 py-4 sm:px-5"
          >
            <span
              className="absolute left-0 top-0 h-px w-full transition-colors duration-300"
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
                opacity: stageStatus === "waiting" ? 0.55 : 1,
                ...(stageStatus === "thinking"
                  ? { animation: "pulse-dot 1.5s ease-in-out infinite" }
                  : {}),
              }}
            />

            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-muted/80">
                  {model.provider}
                </p>
                <h3 className="text-[1.05rem] leading-tight text-text-primary">
                  {model.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span
                  className="h-1.5 w-1.5 flex-shrink-0"
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
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
                  {getStageLabel(stageStatus)}
                </span>
              </div>
            </div>

            <div className="border-t border-border/60 pt-3">
              <p className="text-sm text-text-muted">
                {getStageCopy(stageStatus)}
              </p>
              {statusNote && (
                <p className="mt-3 max-w-[24ch] text-xs leading-relaxed text-text-muted">
                  {statusNote}
                </p>
              )}
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}
