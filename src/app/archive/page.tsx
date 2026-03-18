import Link from "next/link";
import ArchiveClient from "@/components/archive/ArchiveClient";
import { getArchiveSummaries } from "@/lib/results";

export default async function ArchivePage() {
  const runs = await getArchiveSummaries();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl text-text-primary">Archive</h1>
          <p className="text-text-secondary text-base mt-2">
            Browse all past benchmark runs
          </p>
        </div>
        <Link href="/arena" className="text-base text-text-muted hover:text-accent transition-colors">
          New Benchmark &rarr;
        </Link>
      </div>

      <ArchiveClient runs={runs} />
    </div>
  );
}
