"use client";

import { clsx } from "clsx";
import { BenchmarkStatus } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  pulse?: boolean;
  className?: string;
}

export default function Badge({ children, color, pulse, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 text-base font-mono tracking-wide",
        className
      )}
      style={{ color: color || "var(--color-text-muted)" }}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: color || "currentColor", animation: "pulse-dot 2s ease-in-out infinite" }}
          />
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ backgroundColor: color || "currentColor" }}
          />
        </span>
      )}
      {children}
    </span>
  );
}

const statusConfig: Record<BenchmarkStatus, { label: string; color: string }> = {
  queued: { label: "Queued", color: "#8B8B96" },
  generating: { label: "Generating", color: "#7B93A8" },
  critiquing: { label: "Critiquing", color: "#C9A84C" },
  awaiting_human_critique: { label: "Awaiting You", color: "#D49F66" },
  revising: { label: "Revising", color: "#9B8EB8" },
  voting: { label: "Voting", color: "#B8896B" },
  complete: { label: "Complete", color: "#6BBF7B" },
  partial: { label: "Partial", color: "#D4B45D" },
  canceled: { label: "Canceled", color: "#A16A6A" },
  dead_lettered: { label: "Needs Retry", color: "#C75050" },
  error: { label: "Error", color: "#C75050" },
};

export function StatusBadge({ status }: { status: BenchmarkStatus }) {
  const config = statusConfig[status];
  const isActive = !["complete", "partial", "canceled", "dead_lettered", "error"].includes(status);
  return (
    <Badge color={config.color} pulse={isActive}>
      {config.label}
    </Badge>
  );
}
