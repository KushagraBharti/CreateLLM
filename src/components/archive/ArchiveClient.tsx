"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BenchmarkRunSummary } from "@/types";
import { getCategoryIdentity } from "@/utils/category-identity";
import { StatusBadge } from "@/components/ui/Badge";

export default function ArchiveClient({ runs }: { runs: BenchmarkRunSummary[] }) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const categories = Array.from(new Set(runs.map((run) => run.categoryId))).sort();
  const filteredRuns =
    filterCategory === "all" ? runs : runs.filter((run) => run.categoryId === filterCategory);

  if (runs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center min-h-[50vh] text-center"
      >
        <p className="font-display text-6xl text-text-muted/20 mb-6">—</p>
        <h2 className="font-display text-2xl text-text-secondary mb-2">No Benchmarks Yet</h2>
        <p className="text-base text-text-muted mb-6 max-w-xs">
          Run your first benchmark and it will appear here.
        </p>
        <Link href="/arena" className="text-base text-accent hover:text-accent-hover transition-colors">
          Enter the Arena &rarr;
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {categories.length > 1 && (
        <div className="flex gap-4 flex-wrap border-b border-border pb-3">
          <button
            onClick={() => setFilterCategory("all")}
            className={filterCategory === "all" ? "text-text-primary" : "text-text-muted hover:text-text-secondary"}
          >
            All ({runs.length})
          </button>
          {categories.map((catId) => {
            const identity = getCategoryIdentity(catId);
            const count = runs.filter((run) => run.categoryId === catId).length;
            return (
              <button
                key={catId}
                onClick={() => setFilterCategory(catId)}
                className="flex items-center gap-1.5 text-base transition-colors capitalize"
                style={{
                  color: filterCategory === catId ? identity.color : "var(--color-text-muted)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: identity.color }} />
                {catId} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="border-t border-border">
        {filteredRuns.map((run, index) => {
          const identity = getCategoryIdentity(run.categoryId);
          return (
            <motion.div
              key={run.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link href={`/arena/${run.id}`}>
                <div className="flex items-center gap-4 py-4 border-b border-border/50 hover:bg-bg-surface/30 transition-colors group cursor-pointer px-1">
                  <div className="flex items-center gap-2 w-28 flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: identity.color }} />
                    <span className="text-base text-text-muted capitalize font-mono">{run.categoryId}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base text-text-primary line-clamp-1 group-hover:text-accent transition-colors">
                      {run.prompt}
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      {run.completedModelCount}/{run.modelCount} models completed
                    </p>
                  </div>

                  <StatusBadge status={run.status} />

                  <span className="text-base font-mono text-text-muted w-28 text-right flex-shrink-0">
                    {new Date(run.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
