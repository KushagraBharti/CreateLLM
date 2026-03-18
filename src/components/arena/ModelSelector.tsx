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

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label mb-2">Models</p>
          <p className="text-sm text-text-muted">
            Choose {MODEL_SELECTION_LIMITS.min}-{MODEL_SELECTION_LIMITS.max} competitors. OpenRouter-only.
          </p>
        </div>
        <span className="font-mono text-sm text-text-secondary">{totalSelected} selected</span>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
        placeholder="Search by model, lab, or tag"
        className="w-full px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-base"
      />

      <div className="grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1">
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
                "border rounded-xl p-4 text-left transition-colors",
                selected
                  ? "border-border-active bg-bg-elevated"
                  : "border-border bg-bg-surface hover:bg-bg-elevated/40",
                (disabled || atLimit) && "opacity-60 cursor-not-allowed"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: model.color }} />
                    <span className="text-text-primary font-medium">{model.name}</span>
                  </div>
                  <p className="text-sm text-text-muted mt-1">
                    {model.lab} · {model.tier}
                  </p>
                </div>
                <span className="text-xs font-mono text-text-secondary uppercase">{selected ? "On" : "Off"}</span>
              </div>
              <p className="text-sm text-text-secondary mt-3">{model.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {model.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 rounded-full bg-bg-deep text-text-muted border border-border/60">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="border border-border rounded-xl p-4 bg-bg-surface/70">
        <p className="label mb-2">Bring Your Own Model</p>
        <div className="flex gap-2">
          <input
            value={customModelInput}
            onChange={(event) => setCustomModelInput(event.target.value)}
            disabled={disabled}
            placeholder="provider/model-name"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-deep text-text-primary text-base"
          />
          <button
            type="button"
            onClick={addCustomModel}
            disabled={disabled || !isValidOpenRouterModelId(customModelInput) || totalSelected >= MODEL_SELECTION_LIMITS.max}
            className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-bg-elevated disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {customModelIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {customModelIds.map((modelId) => (
              <button
                key={modelId}
                type="button"
                onClick={() => removeCustomModel(modelId)}
                className="px-3 py-1.5 rounded-full border border-border text-sm text-text-secondary hover:text-text-primary"
              >
                {modelId} ×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
