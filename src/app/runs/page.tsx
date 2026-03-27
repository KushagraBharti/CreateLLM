import Link from "next/link";
import RunListClient from "@/components/runs/RunListClient";
import { fetchRunsPage } from "@/lib/convex-server";

function asSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = asSingle(params.q)?.trim() || undefined;
  const categoryId = asSingle(params.category) || undefined;
  const status = asSingle(params.status) || undefined;
  const cursor = asSingle(params.cursor) || null;
  const from = asSingle(params.from) || "";
  const to = asSingle(params.to) || "";
  const createdAfter = from ? Date.parse(`${from}T00:00:00.000Z`) : undefined;
  const createdBefore = to ? Date.parse(`${to}T23:59:59.999Z`) : undefined;
  const page = await fetchRunsPage({
    query,
    categoryId,
    status,
    cursor,
    createdAfter,
    createdBefore,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-text-primary sm:text-5xl">Runs</h1>
          <p className="mt-2 text-base text-text-secondary">
            Track {page.totalMatchingRuns} benchmark run{page.totalMatchingRuns === 1 ? "" : "s"} across active work and finished results
          </p>
        </div>
        <Link href="/arena" className="text-base text-text-muted transition-colors hover:text-accent">
          New Benchmark &rarr;
        </Link>
      </div>

      <RunListClient
        basePath="/runs"
        mode="runs"
        runs={page.page}
        nextCursor={page.continueCursor}
        hasMore={!page.isDone}
        totalMatchingRuns={page.totalMatchingRuns}
        categoryCounts={page.categoryCounts}
        filters={{
          query: query ?? "",
          categoryId: categoryId ?? "all",
          status: status ?? "all",
          from,
          to,
        }}
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
          { value: "dead_lettered", label: "Dead lettered" },
          { value: "canceled", label: "Canceled" },
          { value: "error", label: "Error" },
        ]}
      />
    </div>
  );
}
