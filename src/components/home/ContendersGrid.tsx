"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getModelCatalog } from "@/lib/models";

export default function ContendersGrid() {
  const models = getModelCatalog();
  const [expanded, setExpanded] = useState<string | null>(models[0]?.id ?? null);

  return (
    <section className="py-28 px-6 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <p className="label mb-4">Model Catalog</p>
        <h2 className="font-display text-3xl sm:text-4xl text-text-primary mb-4">
          Curated frontier contenders
        </h2>
        <p className="text-base text-text-muted max-w-3xl mb-12">
          OpenRouter is the only model access layer. The catalog mixes flagship, reasoning, fast, and mini tiers across leading labs, while still letting you bring your own model IDs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model) => {
            const isExpanded = expanded === model.id;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => setExpanded(isExpanded ? null : model.id)}
                className="text-left border border-border rounded-2xl bg-bg-surface/70 p-5 hover:bg-bg-elevated/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: model.color }} />
                      <span className="text-text-primary text-lg font-medium">{model.name}</span>
                    </div>
                    <p className="text-base text-text-muted mt-1">
                      {model.lab} · {model.tier}
                    </p>
                  </div>
                  <span className="text-sm font-mono text-text-secondary">
                    {isExpanded ? "Hide" : "Open"}
                  </span>
                </div>

                <p className="text-base text-text-secondary mt-4">{model.description}</p>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 mt-4 border-t border-border/70 space-y-3">
                        <p className="text-sm text-text-muted italic">“{model.personality}”</p>
                        <div className="flex flex-wrap gap-2">
                          {model.tags.map((tag) => (
                            <span key={tag} className="text-xs px-2 py-1 rounded-full border border-border text-text-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl border border-border/70 p-3 bg-bg-deep/60">
                            <p className="label mb-1">Provider</p>
                            <p className="text-text-secondary">{model.provider}</p>
                          </div>
                          <div className="rounded-xl border border-border/70 p-3 bg-bg-deep/60">
                            <p className="label mb-1">Default</p>
                            <p className="text-text-secondary">{model.defaultEnabled ? "Enabled" : "Optional"}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
