"use client";

import type { BenchmarkRunSummary } from "@/types";
import RunListClient from "@/components/runs/RunListClient";

interface ArchiveClientProps {
  runs: BenchmarkRunSummary[];
  nextCursor: string | null;
  hasMore: boolean;
  totalMatchingRuns: number;
  categoryCounts: Record<string, number>;
  filters: {
    query: string;
    categoryId: string;
    status: string;
    from: string;
    to: string;
  };
}

export default function ArchiveClient(props: ArchiveClientProps) {
  return (
    <RunListClient
      {...props}
      basePath="/archive"
      mode="archive"
      statusOptions={[
        { value: "all", label: "All statuses" },
        { value: "queued", label: "Queued" },
        { value: "paused", label: "Paused" },
        { value: "generating", label: "Generating" },
        { value: "critiquing", label: "Critiquing" },
        { value: "awaiting_human_critique", label: "Awaiting human critique" },
        { value: "revising", label: "Revising" },
        { value: "voting", label: "Voting" },
        { value: "complete", label: "Complete" },
        { value: "partial", label: "Partial" },
        { value: "canceled", label: "Canceled" },
        { value: "dead_lettered", label: "Dead lettered" },
        { value: "error", label: "Error" },
      ]}
    />
  );
}
