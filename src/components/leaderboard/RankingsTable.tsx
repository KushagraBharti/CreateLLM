"use client";

import { motion } from "framer-motion";
import { LeaderboardEntry } from "@/types";
import { getModelIdentity } from "@/utils/model-identity";

interface RankingsTableProps {
  entries: LeaderboardEntry[];
  title: string;
  subtitle?: string;
}

const placeLabels = ["1st", "2nd", "3rd", "4th"];

export default function RankingsTable({
  entries,
  title,
  subtitle,
}: RankingsTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-display text-2xl text-text-muted/40 mb-2">—</p>
        <p className="text-text-muted text-base">
          No data yet. Run some benchmarks to populate the leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="font-display text-xl text-text-primary">{title}</h3>
        {subtitle && (
          <p className="text-base font-mono text-text-muted mt-1">{subtitle}</p>
        )}
      </div>

      <div className="border-t border-border">
        {/* Header */}
        <div className="grid grid-cols-[40px_minmax(0,1.2fr)_88px_74px_82px_56px_50px] gap-3 py-2 label">
          <span>#</span>
          <span>Model</span>
          <span className="text-right">Composite</span>
          <span className="text-right">Final</span>
          <span className="text-right">Finish</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Runs</span>
        </div>

        {/* Rows */}
        {entries.map((entry, i) => {
          const model = getModelIdentity(entry.modelId);
          const winRate =
            entry.totalRuns > 0
              ? ((entry.wins / entry.totalRuns) * 100).toFixed(0)
              : "0";

          return (
            <motion.div
              key={entry.modelId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06 }}
              className="grid grid-cols-[40px_minmax(0,1.2fr)_88px_74px_82px_56px_50px] gap-3 py-3 border-t border-border/50 items-center"
            >
              {/* Place */}
              <span className="font-mono text-base text-text-muted">
                {placeLabels[i] ?? `${i + 1}th`}
              </span>

              {/* Model */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: model.color }}
                />
                <div className="min-w-0">
                  <span className="text-base text-text-primary block truncate">
                    {entry.modelName}
                  </span>
                  <span className="text-base text-text-muted font-mono">
                    {model.provider}
                  </span>
                </div>
              </div>

              {/* Composite */}
              <span
                className="font-mono text-base font-medium text-right"
                style={{
                  color:
                    entry.compositeScore >= 70
                      ? "#6BBF7B"
                      : entry.compositeScore >= 50
                        ? "#C9A84C"
                        : "#C75050",
                }}
              >
                {entry.compositeScore.toFixed(1)}
              </span>

              {/* Avg Final Score */}
              <span className="font-mono text-base text-text-secondary text-right">
                {entry.averageFinalScore.toFixed(1)}
              </span>

              {/* Avg Finish */}
              <span className="font-mono text-base text-text-secondary text-right">
                #{entry.averageFinalRank.toFixed(2)}
              </span>

              {/* Wins */}
              <span className="text-right">
                <span className="font-mono text-base" style={{ color: "#6BBF7B" }}>
                  {entry.wins}
                </span>
                <span className="block font-mono text-[11px] text-text-muted">{winRate}%</span>
              </span>

              {/* Runs */}
              <span className="font-mono text-base text-text-muted text-right">
                {entry.totalRuns}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
