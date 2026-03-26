"use client";

import { clsx } from "clsx";

interface CategoryFilterProps {
  categories: string[];
  selected: string;
  onSelect: (id: string) => void;
  totalRuns: number;
  getCategoryRuns: (catId: string) => number;
}

export default function CategoryFilter({
  categories: categoryIds,
  selected,
  onSelect,
  totalRuns,
  getCategoryRuns,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <button
        onClick={() => onSelect("all")}
        className={clsx(
          "text-sm uppercase tracking-[0.18em] transition-colors",
          selected === "all"
            ? "text-text-primary"
            : "text-text-muted hover:text-text-secondary",
        )}
      >
        All {totalRuns}
      </button>

      {categoryIds.map((catId) => {
        const runs = getCategoryRuns(catId);
        return (
          <button
            key={catId}
            onClick={() => onSelect(catId)}
            className={clsx(
              "text-sm uppercase tracking-[0.18em] transition-colors",
              selected === catId
                ? "text-text-primary"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {catId} {runs}
          </button>
        );
      })}
    </div>
  );
}
