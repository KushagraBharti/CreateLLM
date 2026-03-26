"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { getModelCatalog, MODEL_SELECTION_LIMITS, isValidOpenRouterModelId } from "@/lib/models";

interface ModelSelectorProps {
  selectedModelIds: string[];
  customModelIds: string[];
  onChange: (next: { selectedModelIds: string[]; customModelIds: string[] }) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  selectedModelIds,
  customModelIds,
  onChange,
  disabled,
}: ModelSelectorProps) {
  const [query, setQuery] = useState("");
  const [customModelInput, setCustomModelInput] = useState("");
  const catalog = getModelCatalog();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (model) =>
        model.name.toLowerCase().includes(needle) ||
        model.lab.toLowerCase().includes(needle) ||
        model.tags.some((tag) => tag.includes(needle))
    );
  }, [catalog, query]);

  function toggleModel(modelId: string) {
    const nextIds = selectedModelIds.includes(modelId)
      ? selectedModelIds.filter((id) => id !== modelId)
      : [...selectedModelIds, modelId];
    onChange({ selectedModelIds: nextIds, customModelIds });
  }

  function addCustomModel() {
    const value = customModelInput.trim();
    if (!isValidOpenRouterModelId(value) || customModelIds.includes(value)) return;
    onChange({
      selectedModelIds,
      customModelIds: [...customModelIds, value],
    });
    setCustomModelInput("");
  }

  function removeCustomModel(modelId: string) {
    onChange({
      selectedModelIds,
      customModelIds: customModelIds.filter((id) => id !== modelId),
    });
  }

  const totalSelected = selectedModelIds.length + customModelIds.length;
  const selectedCatalogModels = catalog.filter((model) => selectedModelIds.includes(model.id));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label mb-1">Models</p>
            <h3 className="font-display text-2xl text-text-primary">Choose your contenders</h3>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl text-text-primary tabular-nums">
              {totalSelected}
            </span>
            <span className="text-[11px] uppercase tracking-[0.22em] text-text-muted ml-1">
              / {MODEL_SELECTION_LIMITS.max}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        disabled={disabled}
        placeholder="Search models…"
        className={clsx(
          "w-full border-0 border-b border-border bg-transparent px-0 py-3 text-base text-text-primary outline-none transition-colors",
          "placeholder:text-text-muted/45 focus:border-accent"
        )}
      />

      {/* Active roster summary */}
      {totalSelected > 0 && (
        <div className="mt-4 pb-4 border-b border-border">
          <p className="label mb-3">Active Roster</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {selectedCatalogModels.map((model) => (
              <span key={model.id} className="text-sm text-text-secondary">
                {model.name}
              </span>
            ))}
            {customModelIds.map((modelId) => (
              <button
                key={modelId}
                type="button"
                onClick={() => removeCustomModel(modelId)}
                className="text-sm text-text-muted hover:text-accent transition-colors"
              >
                {modelId} ×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model list */}
      <div className="mt-2 overflow-y-auto max-h-[360px] min-h-0 lg:max-h-none lg:flex-1">
        {filtered.map((model) => {
          const selected = selectedModelIds.includes(model.id);
          const atLimit = !selected && totalSelected >= MODEL_SELECTION_LIMITS.max;
          return (
            <button
              key={model.id}
              type="button"
              disabled={disabled || atLimit}
              onClick={() => toggleModel(model.id)}
              className={clsx(
                "group w-full flex items-baseline gap-4 py-3 border-b border-border/30 text-left transition-colors",
                selected ? "bg-white/[0.02]" : "hover:bg-white/[0.01]",
                (disabled || atLimit) && "cursor-not-allowed opacity-30"
              )}
            >
              <span className="text-base text-text-primary group-hover:text-accent transition-colors truncate flex-1">
                {model.name}
              </span>
              <span className="label text-[11px] hidden sm:block">
                {model.lab}
              </span>
              <span
                className={clsx(
                  "text-[11px] uppercase tracking-[0.22em] shrink-0 transition-colors",
                  selected ? "text-accent" : "text-text-muted/40",
                )}
              >
                {selected ? "Selected" : "Add"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom model */}
      <div className="mt-4 border-t border-border pt-4">
        <p className="label mb-2">Bring Your Own Model</p>
        <div className="flex gap-3">
          <input
            value={customModelInput}
            onChange={(event) => setCustomModelInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomModel();
              }
            }}
            disabled={disabled}
            placeholder="provider/model-name"
            className={clsx(
              "flex-1 border-0 border-b border-border bg-transparent px-0 py-2.5 text-sm text-text-primary outline-none transition-colors",
              "placeholder:text-text-muted/45 focus:border-accent"
            )}
          />
          <button
            type="button"
            onClick={addCustomModel}
            disabled={disabled || !isValidOpenRouterModelId(customModelInput) || totalSelected >= MODEL_SELECTION_LIMITS.max}
            className="border-b border-border px-0 py-2 text-sm uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-accent hover:text-text-primary disabled:opacity-30"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
