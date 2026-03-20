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

function canControlModel(run: BenchmarkRun | null, modelId: string): boolean {
  if (!run) return false;
  if (!["generate", "critique", "revise", "vote"].includes(run.checkpoint.stage)) return false;
  const state = run.modelStates[modelId];
  if (!state || state.status === "complete" || state.status === "canceled") return false;

  if (run.checkpoint.stage === "generate") return true;
  if (run.checkpoint.stage === "critique") return run.ideas.some((idea) => idea.modelId === modelId);
  if (run.checkpoint.stage === "revise") return run.ideas.some((idea) => idea.modelId === modelId);
  if (run.checkpoint.stage === "vote") return run.revisedIdeas.some((idea) => idea.modelId === modelId);
  return false;
}

export default function ModelStatusGrid({
  run,
  status,
  onPauseModel,
  onResumeModel,
  onRetryModel,
  onCancelModel,
}: {
  run: BenchmarkRun | null;
  status: BenchmarkStatus;
  onPauseModel?: (modelId: string) => Promise<void> | void;
  onResumeModel?: (modelId: string) => Promise<void> | void;
  onRetryModel?: (modelId: string) => Promise<void> | void;
  onCancelModel?: (modelId: string) => Promise<void> | void;
}) {
  const modelIds = run?.selectedModels.map((model) => model.id) ?? getModelOrder();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
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
          <div key={modelId} className="bg-bg-deep p-3 flex items-center gap-3">
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

            <div className="min-w-0">
              <span className="text-base text-text-primary block truncate">{model.name}</span>
              <span className="text-base text-text-muted">
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
                      ? "Working..."
                      : "Waiting"}
              </span>
              {statusNote && (
                <p className="mt-1 text-xs leading-relaxed text-text-muted max-w-[26ch]">
                  {statusNote}
                </p>
              )}
              {run && canControlModel(run, modelId) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(stageStatus === "thinking" || stageStatus === "waiting" || stageStatus === "retrying") && onPauseModel && (
                    <button
                      type="button"
                      onClick={() => void onPauseModel(modelId)}
                      className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Pause
                    </button>
                  )}
                  {stageStatus === "paused" && onResumeModel && (
                    <button
                      type="button"
                      onClick={() => void onResumeModel(modelId)}
                      className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Resume
                    </button>
                  )}
                  {(stageStatus === "paused" || stageStatus === "failed") && onRetryModel && (
                    <button
                      type="button"
                      onClick={() => void onRetryModel(modelId)}
                      className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  {stageStatus !== "canceled" && stageStatus !== "done" && onCancelModel && (
                    <button
                      type="button"
                      onClick={() => void onCancelModel(modelId)}
                      className="text-xs text-[#C75050] hover:text-[#E26A6A] transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
