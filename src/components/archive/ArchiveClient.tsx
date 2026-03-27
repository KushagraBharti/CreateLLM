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
        { value: "all", label: "All archived statuses" },
        { value: "complete", label: "Complete" },
        { value: "partial", label: "Partial" },
        { value: "dead_lettered", label: "Dead lettered" },
        { value: "canceled", label: "Canceled" },
        { value: "error", label: "Error" },
      ]}
    />
  );
}
