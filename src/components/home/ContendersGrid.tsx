"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { getModelCatalog } from "@/lib/models";

export default function ContendersGrid() {
  const models = getModelCatalog();
  const [activeLab, setActiveLab] = useState<string>("all");
  const labs = useMemo(
    () => ["all", ...Array.from(new Set(models.map((model) => model.lab))).sort()],
    [models],
  );
  const filteredModels =
    activeLab === "all" ? models : models.filter((model) => model.lab === activeLab);

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

        <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-border/70 pb-4">
          {labs.map((lab) => (
            <button
              key={lab}
              type="button"
              onClick={() => setActiveLab(lab)}
              className={clsx(
                "text-sm uppercase tracking-[0.18em] transition-colors",
                activeLab === lab
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {lab === "all" ? "All labs" : lab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {filteredModels.map((model, index) => {
            return (
              <motion.div
                key={model.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: index * 0.03 }}
              >
                <div className="group flex h-full flex-col justify-between bg-bg-deep p-6 transition-colors hover:bg-bg-surface">
                  <div>
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <span className="font-mono text-sm text-text-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="h-1.5 w-1.5 rounded-full opacity-50 transition-opacity group-hover:opacity-100"
                        style={{ backgroundColor: model.color }}
                      />
                    </div>

                    <h3 className="font-display text-2xl leading-tight text-text-primary transition-colors group-hover:text-accent">
                      {model.name}
                    </h3>
                    <p className="mt-2 text-sm uppercase tracking-[0.18em] text-text-muted">
                      {model.lab} · {model.tier}
                    </p>
                    <p className="mt-5 text-base leading-relaxed text-text-secondary">
                      {model.description}
                    </p>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-border/70 pt-4 text-sm">
                    <span className="text-text-muted">{model.provider}</span>
                    <span className="text-text-muted">
                      {model.defaultEnabled ? "Default roster" : "Optional pick"}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
