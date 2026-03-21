"use client";

import { motion } from "framer-motion";
import { BenchmarkRun, BenchmarkStatus } from "@/types";
import StageOrbs from "./StageOrbs";
import ModelStatusGrid from "./ModelStatusGrid";
import Button from "@/components/ui/Button";
import { getModelIdentity } from "@/utils/model-identity";

const stageLabels: Record<string, string> = {
  queued: "Queued",
  paused: "Paused",
  generating: "Generating ideas",
  critiquing: "Critiquing & voting",
  awaiting_human_critique: "Awaiting your critique",
  revising: "Revising ideas",
  voting: "Final judgment",
  complete: "Complete",
  partial: "Partial result",
  canceled: "Canceled",
  dead_lettered: "Needs retry",
  error: "Error",
};

export default function ArenaRunner({
  status,
  step,
  run,
  onPauseRun,
  onResumeRun,
  onCancelRun,
  onRestartRun,
}: {
  status: BenchmarkStatus;
  step: string;
  run: BenchmarkRun | null;
  onPauseRun?: () => Promise<void> | void;
  onResumeRun?: () => Promise<void> | void;
  onCancelRun?: () => Promise<void> | void;
  onRestartRun?: () => Promise<void> | void;
}) {
  const canPause = ["queued", "generating", "critiquing", "revising", "voting"].includes(status);
  const canResume = ["paused", "error", "dead_lettered", "partial"].includes(status);
  const canCancel = ["queued", "generating", "critiquing", "revising", "voting", "paused"].includes(status);
  const canRestart = ["paused", "error", "dead_lettered", "partial", "complete", "canceled"].includes(status);
  const recentActions = [...(run?.controls.history ?? [])]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 8);

  function formatActionLabel(action: string) {
    switch (action) {
      case "pause":
        return "Paused";
      case "resume":
        return "Resumed";
      case "cancel":
        return "Canceled";
      case "restart":
        return "Restarted";
      case "retry":
        return "Retried";
      case "proceed":
        return "Proceeded";
      default:
        return action;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Progress */}
      <div className="border border-border rounded-lg p-6">
        <StageOrbs status={status} checkpointStage={run?.checkpoint.stage} />
      </div>

      {/* Status */}
      <div className="text-center space-y-1">
        <motion.p
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-display text-xl text-text-primary"
        >
          {stageLabels[status] ?? status}
        </motion.p>
        <motion.p
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-base text-text-muted"
        >
          {step}
        </motion.p>
      </div>

      {(onPauseRun || onResumeRun || onCancelRun || onRestartRun) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {canPause && onPauseRun && (
            <Button type="button" variant="ghost" onClick={() => void onPauseRun()}>
              Pause Run
            </Button>
          )}
          {canResume && onResumeRun && (
            <Button type="button" variant="ghost" onClick={() => void onResumeRun()}>
              Resume Run
            </Button>
          )}
          {canCancel && onCancelRun && (
            <Button type="button" variant="ghost" onClick={() => void onCancelRun()}>
              Cancel Run
            </Button>
          )}
          {canRestart && onRestartRun && (
            <Button type="button" variant="ghost" onClick={() => void onRestartRun()}>
              Restart Run
            </Button>
          )}
        </div>
      )}

      {/* Model status */}
      <ModelStatusGrid
        run={run}
        status={status}
      />

      {run && recentActions.length > 0 && (
        <div className="border-t border-border pt-5">
          <p className="label mb-3">Recent Control Actions</p>
          <div className="space-y-3">
            {recentActions.map((entry) => {
              const targetLabel = entry.scope === "model" && entry.modelId
                ? getModelIdentity(entry.modelId).name
                : "Run";
              return (
                <div key={entry.id} className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-text-primary">
                      {formatActionLabel(entry.action)} {targetLabel}
                    </p>
                    <p className="text-xs text-text-muted whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {entry.scope === "model" && entry.modelId ? "Model action" : "Run action"} during {entry.stage}.
                  </p>
                  {entry.reason && (
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      {entry.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
