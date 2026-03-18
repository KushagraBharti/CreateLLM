"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeaderboardData, LeaderboardEntry } from "@/types";

function LeaderboardTable({
  entries,
  title,
  runLabel,
}: {
  entries: LeaderboardEntry[];
  title: string;
  runLabel?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No data yet. Run some benchmarks to populate the leaderboard.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-3">{title}</h3>
      {runLabel && (
        <p className="text-xs text-gray-400 mb-3">
          Based on {runLabel}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">
                Place
              </th>
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">
                Model
              </th>
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">
                Wins
              </th>
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">
                Win Rate
              </th>
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">
                Avg Score
              </th>
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">
                Avg Rank
              </th>
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">
                Runs
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const winRate =
                entry.totalRuns > 0
                  ? ((entry.wins / entry.totalRuns) * 100).toFixed(0)
                  : "0";
              const placeLabel =
                i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`;

              return (
                <tr
                  key={entry.modelId}
                  className={`border-t border-gray-200 ${
                    i === 0
                      ? "bg-yellow-50"
                      : i === 1
                      ? "bg-gray-50/50"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    {placeLabel}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {entry.modelName}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">
                    {entry.wins}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {winRate}%
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                    {entry.averageScore.toFixed(1)}/10
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {entry.averageRank.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {entry.totalRuns}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/leaderboard");
        if (response.ok) {
          setData(await response.json());
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categoryIds = data ? Object.keys(data.byCategory).sort() : [];
  const totalRuns = data?.global.reduce((sum, e) => Math.max(sum, e.totalRuns), 0) ?? 0;

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block"
          >
            &larr; Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aggregated rankings across all benchmark runs
          </p>
        </div>
        <Link
          href="/benchmark"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Benchmark
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading leaderboard...</p>
      ) : !data || data.global.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-400 mb-4">
            No completed benchmarks yet.
          </p>
          <Link
            href="/benchmark"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Run your first benchmark
          </Link>
        </div>
      ) : (
        <>
          {/* Category filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Categories ({totalRuns} runs)
            </button>
            {categoryIds.map((catId) => {
              const catRuns = data.byCategory[catId]?.[0]?.totalRuns ?? 0;
              return (
                <button
                  key={catId}
                  onClick={() => setSelectedCategory(catId)}
                  className={`px-3 py-1.5 text-sm rounded-full capitalize transition-colors ${
                    selectedCategory === catId
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {catId} ({catRuns})
                </button>
              );
            })}
          </div>

          {/* Leaderboard table */}
          {selectedCategory === "all" ? (
            <LeaderboardTable
              entries={data.global}
              title="Global Leaderboard"
              runLabel={`${totalRuns} completed benchmark${totalRuns !== 1 ? "s" : ""}`}
            />
          ) : (
            <LeaderboardTable
              entries={data.byCategory[selectedCategory] || []}
              title={`${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Leaderboard`}
              runLabel={`${
                data.byCategory[selectedCategory]?.[0]?.totalRuns ?? 0
              } runs in this category`}
            />
          )}
        </>
      )}
    </div>
  );
}
