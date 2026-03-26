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
    <section className="py-28 px-6 border-t border-border/60 bg-bg-deep/60 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto">
        <p className="label mb-4">Model Catalog</p>
        <h2 className="font-display text-3xl sm:text-4xl text-text-primary mb-16">
          Curated frontier contenders
        </h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-10">
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
              {lab === "all" ? "All" : lab}
            </button>
          ))}
        </div>

        <div className="border-t border-border">
          {filteredModels.map((model, index) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3, delay: index * 0.03 }}
              className="group flex items-baseline gap-5 py-4 border-b border-border/50 transition-colors hover:bg-white/[0.02]"
            >
              <span className="font-mono text-sm text-text-muted w-6 shrink-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-xl text-text-primary group-hover:text-accent transition-colors w-52 shrink-0">
                {model.name}
              </h3>
              <span className="label text-[11px] hidden sm:block flex-1">
                {model.lab} · {model.tier}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
