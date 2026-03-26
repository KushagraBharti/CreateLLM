"use client";

import { motion } from "framer-motion";
import { categories } from "@/lib/categories";
import { clsx } from "clsx";

interface CategorySelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export default function CategorySelector({
  selectedId,
  onSelect,
  disabled,
}: CategorySelectorProps) {
  return (
    <div>
      <p className="label mb-4">Domain</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-l border-border">
        {categories.map((cat) => {
          const selected = cat.id === selectedId;
          return (
            <button
              key={cat.id}
              onClick={() => !disabled && onSelect(cat.id)}
              disabled={disabled}
              className={clsx(
                "text-left px-4 py-3 border-r border-b border-border transition-colors",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                selected
                  ? "bg-white/[0.03]"
                  : "hover:bg-white/[0.02]",
              )}
            >
              <span
                className={clsx(
                  "text-base block transition-colors",
                  selected ? "text-text-primary" : "text-text-muted",
                )}
              >
                {cat.name}
              </span>
              <span className="text-[11px] text-text-muted/40 leading-snug mt-1 block line-clamp-2">
                {cat.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
