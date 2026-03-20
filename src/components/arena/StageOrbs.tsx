"use client";

import { motion } from "framer-motion";
import { BenchmarkStatus, RunCheckpointStage } from "@/types";
import { clsx } from "clsx";

const stages: { status: BenchmarkStatus; label: string }[] = [
  { status: "generating", label: "Generate" },
  { status: "critiquing", label: "Critique" },
  { status: "revising", label: "Revise" },
  { status: "voting", label: "Crown" },
];

function getStageIndex(status: BenchmarkStatus): number {
  const idx = stages.findIndex((s) => s.status === status);
  if (status === "complete") return stages.length;
  if (status === "error") return -1;
  return idx;
}

function mapCheckpointStageToStatus(stage?: RunCheckpointStage): BenchmarkStatus | null {
  if (!stage) return null;
  switch (stage) {
    case "generate":
      return "generating";
    case "critique":
      return "critiquing";
    case "human_critique":
      return "awaiting_human_critique";
    case "revise":
      return "revising";
    case "vote":
      return "voting";
    case "complete":
      return "complete";
    default:
      return null;
  }
}

export default function StageOrbs({
  status,
  checkpointStage,
}: {
  status: BenchmarkStatus;
  checkpointStage?: RunCheckpointStage;
}) {
  const effectiveStatus =
    ["paused", "partial", "dead_lettered"].includes(status)
      ? mapCheckpointStageToStatus(checkpointStage) ?? status
      : status;
  const currentIndex = getStageIndex(effectiveStatus);

  return (
    <div className="flex items-center gap-0">
      {stages.map((stage, i) => {
        const isComplete = currentIndex > i;
        const isCurrent = currentIndex === i;
        const isUpcoming = currentIndex < i;

        return (
          <div key={stage.status} className="flex items-center flex-1">
            {/* Stage block */}
            <div className="flex-1 text-center">
              {/* Indicator */}
              <div className="flex justify-center mb-2">
                <div
                  className={clsx(
                    "w-2 h-2 rounded-full transition-all duration-500",
                    isComplete && "bg-success scale-100",
                    isCurrent && "bg-text-primary scale-125",
                    isUpcoming && "bg-border scale-100"
                  )}
                >
                  {isCurrent && (
                    <motion.div
                      className="w-full h-full rounded-full bg-text-primary"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>
              </div>

              <span
                className={clsx(
                  "text-base font-medium tracking-wider uppercase transition-colors duration-300",
                  isComplete && "text-success",
                  isCurrent && "text-text-primary",
                  isUpcoming && "text-text-muted/40"
                )}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector (not after last) */}
            {i < stages.length - 1 && (
              <div className="w-8 h-px bg-border mx-1">
                <motion.div
                  className="h-full bg-success"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isComplete ? 1 : 0 }}
                  style={{ transformOrigin: "left" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
