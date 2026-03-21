"use client";

import { motion } from "framer-motion";

export default function RouteLoading({
  title = "Loading",
  subtitle = "Warming up the next surface.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[52vh] max-w-6xl items-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full border-t border-border pt-10"
      >
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="label mb-5">{title}</p>
            <h2 className="font-display text-[clamp(2.8rem,6vw,4.75rem)] leading-[0.94] text-text-primary">
              Transitioning
              <br />
              to the next surface.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-text-secondary">
              {subtitle}
            </p>
          </div>

          <div className="grid gap-px border border-border bg-border">
            {[0, 1, 2].map((index) => (
              <div key={index} className="bg-bg-deep px-5 py-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-sm text-text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <motion.span
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{
                      repeat: Number.POSITIVE_INFINITY,
                      duration: 1.6,
                      delay: index * 0.16,
                      ease: "easeInOut",
                    }}
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                  />
                </div>
                <div className="space-y-2">
                  <div className="h-px w-full bg-border/70" />
                  <div className="h-px w-5/6 bg-border/50" />
                  <div className="h-px w-2/3 bg-border/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
