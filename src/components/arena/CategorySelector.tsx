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
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => !disabled && onSelect(cat.id)}
            disabled={disabled}
            className={clsx(
              "text-base transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
              cat.id === selectedId
                ? "text-text-primary"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {selectedId && (
        <motion.p
          key={selectedId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-text-muted mt-4 leading-relaxed"
        >
          {categories.find((c) => c.id === selectedId)?.description}
        </motion.p>
      )}
    </div>
  );
}
