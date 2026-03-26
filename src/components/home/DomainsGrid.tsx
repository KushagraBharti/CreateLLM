"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { categories } from "@/lib/categories";
import { getCategoryIdentity, categoryOrder } from "@/utils/category-identity";
import AuthAwareLink from "@/components/auth/AuthAwareLink";

export default function DomainsGrid() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-28 px-6 border-t border-border/60 bg-bg-deep/60 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto">
        <p className="label mb-4">Creative Domains</p>
        <h2 className="font-display text-3xl sm:text-4xl text-text-primary mb-16">
          Choose your arena
        </h2>

        <div ref={ref} className="border-t border-border">
          {categoryOrder.map((catId, i) => {
            const cat = categories.find((c) => c.id === catId);
            if (!cat) return null;
            const identity = getCategoryIdentity(catId);

            return (
              <motion.div
                key={catId}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <AuthAwareLink
                  href={`/arena?category=${catId}`}
                  className="group flex items-baseline gap-6 py-5 border-b border-border transition-colors duration-200 hover:bg-white/[0.02]"
                >
                  <span className="font-mono text-sm text-text-muted w-6 shrink-0">
                    {identity.number}
                  </span>
                  <h3 className="font-display text-xl text-text-primary group-hover:text-accent transition-colors duration-200 w-32 shrink-0">
                    {cat.name}
                  </h3>
                  <p className="text-base text-text-secondary leading-relaxed hidden sm:block flex-1">
                    {cat.description}
                  </p>
                </AuthAwareLink>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
