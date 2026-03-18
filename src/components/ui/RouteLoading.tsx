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
    <div className="max-w-5xl mx-auto px-6 py-16 min-h-[60vh] flex items-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full border border-border rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(212,159,102,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(123,147,168,0.12),transparent_34%)] bg-bg-deep p-8"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="relative h-12 w-12 rounded-full border border-border bg-bg-surface/80 overflow-hidden">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "180%" }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.8, ease: "easeInOut" }}
              className="absolute inset-y-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(232,228,222,0.45),transparent)]"
            />
          </div>
          <div>
            <p className="label mb-2">{title}</p>
            <p className="text-base text-text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-2xl border border-border bg-bg-surface/60 p-4">
              <div className="h-3 w-20 rounded-full bg-border/70 mb-4" />
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-border/50" />
                <div className="h-3 rounded-full bg-border/40 w-5/6" />
                <div className="h-3 rounded-full bg-border/30 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
